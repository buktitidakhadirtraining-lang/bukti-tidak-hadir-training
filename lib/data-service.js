// lib/data-service.js
// Service data lokal/Supabase adaptif & terisolasi per Cabang
// Dilengkapi mekanisme Auto-Fallback jika kolom 'branch_id' belum dibuat di Supabase

import { getSupabaseAdmin } from './supabase.js';
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
 * Helper untuk mendeteksi apakah error adalah karena kolom branch_id belum ada di tabel Supabase
 */
function isBranchIdMissingError(err) {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('branch_id') ||
    msg.includes('schema cache') ||
    msg.includes('column data_tambahan') ||
    msg.includes('column list_tidak_hadir') ||
    msg.includes('column cetak_list_tidak_hadir') ||
    err.code === '42703' ||
    err.code === 'PGRST204'
  );
}

/**
 * SELECT adaptif: Coba filter branch_id, jika kolom belum ada di DB Supabase, fallback select semua
 */
async function adaptiveSelect(tableName, branchId, role, orderBy = 'created_at', ascending = false) {
  const supabase = getSupabaseAdmin();

  if (role !== 'admin_pusat' && branchId) {
    // 1. Coba query dengan filter branch_id
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('branch_id', branchId)
        .order(orderBy, { ascending });

      if (!error) return data || [];
      if (!isBranchIdMissingError(error)) {
        console.warn(`[AdaptiveSelect ${tableName}] Error:`, error.message);
      }
    } catch (e) {
      if (!isBranchIdMissingError(e)) console.warn(`[AdaptiveSelect ${tableName} Exception]:`, e);
    }
  }

  // 2. Fallback: query tanpa filter branch_id
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderBy, { ascending });

    if (error) {
      console.error(`[AdaptiveSelect ${tableName} Fallback Error]:`, error);
      return [];
    }

    const rows = data || [];
    // Jika data ternyata memiliki properti branch_id di row, filter di memory
    if (branchId && role !== 'admin_pusat') {
      const hasAnyBranchField = rows.some((r) => r.branch_id !== undefined && r.branch_id !== null);
      if (hasAnyBranchField) {
        return rows.filter((r) => String(r.branch_id) === String(branchId));
      }
    }
    return rows;
  } catch (fallbackErr) {
    console.error(`[AdaptiveSelect ${tableName} Final Catch]:`, fallbackErr);
    return [];
  }
}

/**
 * INSERT adaptif: Coba insert dengan branch_id & created_by, jika kolom belum ada, fallback tanpa kolom tersebut
 */
async function adaptiveInsert(tableName, recordWithBranch, cleanRecord) {
  const supabase = getSupabaseAdmin();

  // 1. Coba insert dengan branch_id
  try {
    const { data, error } = await supabase
      .from(tableName)
      .insert(Array.isArray(recordWithBranch) ? recordWithBranch : [recordWithBranch])
      .select();

    if (!error) {
      return Array.isArray(recordWithBranch) ? data : data?.[0] || recordWithBranch;
    }

    if (!isBranchIdMissingError(error)) {
      throw error;
    }
  } catch (err) {
    if (!isBranchIdMissingError(err)) {
      throw err;
    }
  }

  // 2. Fallback: insert tanpa kolom branch_id & created_by
  const fallbackPayload = Array.isArray(cleanRecord) ? cleanRecord : [cleanRecord];
  const { data: fallbackData, error: fallbackError } = await supabase
    .from(tableName)
    .insert(fallbackPayload)
    .select();

  if (fallbackError) {
    // Coba insert tanpa .select() jika select juga gagal
    const { error: rawError } = await supabase.from(tableName).insert(fallbackPayload);
    if (rawError) throw new Error(rawError.message || JSON.stringify(rawError));
    return Array.isArray(cleanRecord) ? cleanRecord : cleanRecord;
  }

  return Array.isArray(cleanRecord) ? fallbackData : fallbackData?.[0] || cleanRecord;
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
    id: `clth-${item.branch_id || branchId || 'all'}-${idx + 1}-${item.nik}`,
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
      await supabase.from('cetak_list_tidak_hadir').delete().eq('branch_id', branchId).catch(() => {});
    } else {
      await supabase.from('cetak_list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000').catch(() => {});
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
 * DATA TAMBAHAN CRUD
 */
export async function getDataTambahanList({ branchId, role }) {
  return await adaptiveSelect('data_tambahan', branchId, role, 'created_at', false);
}

export async function insertDataTambahanRecord(record, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  // Ambil nomor urut terakhir
  const existing = await adaptiveSelect('data_tambahan', branchId, session.role, 'no', false);
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
    created_by: session.userId || null,
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

  let { data, error } = await supabase
    .from('data_tambahan')
    .update(cleanPayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const { error: rawErr } = await supabase
      .from('data_tambahan')
      .update(cleanPayload)
      .eq('id', id);
    if (rawErr) throw new Error(rawErr.message);
    data = { id, ...cleanPayload };
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return data;
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

  let success = false;
  if (session.role !== 'admin_pusat' && branchId) {
    try {
      const { error } = await supabase.from('data_tambahan').delete().eq('branch_id', branchId);
      if (!error) success = true;
    } catch {}
  }

  if (!success) {
    const { error } = await supabase.from('data_tambahan').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(error.message);
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return true;
}

export async function importDataTambahanRows(rows, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const existing = await adaptiveSelect('data_tambahan', branchId, session.role, 'no', false);
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
      created_by: session.userId || null,
    });
  }

  await adaptiveInsert('data_tambahan', recordsWithBranch, cleanRecords);
  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return rows.length;
}

/**
 * LIST TIDAK HADIR CRUD
 */
export async function getListTidakHadirList({ branchId, role }) {
  return await adaptiveSelect('list_tidak_hadir', branchId, role, 'created_at', false);
}

export async function insertListTidakHadirRecord(record, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const existing = await adaptiveSelect('list_tidak_hadir', branchId, session.role, 'no', false);
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
    created_by: session.userId || null,
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

  let { data, error } = await supabase
    .from('list_tidak_hadir')
    .update(cleanPayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const { error: rawErr } = await supabase
      .from('list_tidak_hadir')
      .update(cleanPayload)
      .eq('id', id);
    if (rawErr) throw new Error(rawErr.message);
    data = { id, ...cleanPayload };
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return data;
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

  let success = false;
  if (session.role !== 'admin_pusat' && branchId) {
    try {
      const { error } = await supabase.from('list_tidak_hadir').delete().eq('branch_id', branchId);
      if (!error) success = true;
    } catch {}
  }

  if (!success) {
    const { error } = await supabase.from('list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(error.message);
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return true;
}

export async function importListTidakHadirRows(rows, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const existing = await adaptiveSelect('list_tidak_hadir', branchId, session.role, 'no', false);
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
      created_by: session.userId || null,
    });
  }

  await adaptiveInsert('list_tidak_hadir', recordsWithBranch, cleanRecords);
  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return rows.length;
}
