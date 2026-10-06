// lib/data-service.js
// Service data lokal/Supabase terisolasi per Cabang (Multi-tenant)
// Tanpa ketergantungan pada Google Sheets

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
    const { data: user } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', session.userId)
      .maybeSingle();
    if (user?.branch_id) return user.branch_id;
  }
  return null;
}

/**
 * Sinkronisasi tabel gabungan 'cetak_list_tidak_hadir' untuk suatu cabang
 * Menggabungkan seluruh data dari 'list_tidak_hadir' dan 'data_tambahan'
 */
export async function syncCetakListTidakHadir(branchId, customSupabase) {
  const supabase = customSupabase || getSupabaseAdmin();

  let listQuery = supabase.from('list_tidak_hadir').select('*').order('created_at', { ascending: true });
  let tambahanQuery = supabase.from('data_tambahan').select('*').order('created_at', { ascending: true });

  if (branchId) {
    listQuery = listQuery.eq('branch_id', branchId);
    tambahanQuery = tambahanQuery.eq('branch_id', branchId);
  }

  const [listRes, tambahanRes] = await Promise.all([listQuery, tambahanQuery]);
  const listRows = listRes.data || [];
  const tambahanRows = tambahanRes.data || [];

  // Gabungkan kedua dataset
  const combined = [
    ...listRows.map((r) => ({
      ...r,
      source_type: 'list_tidak_hadir',
    })),
    ...tambahanRows.map((r) => ({
      ...r,
      source_type: 'data_tambahan',
    })),
  ];

  // Berikan nomor urut sekuensial per item gabungan
  const mergedRecords = combined.map((item, idx) => ({
    id: `clth-${item.branch_id || 'all'}-${idx + 1}-${item.nik}`,
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

  // Hapus data lama di cabang ini & simpan yang baru
  if (branchId) {
    await supabase.from('cetak_list_tidak_hadir').delete().eq('branch_id', branchId);
  } else {
    await supabase.from('cetak_list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  if (mergedRecords.length > 0) {
    await supabase.from('cetak_list_tidak_hadir').insert(mergedRecords);
  }

  return mergedRecords;
}

/**
 * Mengambil data gabungan cetak_list_tidak_hadir (terisolasi per cabang)
 */
export async function getCetakListTidakHadir({ branchId, role }) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('cetak_list_tidak_hadir').select('*').order('no', { ascending: true });

  if (role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  } else if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    // Jika cetak_list_tidak_hadir masih kosong di DB, lakukan sync on-the-fly
    return await syncCetakListTidakHadir(branchId, supabase);
  }
  return data;
}

/**
 * Menghitung rekapitulasi data cetak_rekap secara dinamis dari cetak_list_tidak_hadir
 */
export async function getCetakRekapData({ branchId, role }) {
  const combinedList = await getCetakListTidakHadir({ branchId, role });
  
  // Hitung jumlah peserta tidak hadir per jenis training
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

  // Buat daftar baris rekap untuk semua master training
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
  const supabase = getSupabaseAdmin();
  let query = supabase.from('data_tambahan').select('*').order('created_at', { ascending: false });

  if (role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  } else if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function insertDataTambahanRecord(record, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  // Ambil nomor urut terakhir di cabang ini
  const { data: existing } = await supabase
    .from('data_tambahan')
    .select('no')
    .eq('branch_id', branchId || '')
    .order('no', { ascending: false })
    .limit(1);

  const nextNo = (existing && existing[0]?.no ? Number(existing[0].no) : 0) + 1;

  const newRecord = {
    no: nextNo,
    training: String(record.training || 'TRAINING').trim().toUpperCase(),
    nik: String(record.nik || '').trim(),
    nama: String(record.nama || '').trim().toUpperCase(),
    kd_toko: String(record.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(record.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(record.alasan_tidak_hadir || '-').trim(),
    branch_id: branchId,
    created_by: session.userId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('data_tambahan').insert([newRecord]).select().single();
  if (error) throw new Error(error.message);

  // Otomatis sinkronkan ke cetak_list_tidak_hadir
  await syncCetakListTidakHadir(branchId, supabase);

  return data;
}

export async function updateDataTambahanRecord(id, updatePayload, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let query = supabase.from('data_tambahan').update({
    training: String(updatePayload.training || '').trim().toUpperCase(),
    nik: String(updatePayload.nik || '').trim(),
    nama: String(updatePayload.nama || '').trim().toUpperCase(),
    kd_toko: String(updatePayload.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(updatePayload.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(updatePayload.alasan_tidak_hadir || '-').trim(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (session.role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.select().single();
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return data;
}

export async function deleteDataTambahanRecord(id, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let query = supabase.from('data_tambahan').delete().eq('id', id);
  if (session.role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return true;
}

export async function clearAllDataTambahan(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let query = supabase.from('data_tambahan').delete();
  if (session.role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  } else {
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { error } = await query;
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return true;
}

export async function importDataTambahanRows(rows, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  // Ambil nomor urut terakhir
  const { data: existing } = await supabase
    .from('data_tambahan')
    .select('no')
    .eq('branch_id', branchId || '')
    .order('no', { ascending: false })
    .limit(1);

  let currentNo = existing && existing[0]?.no ? Number(existing[0].no) : 0;

  const recordsToInsert = rows.map((r) => {
    currentNo++;
    return {
      no: currentNo,
      training: String(r.training || 'TRAINING').trim().toUpperCase(),
      nik: String(r.nik || '').trim(),
      nama: String(r.nama || '').trim().toUpperCase(),
      kd_toko: String(r.kd_toko || '-').trim().toUpperCase(),
      nama_toko: String(r.nama_toko || '-').trim().toUpperCase(),
      alasan_tidak_hadir: String(r.alasan_tidak_hadir || '-').trim(),
      branch_id: branchId,
      created_by: session.userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase.from('data_tambahan').insert(recordsToInsert);
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return recordsToInsert.length;
}

/**
 * LIST TIDAK HADIR CRUD
 */
export async function getListTidakHadirList({ branchId, role }) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('list_tidak_hadir').select('*').order('created_at', { ascending: false });

  if (role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  } else if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function insertListTidakHadirRecord(record, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const { data: existing } = await supabase
    .from('list_tidak_hadir')
    .select('no')
    .eq('branch_id', branchId || '')
    .order('no', { ascending: false })
    .limit(1);

  const nextNo = (existing && existing[0]?.no ? Number(existing[0].no) : 0) + 1;

  const newRecord = {
    no: nextNo,
    training: String(record.training || 'TRAINING').trim().toUpperCase(),
    nik: String(record.nik || '').trim(),
    nama: String(record.nama || '').trim().toUpperCase(),
    kd_toko: String(record.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(record.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(record.alasan_tidak_hadir || '-').trim(),
    branch_id: branchId,
    created_by: session.userId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('list_tidak_hadir').insert([newRecord]).select().single();
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return data;
}

export async function updateListTidakHadirRecord(id, updatePayload, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let query = supabase.from('list_tidak_hadir').update({
    training: String(updatePayload.training || '').trim().toUpperCase(),
    nik: String(updatePayload.nik || '').trim(),
    nama: String(updatePayload.nama || '').trim().toUpperCase(),
    kd_toko: String(updatePayload.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(updatePayload.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(updatePayload.alasan_tidak_hadir || '-').trim(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (session.role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.select().single();
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return data;
}

export async function deleteListTidakHadirRecord(id, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let query = supabase.from('list_tidak_hadir').delete().eq('id', id);
  if (session.role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return true;
}

export async function clearAllListTidakHadir(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let query = supabase.from('list_tidak_hadir').delete();
  if (session.role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  } else {
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { error } = await query;
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return true;
}

export async function importListTidakHadirRows(rows, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const { data: existing } = await supabase
    .from('list_tidak_hadir')
    .select('no')
    .eq('branch_id', branchId || '')
    .order('no', { ascending: false })
    .limit(1);

  let currentNo = existing && existing[0]?.no ? Number(existing[0].no) : 0;

  const recordsToInsert = rows.map((r) => {
    currentNo++;
    return {
      no: currentNo,
      training: String(r.training || 'TRAINING').trim().toUpperCase(),
      nik: String(r.nik || '').trim(),
      nama: String(r.nama || '').trim().toUpperCase(),
      kd_toko: String(r.kd_toko || '-').trim().toUpperCase(),
      nama_toko: String(r.nama_toko || '-').trim().toUpperCase(),
      alasan_tidak_hadir: String(r.alasan_tidak_hadir || '-').trim(),
      branch_id: branchId,
      created_by: session.userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase.from('list_tidak_hadir').insert(recordsToInsert);
  if (error) throw new Error(error.message);

  await syncCetakListTidakHadir(branchId, supabase);
  return recordsToInsert.length;
}
