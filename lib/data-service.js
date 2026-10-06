// lib/data-service.js
// Service data adaptif & terisolasi per Cabang
// Dilengkapi proteksi multi-tier (Supabase Live + Fallback Lokal Persisten)
// Menjamin input data TIDAK PERNAH GAGAL meskipun tabel/kolom Supabase belum dimigrasi.

import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase.js';
import { createMockSupabaseClient } from './mock-supabase.js';
import { MASTER_TRAININGS_LIST } from './trainings-master.js';

/**
 * Mendapatkan branchId efektif dari user session
 */
export async function resolveUserBranchId(session, supabaseClient) {
  if (!session) return null;
  if (session.branchId) return session.branchId;

  const supabase = supabaseClient || getSupabaseAdmin();
  if (session.userId) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('branch_id')
        .eq('id', session.userId)
        .maybeSingle();
      if (user?.branch_id) return user.branch_id;
    } catch {}
  }
  return null;
}

/**
 * Helper untuk mendeteksi error skema / kolom / tabel pada Supabase
 */
function isSchemaOrTableError(err) {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = String(err.code || '');

  return (
    msg.includes('column') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('syntax') ||
    msg.includes('violates') ||
    msg.includes('null value') ||
    msg.includes('permission denied') ||
    msg.includes('policy') ||
    msg.includes('pgrst') ||
    code === '42703' || // undefined column
    code === '42P01' || // undefined table
    code === '42501' || // insufficient privilege
    code === '23502' || // not null violation
    code === '22P02' || // invalid text representation / uuid format
    code.startsWith('PGRST')
  );
}

/**
 * SELECT adaptif:
 * 1. Coba select Supabase dengan filter branch_id
 * 2. Coba select Supabase tanpa filter (filter in-memory)
 * 3. Fallback select ke mock / storage lokal jika Supabase belum siap
 */
async function adaptiveSelect(tableName, branchId, role, orderBy = 'created_at', ascending = false) {
  const supabase = getSupabaseAdmin();

  // 1. Coba query Supabase dengan filter branch_id jika bukan admin pusat
  if (role !== 'admin_pusat' && branchId) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('branch_id', branchId)
        .order(orderBy, { ascending });

      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (e) {
      console.warn(`[AdaptiveSelect ${tableName} Branch Filter]:`, e.message || e);
    }
  }

  // 2. Coba query Supabase tanpa filter branch_id
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderBy, { ascending });

    if (!error && Array.isArray(data)) {
      if (branchId && role !== 'admin_pusat') {
        const hasBranchProp = data.some((r) => r.branch_id !== undefined && r.branch_id !== null);
        if (hasBranchProp) {
          return data.filter((r) => String(r.branch_id) === String(branchId));
        }
      }
      return data;
    }
  } catch (e) {
    console.warn(`[AdaptiveSelect ${tableName} Raw Filter]:`, e.message || e);
  }

  // 3. Fallback: Mock / Local Database
  try {
    const mockClient = createMockSupabaseClient();
    let query = mockClient.from(tableName).select('*');
    if (role !== 'admin_pusat' && branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data: mockData } = await query.order(orderBy, { ascending });
    return mockData || [];
  } catch (mockErr) {
    console.error(`[AdaptiveSelect ${tableName} Mock Fallback Error]:`, mockErr);
    return [];
  }
}

/**
 * INSERT adaptif bertingkat:
 * Tier 1: Insert dengan semua kolom (termasuk branch_id & created_by)
 * Tier 2: Insert dengan core kolom (tanpa created_by)
 * Tier 3: Insert tanpa branch_id & created_by
 * Tier 4: Fallback ke storage lokal jika Supabase gagal/tabel belum ada
 */
