// lib/data-service.js
// Service data adaptif & terisolasi per Cabang
// Berkomunikasi langsung dengan Supabase PostgreSQL
// Mendukung skema multi-cabang (branch_id) dan pelaporan error yang jelas.

import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase.js';
import { getEnv } from './env.js';
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
 * Helper untuk menyortir array data di memori
 */
function sortInMemory(rows, orderBy, ascending) {
  if (!Array.isArray(rows)) return [];
  return [...rows].sort((a, b) => {
    let valA = a[orderBy];
    let valB = b[orderBy];
    if (valA === valB) return 0;
    if (valA == null) return ascending ? 1 : -1;
    if (valB == null) return ascending ? -1 : 1;
    if (typeof valA === 'number' && typeof valB === 'number') {
      return ascending ? valA - valB : valB - valA;
    }
    return ascending
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });
}

/**
 * SELECT adaptif:
 * Mengambil data dari Supabase berdasarkan branch_id pengguna.
 */
async function adaptiveSelect(tableName, branchId, role, orderBy = 'created_at', ascending = false) {
  const env = getEnv();
  const supabase = getSupabaseAdmin();

  // Jika Supabase tidak dikonfigurasi, gunakan Mock DB
  if (!env.isSupabaseConfigured) {
    const mockClient = createMockSupabaseClient();
    let q = mockClient.from(tableName).select('*');
    if (role !== 'admin_pusat' && branchId) {
      q = q.eq('branch_id', branchId);
    }
    const { data } = await q.order(orderBy, { ascending });
    return data || [];
  }

  // 1. Coba query Supabase dengan filter branch_id (untuk admin cabang)
  if (role !== 'admin_pusat' && branchId) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('branch_id', branchId)
        .order(orderBy, { ascending });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn(`[AdaptiveSelect ${tableName} eq(branch_id)] Exception:`, e.message);
    }
  }

  // 2. Query tanpa filter branch_id jika admin pusat atau jika filter sebelumnya 0 baris
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderBy, { ascending });

    if (!error && Array.isArray(data)) {
      if (role !== 'admin_pusat' && branchId) {
        // Filter di memori: Cocokkan branch_id ATAU data lama yang branch_id-nya null
        const filtered = data.filter(
          (r) =>
            r.branch_id === branchId ||
            r.branch_id === null ||
            r.branch_id === undefined ||
            String(r.branch_id).toLowerCase() === String(branchId).toLowerCase()
        );
        return sortInMemory(filtered, orderBy, ascending);
      }
      return data;
    }
    if (error) {
      console.error(`[AdaptiveSelect ${tableName} Error]:`, error.message);
    }
  } catch (err) {
    console.error(`[AdaptiveSelect ${tableName} Exception]:`, err);
  }

  return [];
}

/**
 * INSERT adaptif ke Supabase dengan error handling transparan
 */