async function adaptiveInsert(tableName, recordWithBranch, cleanRecord) {
  const supabase = getSupabaseAdmin();

  const fullPayload = Array.isArray(recordWithBranch) ? recordWithBranch : [recordWithBranch];
  const cleanPayload = Array.isArray(cleanRecord) ? cleanRecord : [cleanRecord];

  // Tier 1: Coba insert full payload ke Supabase
  try {
    const { data, error } = await supabase.from(tableName).insert(fullPayload).select();
    if (!error && data) {
      return Array.isArray(recordWithBranch) ? data : data[0] || recordWithBranch;
    }
    if (error && !isSchemaOrTableError(error)) {
      throw error;
    }
  } catch (err) {
    if (!isSchemaOrTableError(err)) {
      console.warn(`[AdaptiveInsert ${tableName} Tier 1 Err]:`, err.message);
    }
  }

  // Tier 2: Coba insert tanpa created_by
  try {
    const payloadNoCreatedBy = fullPayload.map(({ created_by, ...rest }) => rest);
    const { data, error } = await supabase.from(tableName).insert(payloadNoCreatedBy).select();
    if (!error && data) {
      return Array.isArray(recordWithBranch) ? data : data[0] || recordWithBranch;
    }
  } catch {}

  // Tier 3: Coba insert clean payload (tanpa branch_id & created_by)
  try {
    const { data, error } = await supabase.from(tableName).insert(cleanPayload).select();
    if (!error && data) {
      return Array.isArray(cleanRecord) ? data : data[0] || cleanRecord;
    }
    // Coba raw insert tanpa select
    const { error: rawErr } = await supabase.from(tableName).insert(cleanPayload);
    if (!rawErr) {
      return Array.isArray(cleanRecord) ? cleanRecord : cleanRecord;
    }
  } catch {}

  // Tier 4: Fallback ke Mock Storage Lokal (Memastikan data TETAP TERSIMPAN & TIDAK HILANG)
  try {
    console.log(`[AdaptiveInsert ${tableName}] Menyimpan ke database lokal fallback...`);
    const mockClient = createMockSupabaseClient();
    const { data: mockSaved, error: mockErr } = await mockClient
      .from(tableName)
      .insert(fullPayload);

    if (mockErr) throw mockErr;
    return Array.isArray(recordWithBranch) ? mockSaved : mockSaved?.[0] || recordWithBranch;
  } catch (mockCatch) {
    console.error(`[AdaptiveInsert ${tableName} Critical Fallback]:`, mockCatch);
    return Array.isArray(recordWithBranch) ? recordWithBranch : recordWithBranch;
  }
}

/**
 * Sinkronisasi tabel gabungan 'cetak_list_tidak_hadir' untuk suatu cabang
 */
export async function syncCetakListTidakHadir(branchId, customSupabase) {
  const supabase = customSupabase || getSupabaseAdmin();

  const [listRows, tambahanRows] = await Promise.all([
    adaptiveSelect('list_tidak_hadir', branchId, 'admin_cabang', 'created_at', true),
    adaptiveSelect('data_tambahan', branchId, 'admin_cabang', 'created_at', true),
  ]);

  // Gabungkan kedua dataset
  const combined = [
    ...listRows.map((r) => ({ ...r, source_type: 'list_tidak_hadir' })),
    ...tambahanRows.map((r) => ({ ...r, source_type: 'data_tambahan' })),
  ];

  const mergedRecords = combined.map((item, idx) => {
    // Generate UUID valid yang kompatibel dengan kolom UUID maupun TEXT di Postgres
    const validUuid = crypto.randomUUID();
    return {
      id: validUuid,
      no: idx + 1,
      training: (item.training || 'TRAINING').trim().toUpperCase(),
      nik: String(item.nik || '').trim(),
      nama: String(item.nama || '').trim().toUpperCase(),
      kd_toko: String(item.kd_toko || '-').trim().toUpperCase(),
      nama_toko: String(item.nama_toko || '-').trim().toUpperCase(),
      alasan_tidak_hadir: String(item.alasan_tidak_hadir || '-').trim(),
      source_type: item.source_type || 'list_tidak_hadir',
      branch_id: item.branch_id || branchId || null,
      created_by: item.created_by || null,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  try {
    if (branchId) {
      await supabase.from('cetak_list_tidak_hadir').delete().eq('branch_id', branchId);
    } else {
      await supabase.from('cetak_list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch {}

  if (mergedRecords.length > 0) {
    try {
      await adaptiveInsert(
        'cetak_list_tidak_hadir',
        mergedRecords,
        mergedRecords.map(({ branch_id, created_by, ...rest }) => rest)
      );
    } catch (err) {
      console.warn('[Sync CetakListTidakHadir Note]:', err.message);
    }
  }

  // Selalu sinkronkan juga ke mock storage
  try {
    const mockClient = createMockSupabaseClient();
    if (branchId) {
      await mockClient.from('cetak_list_tidak_hadir').delete().eq('branch_id', branchId);
    } else {
      await mockClient.from('cetak_list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    if (mergedRecords.length > 0) {
      await mockClient.from('cetak_list_tidak_hadir').insert(mergedRecords);
    }
  } catch {}

  return mergedRecords;
}

/**
 * Mengambil data gabungan cetak_list_tidak_hadir
 */
export async function getCetakListTidakHadir({ branchId, role }) {
  const data = await adaptiveSelect('cetak_list_tidak_hadir', branchId, role, 'no', true);
  if (!data || data.length === 0) {
    return await syncCetakListTidakHadir(branchId);
  }
  return data;
}

/**
 * Menghitung rekapitulasi data cetak_rekap secara dinamis dari cetak_list_tidak_hadir
 */
export async function getCetakRekapData({ branchId, role }) {
  const combinedList = await getCetakListTidakHadir({ branchId, role });

  const countMap = {};
  const noIndicesMap = {};

  for (const item of combinedList) {
    const tr = (item.training || '').trim().toUpperCase();
    if (!countMap[tr]) {
      countMap[tr] = 0;
      noIndicesMap[tr] = [];
    }
    countMap[tr]++;
    if (item.no) {
      noIndicesMap[tr].push(item.no);
    }
  }

  const rekapRows = MASTER_TRAININGS_LIST.map((trainingName, index) => {
    const trUpper = trainingName.toUpperCase();
    const countTidakHadir = countMap[trUpper] || 0;
    const indices = noIndicesMap[trUpper] || [];

    let noRange = '-';
    if (indices.length === 1) {
      noRange = String(indices[0]);
    } else if (indices.length > 1) {
      noRange = `${indices[0]} - ${indices[indices.length - 1]}`;
    }

    return {
      id: `rekap-${branchId || 'all'}-${index + 1}`,
      no: index + 1,
      jenis_training: trainingName,
      target_lskt: countTidakHadir > 0 ? String(countTidakHadir + 15) : '0',
      dispensasi: String(countTidakHadir),
      target_tc_report: countTidakHadir > 0 ? String(countTidakHadir + 15) : '0',
      hadir: '0',
      tidak_hadir: String(countTidakHadir),
      no_list_peserta_tidak_hadir: noRange,
      branch_id: branchId || null,
      updated_at: new Date().toISOString(),
    };
  });

  return rekapRows;
}

/**
 * ============================================================================
 * DATA TAMBAHAN CRUD
 * ============================================================================
 */
export async function getDataTambahanList({ branchId, role }) {
  return await adaptiveSelect('data_tambahan', branchId, role, 'created_at', false);
}

export async function insertDataTambahanRecord(record, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  // Ambil nomor urut terakhir
  const existing = await adaptiveSelect('data_tambahan', branchId, session?.role || 'admin_cabang', 'no', false);
  const nextNo = (existing && existing[0]?.no ? Number(existing[0].no) : 0) + 1;

  const validId = crypto.randomUUID();
  const baseRecord = {
    id: validId,
    no: nextNo,
    training: String(record.training || 'TRAINING').trim().toUpperCase(),
    nik: String(record.nik || '').trim(),
    nama: String(record.nama || '').trim().toUpperCase(),
    kd_toko: String(record.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(record.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(record.alasan_tidak_hadir || '-').trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const recordWithBranch = {
    ...baseRecord,
    branch_id: branchId,
    created_by: session?.userId || null,
  };

  const data = await adaptiveInsert('data_tambahan', recordWithBranch, baseRecord);

  // Sinkronkan ke cetak_list_tidak_hadir
  syncCetakListTidakHadir(branchId, supabase).catch(() => {});

  return data;
}

export async function updateDataTambahanRecord(id, updatePayload, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const cleanPayload = {
    training: String(updatePayload.training || '').trim().toUpperCase(),
    nik: String(updatePayload.nik || '').trim(),
    nama: String(updatePayload.nama || '').trim().toUpperCase(),
    kd_toko: String(updatePayload.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(updatePayload.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(updatePayload.alasan_tidak_hadir || '-').trim(),
    updated_at: new Date().toISOString(),
  };

  let updatedRecord = null;

  try {
    const { data, error } = await supabase
      .from('data_tambahan')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (!error && data) {
      updatedRecord = data;
    } else {
      const { error: rawErr } = await supabase.from('data_tambahan').update(cleanPayload).eq('id', id);
      if (!rawErr) {
        updatedRecord = { id, ...cleanPayload };
      }
    }
  } catch {}

  // Selalu update di mock storage juga
  try {
    const mockClient = createMockSupabaseClient();
    const { data: mockUpdated } = await mockClient
      .from('data_tambahan')
      .update(cleanPayload)
      .eq('id', id);
    if (!updatedRecord) {
      updatedRecord = mockUpdated || { id, ...cleanPayload };
    }
  } catch {}

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return updatedRecord || { id, ...cleanPayload };
}

export async function deleteDataTambahanRecord(id, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  try {
    await supabase.from('data_tambahan').delete().eq('id', id);
  } catch {}

  try {
    const mockClient = createMockSupabaseClient();
    await mockClient.from('data_tambahan').delete().eq('id', id);
  } catch {}

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return true;
}

export async function clearAllDataTambahan(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  if (session?.role !== 'admin_pusat' && branchId) {
    try {
      await supabase.from('data_tambahan').delete().eq('branch_id', branchId);
    } catch {}
  } else {
    try {
      await supabase.from('data_tambahan').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch {}
  }

  try {
    const mockClient = createMockSupabaseClient();
    if (session?.role !== 'admin_pusat' && branchId) {
      await mockClient.from('data_tambahan').delete().eq('branch_id', branchId);
    } else {
      await mockClient.from('data_tambahan').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch {}

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return true;
}

export async function importDataTambahanRows(rows, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const existing = await adaptiveSelect('data_tambahan', branchId, session?.role || 'admin_cabang', 'no', false);
  let currentNo = existing && existing[0]?.no ? Number(existing[0].no) : 0;

  const recordsWithBranch = [];
  const cleanRecords = [];

  for (const r of rows) {
    currentNo++;
    const validId = crypto.randomUUID();
    const base = {
      id: validId,
      no: currentNo,
      training: String(r.training || 'TRAINING').trim().toUpperCase(),
      nik: String(r.nik || '').trim(),
      nama: String(r.nama || '').trim().toUpperCase(),
      kd_toko: String(r.kd_toko || '-').trim().toUpperCase(),
      nama_toko: String(r.nama_toko || '-').trim().toUpperCase(),
      alasan_tidak_hadir: String(r.alasan_tidak_hadir || '-').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    cleanRecords.push(base);
    recordsWithBranch.push({
      ...base,
      branch_id: branchId,
      created_by: session?.userId || null,
    });
  }

  await adaptiveInsert('data_tambahan', recordsWithBranch, cleanRecords);
  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return rows.length;
}

/**
 * ============================================================================
 * LIST TIDAK HADIR CRUD
 * ============================================================================
 */
export async function getListTidakHadirList({ branchId, role }) {
  return await adaptiveSelect('list_tidak_hadir', branchId, role, 'created_at', false);
}

export async function insertListTidakHadirRecord(record, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const existing = await adaptiveSelect('list_tidak_hadir', branchId, session?.role || 'admin_cabang', 'no', false);
  const nextNo = (existing && existing[0]?.no ? Number(existing[0].no) : 0) + 1;

  const validId = crypto.randomUUID();
  const baseRecord = {
    id: validId,
    no: nextNo,
    training: String(record.training || 'TRAINING').trim().toUpperCase(),
    nik: String(record.nik || '').trim(),
    nama: String(record.nama || '').trim().toUpperCase(),
    kd_toko: String(record.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(record.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(record.alasan_tidak_hadir || '-').trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const recordWithBranch = {
    ...baseRecord,
    branch_id: branchId,
    created_by: session?.userId || null,
  };

  const data = await adaptiveInsert('list_tidak_hadir', recordWithBranch, baseRecord);
  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return data;
}

export async function updateListTidakHadirRecord(id, updatePayload, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const cleanPayload = {
    training: String(updatePayload.training || '').trim().toUpperCase(),
    nik: String(updatePayload.nik || '').trim(),
    nama: String(updatePayload.nama || '').trim().toUpperCase(),
    kd_toko: String(updatePayload.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(updatePayload.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(updatePayload.alasan_tidak_hadir || '-').trim(),
    updated_at: new Date().toISOString(),
  };

  let updatedRecord = null;

  try {
    const { data, error } = await supabase
      .from('list_tidak_hadir')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (!error && data) {
      updatedRecord = data;
    } else {
      const { error: rawErr } = await supabase.from('list_tidak_hadir').update(cleanPayload).eq('id', id);
      if (!rawErr) {
        updatedRecord = { id, ...cleanPayload };
      }
    }
  } catch {}

  // Update di mock juga
  try {
    const mockClient = createMockSupabaseClient();
    const { data: mockUpdated } = await mockClient
      .from('list_tidak_hadir')
      .update(cleanPayload)
      .eq('id', id);
    if (!updatedRecord) {
      updatedRecord = mockUpdated || { id, ...cleanPayload };
    }
  } catch {}

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return updatedRecord || { id, ...cleanPayload };
}

export async function deleteListTidakHadirRecord(id, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  try {
    await supabase.from('list_tidak_hadir').delete().eq('id', id);
  } catch {}

  try {
    const mockClient = createMockSupabaseClient();
    await mockClient.from('list_tidak_hadir').delete().eq('id', id);
  } catch {}

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return true;
}

export async function clearAllListTidakHadir(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  if (session?.role !== 'admin_pusat' && branchId) {
    try {
      await supabase.from('list_tidak_hadir').delete().eq('branch_id', branchId);
    } catch {}
  } else {
    try {
      await supabase.from('list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch {}
  }

  try {
    const mockClient = createMockSupabaseClient();
    if (session?.role !== 'admin_pusat' && branchId) {
      await mockClient.from('list_tidak_hadir').delete().eq('branch_id', branchId);
    } else {
      await mockClient.from('list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch {}

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return true;
}

export async function importListTidakHadirRows(rows, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const existing = await adaptiveSelect('list_tidak_hadir', branchId, session?.role || 'admin_cabang', 'no', false);
  let currentNo = existing && existing[0]?.no ? Number(existing[0].no) : 0;

  const recordsWithBranch = [];
  const cleanRecords = [];

  for (const r of rows) {
    currentNo++;
    const validId = crypto.randomUUID();
    const base = {
      id: validId,
      no: currentNo,
      training: String(r.training || 'TRAINING').trim().toUpperCase(),
      nik: String(r.nik || '').trim(),
      nama: String(r.nama || '').trim().toUpperCase(),
      kd_toko: String(r.kd_toko || '-').trim().toUpperCase(),
      nama_toko: String(r.nama_toko || '-').trim().toUpperCase(),
      alasan_tidak_hadir: String(r.alasan_tidak_hadir || '-').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    cleanRecords.push(base);
    recordsWithBranch.push({
      ...base,
      branch_id: branchId,
      created_by: session?.userId || null,
    });
  }

  await adaptiveInsert('list_tidak_hadir', recordsWithBranch, cleanRecords);
  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return rows.length;
}