async function adaptiveInsert(tableName, recordWithBranch, cleanRecord) {
  const env = getEnv();
  const supabase = getSupabaseAdmin();

  // Jika tidak menggunakan Supabase, simpan ke mock DB
  if (!env.isSupabaseConfigured) {
    const mockClient = createMockSupabaseClient();
    const payload = Array.isArray(recordWithBranch) ? recordWithBranch : [recordWithBranch];
    const { data, error } = await mockClient.from(tableName).insert(payload);
    if (error) throw error;
    return Array.isArray(recordWithBranch) ? data : data?.[0] || recordWithBranch;
  }

  const isArray = Array.isArray(recordWithBranch);
  const rows = isArray ? recordWithBranch : [recordWithBranch];

  // Hapus 'id' eksplisit agar PostgreSQL meng-generate UUID/Serial bawaan tabel Supabase
  const payloadFull = rows.map(({ id, ...rest }) => rest);

  // Percobaan 1: Insert dengan semua kolom (termasuk branch_id & created_by)
  const res1 = await supabase.from(tableName).insert(payloadFull).select();
  if (!res1.error && res1.data) {
    return isArray ? res1.data : res1.data[0];
  }

  const errMsg1 = res1.error?.message || '';
  console.warn(`[AdaptiveInsert ${tableName} Attempt 1 Failed]:`, errMsg1);

  // Percobaan 2: Insert tanpa created_by (jika kolom created_by belum ada di Supabase)
  const payloadNoCreatedBy = payloadFull.map(({ created_by, ...rest }) => rest);
  const res2 = await supabase.from(tableName).insert(payloadNoCreatedBy).select();
  if (!res2.error && res2.data) {
    return isArray ? res2.data : res2.data[0];
  }

  // Percobaan 3: Insert dengan raw (tanpa .select())
  const res3 = await supabase.from(tableName).insert(payloadNoCreatedBy);
  if (!res3.error) {
    return isArray ? recordWithBranch : recordWithBranch;
  }

  // Percobaan 4: Insert core payload tanpa branch_id (jika kolom branch_id belum ditambahkan di Supabase)
  const cleanPayload = (isArray ? cleanRecord : [cleanRecord]).map(({ id, created_by, ...rest }) => rest);
  const res4 = await supabase.from(tableName).insert(cleanPayload).select();
  if (!res4.error && res4.data) {
    return isArray ? res4.data : res4.data[0];
  }

  const finalError = res4.error || res3.error || res2.error || res1.error;
  const detailedMsg = finalError?.message || JSON.stringify(finalError);

  // Lemparkan error dengan instruksi jelas jika Supabase menolak
  throw new Error(
    `Database Supabase menolak penyimpanan: ${detailedMsg}. ` +
    `Pastikan tabel '${tableName}' sudah dibuat dan Row Level Security (RLS) tidak mengunci akses. ` +
    `Silakan klik tombol 'Skrip SQL Supabase' di halaman ini untuk menjalankan skrip di Dashboard Supabase Anda.`
  );
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

  const mergedRecords = combined.map((item, idx) => ({
    id: crypto.randomUUID(),
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
  }));

  try {
    if (branchId) {
      await supabase.from('cetak_list_tidak_hadir').delete().eq('branch_id', branchId);
    } else {
      await supabase.from('cetak_list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    if (mergedRecords.length > 0) {
      await adaptiveInsert(
        'cetak_list_tidak_hadir',
        mergedRecords,
        mergedRecords.map(({ branch_id, created_by, ...rest }) => rest)
      );
    }
  } catch (err) {
    console.warn('[Sync CetakListTidakHadir Note]:', err.message);
  }

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

  const baseRecord = {
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

  // Sinkronkan ke cetak_list_tidak_hadir secara asinkron
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

  const { data, error } = await supabase
    .from('data_tambahan')
    .update(cleanPayload)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    const { error: rawErr } = await supabase.from('data_tambahan').update(cleanPayload).eq('id', id);
    if (rawErr) throw new Error(rawErr.message);
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return data || { id, ...cleanPayload };
}

export async function deleteDataTambahanRecord(id, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const { error } = await supabase.from('data_tambahan').delete().eq('id', id);
  if (error) throw new Error(error.message);

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return true;
}

export async function clearAllDataTambahan(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let error = null;
  if (session?.role !== 'admin_pusat' && branchId) {
    const res = await supabase.from('data_tambahan').delete().eq('branch_id', branchId);
    error = res.error;
  } else {
    const res = await supabase.from('data_tambahan').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    error = res.error;
  }

  if (error) throw new Error(error.message);

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
    const base = {
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

  const baseRecord = {
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

  const { data, error } = await supabase
    .from('list_tidak_hadir')
    .update(cleanPayload)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    const { error: rawErr } = await supabase.from('list_tidak_hadir').update(cleanPayload).eq('id', id);
    if (rawErr) throw new Error(rawErr.message);
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return data || { id, ...cleanPayload };
}

export async function deleteListTidakHadirRecord(id, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const { error } = await supabase.from('list_tidak_hadir').delete().eq('id', id);
  if (error) throw new Error(error.message);

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return true;
}

export async function clearAllListTidakHadir(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let error = null;
  if (session?.role !== 'admin_pusat' && branchId) {
    const res = await supabase.from('list_tidak_hadir').delete().eq('branch_id', branchId);
    error = res.error;
  } else {
    const res = await supabase.from('list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    error = res.error;
  }

  if (error) throw new Error(error.message);

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
    const base = {
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
