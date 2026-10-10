// lib/data-service.js
// Service data adaptif & terisolasi per Cabang
// Berkomunikasi langsung dengan Supabase PostgreSQL
// Dilengkapi Auto-Healing Schema Cache (otomatis mendeteksi dan menyesuaikan kolom yang belum ada di database).

import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase.js';
import { getEnv } from './env.js';
import { createMockSupabaseClient } from './mock-supabase.js';
import { MASTER_TRAININGS_LIST } from './trainings-master.js';

/**
 * Mendapatkan branchId & info cabang lengkap dari user session
 */
export async function resolveUserBranchInfo(session, supabaseClient) {
  if (!session) return { branchId: null, cabang: 'PUSAT' };
  const supabase = supabaseClient || getSupabaseAdmin();

  let branchId = session.branchId || null;
  let branchName = null;
  let branchCode = null;

  if (session.userId) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select(`
          branch_id,
          branches (
            name,
            code
          )
        `)
        .eq('id', session.userId)
        .maybeSingle();

      if (user) {
        if (user.branch_id) branchId = user.branch_id;
        branchName = user.branches?.name || null;
        branchCode = user.branches?.code || null;
      }
    } catch (e) {
      console.warn('resolveUserBranchInfo exception:', e.message);
    }
  }

  const cabang = branchName || branchCode || branchId || 'PUSAT';
  return { branchId, branchName, branchCode, cabang };
}

/**
 * Mendapatkan branchId efektif dari user session
 */
export async function resolveUserBranchId(session, supabaseClient) {
  if (!session) return null;
  if (session.branchId) return session.branchId;

  const info = await resolveUserBranchInfo(session, supabaseClient);
  return info.branchId;
}

/**
 * Helper untuk mengekstrak nama kolom yang hilang dari pesan error Supabase/PostgREST
 */
function extractMissingColumn(error) {
  if (!error) return null;
  const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));

  // PostgREST: "Could not find the 'updated_at' column of 'data_tambahan' in the schema cache"
  const m1 = msg.match(/Could not find the '([^']+)' column/i);
  if (m1) return m1[1];

  // Postgres: column "updated_at" of relation "data_tambahan" does not exist
  const m2 = msg.match(/column "([^"]+)" of relation/i);
  if (m2) return m2[1];

  // Postgres: column "updated_at" does not exist
  const m3 = msg.match(/column "([^"]+)" does not exist/i);
  if (m3) return m3[1];

  const m4 = msg.match(/column ([a-zA-Z0-9_]+) does not exist/i);
  if (m4) return m4[1];

  return null;
}

/**
 * Helper untuk menyortir array data di memori
 */
function sortInMemory(rows, orderBy = 'created_at', ascending = false) {
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
 * Jika sorting berdasarkan kolom tertentu (misal: created_at) belum ada di DB, fallback tanpa sorting DB.
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

      // Jika error karena kolom orderBy tidak ada di Supabase
      if (error && extractMissingColumn(error)) {
        const { data: rawData, error: rawErr } = await supabase
          .from(tableName)
          .select('*')
          .eq('branch_id', branchId);
        if (!rawErr && Array.isArray(rawData) && rawData.length > 0) {
          return sortInMemory(rawData, orderBy, ascending);
        }
      }
    } catch (e) {
      console.warn(`[AdaptiveSelect ${tableName} eq(branch_id)] Exception:`, e.message);
    }
  }

  // 2. Query tanpa filter branch_id jika admin pusat atau jika filter sebelumnya 0 baris
  try {
    let queryRes = await supabase.from(tableName).select('*').order(orderBy, { ascending });
    if (queryRes.error && extractMissingColumn(queryRes.error)) {
      queryRes = await supabase.from(tableName).select('*');
    }

    const { data, error } = queryRes;
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
      return sortInMemory(data, orderBy, ascending);
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
 * INSERT adaptif ke Supabase dengan Auto-Healing Schema
 * Otomatis menghapus kolom opsional yang belum dibuat di Supabase dan me-retry hingga berhasil.
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

  // Hapus 'id' eksplisit agar PostgreSQL meng-generate ID bawaan (UUID/Serial/Identity)
  let currentPayload = rows.map(({ id, ...rest }) => ({ ...rest }));

  for (let attempt = 0; attempt < 8; attempt++) {
    // Coba insert dengan .select()
    const res = await supabase.from(tableName).insert(currentPayload).select();
    if (!res.error && res.data) {
      return isArray ? res.data : res.data[0];
    }

    if (res.error) {
      const missingCol = extractMissingColumn(res.error);
      if (missingCol) {
        if (['foto_drive_file_id', 'foto_file_name', 'foto_mime_type', 'foto_uploaded_at'].includes(missingCol)) {
          throw new Error('Kolom foto belum ada di database, jalankan Skrip SQL Supabase');
        }
        console.warn(`[AdaptiveInsert ${tableName}] Kolom '${missingCol}' belum ada di skema Supabase. Menyesuaikan payload dan mencoba ulang...`);
        currentPayload = currentPayload.map((row) => {
          const clone = { ...row };
          delete clone[missingCol];
          return clone;
        });
        continue;
      }

      // Coba raw insert tanpa .select()
      const rawRes = await supabase.from(tableName).insert(currentPayload);
      if (!rawRes.error) {
        return isArray ? recordWithBranch : recordWithBranch;
      }

      const rawMissingCol = extractMissingColumn(rawRes.error);
      if (rawMissingCol) {
        if (['foto_drive_file_id', 'foto_file_name', 'foto_mime_type', 'foto_uploaded_at'].includes(rawMissingCol)) {
          throw new Error('Kolom foto belum ada di database, jalankan Skrip SQL Supabase');
        }
        console.warn(`[AdaptiveInsert ${tableName}] Kolom '${rawMissingCol}' belum ada di skema Supabase (raw). Menyesuaikan...`);
        currentPayload = currentPayload.map((row) => {
          const clone = { ...row };
          delete clone[rawMissingCol];
          return clone;
        });
        continue;
      }

      const finalMsg = rawRes.error?.message || res.error?.message || JSON.stringify(res.error);
      throw new Error(
        `Database Supabase menolak penyimpanan: ${finalMsg}. ` +
        `Silakan klik tombol 'Skrip SQL Supabase' di halaman ini untuk menjalankan skrip di Dashboard Supabase Anda.`
      );
    }
  }

  return isArray ? recordWithBranch : recordWithBranch;
}

/**
 * Sinkronisasi tabel gabungan 'cetak_list_tidak_hadir' untuk suatu cabang dengan DEDUPLIKASI KETAT
 */
export async function syncCetakListTidakHadir(branchId, customSupabase) {
  const supabase = customSupabase || getSupabaseAdmin();

  const [listRows, tambahanRows] = await Promise.all([
    adaptiveSelect('list_tidak_hadir', branchId, 'admin_cabang', 'created_at', true),
    adaptiveSelect('data_tambahan', branchId, 'admin_cabang', 'created_at', true),
  ]);

  // Ambil data dan pastikan tambahanRows tidak memuat duplikat dari input_utama / trigger
  const cleanTambahan = (tambahanRows || []).filter(
    (r) => r.sumber_input !== 'input_utama' && !r.source_record_id
  );

  // Gabungkan kedua dataset dan DEDUPLIKASI secara ketat (1 NIK untuk 1 jenis training)
  const seenKeys = new Set();
  const uniqueItems = [];

  for (const item of [...(listRows || []), ...cleanTambahan]) {
    const tr = String(item.training || 'TRAINING').trim().toUpperCase();
    const nik = String(item.nik || '').trim();
    if (!nik) continue;

    const dedupKey = `${tr}__${nik}`;
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      uniqueItems.push({
        ...item,
        training: tr,
        nik,
        nama: String(item.nama || '').trim().toUpperCase(),
        kd_toko: String(item.kd_toko || item.kode_toko || '-').trim().toUpperCase(),
        nama_toko: String(item.nama_toko || '-').trim().toUpperCase(),
        alasan_tidak_hadir: String(item.alasan_tidak_hadir || item.alasan || '-').trim(),
      });
    }
  }

  // Beri nomor urut berurutan yang bersih
  const mergedRecords = uniqueItems.map((item, idx) => ({
    id: crypto.randomUUID(),
    no: idx + 1,
    training: item.training,
    nik: item.nik,
    nama: item.nama,
    kd_toko: item.kd_toko,
    nama_toko: item.nama_toko,
    alasan_tidak_hadir: item.alasan_tidak_hadir,
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
 * Mengambil data gabungan cetak_list_tidak_hadir yang selalu fresh dan ter-deduplikasi
 */
export async function getCetakListTidakHadir({ branchId, role }) {
  // Selalu jalankan sinkronisasi & deduplikasi langsung agar tidak pernah terjadi data ganda
  return await syncCetakListTidakHadir(branchId);
}

/**
 * Menghitung rekapitulasi data cetak_rekap secara dinamis dari cetak_list_tidak_hadir
 * Jika sudah ada data yang diimpor/diedit langsung di tabel 'cetak_rekap', utamakan data tersebut.
 */
export async function getCetakRekapData({ branchId, role }) {
  const storedRekap = await adaptiveSelect('cetak_rekap', branchId, role, 'no', true);
  if (Array.isArray(storedRekap) && storedRekap.length > 0) {
    return storedRekap;
  }

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
  const records = await adaptiveSelect('data_tambahan', branchId, role, 'created_at', false);
  if (!Array.isArray(records)) return [];
  // Tampilkan HANYA data dengan sumber_input 'input_tambahan'
  // KECUALIKAN SECARA KETAT data yang:
  // 1. Bertag sumber_input 'input_utama'
  // 2. Memiliki source_record_id (berasal dari salinan trigger tabel absence_records)
  return records.filter((r) => {
    if (r.sumber_input === 'input_utama') return false;
    if (r.source_record_id) return false;
    return r.sumber_input === 'input_tambahan' || (!r.sumber_input && !r.source_record_id);
  });
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
    sumber_input: 'input_tambahan',
    foto_drive_file_id: record.foto_drive_file_id || null,
    foto_file_name: record.foto_file_name || null,
    foto_mime_type: record.foto_mime_type || null,
    foto_uploaded_at: record.foto_uploaded_at || (record.foto_drive_file_id ? new Date().toISOString() : null),
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

  let cleanPayload = {
    training: String(updatePayload.training || '').trim().toUpperCase(),
    nik: String(updatePayload.nik || '').trim(),
    nama: String(updatePayload.nama || '').trim().toUpperCase(),
    kd_toko: String(updatePayload.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(updatePayload.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(updatePayload.alasan_tidak_hadir || '-').trim(),
    updated_at: new Date().toISOString(),
  };

  if ('foto_drive_file_id' in updatePayload) {
    cleanPayload.foto_drive_file_id = updatePayload.foto_drive_file_id;
  }
  if ('foto_file_name' in updatePayload) {
    cleanPayload.foto_file_name = updatePayload.foto_file_name;
  }
  if ('foto_mime_type' in updatePayload) {
    cleanPayload.foto_mime_type = updatePayload.foto_mime_type;
  }
  if ('foto_uploaded_at' in updatePayload) {
    cleanPayload.foto_uploaded_at = updatePayload.foto_uploaded_at;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('data_tambahan')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (!error && data) {
      syncCetakListTidakHadir(branchId, supabase).catch(() => {});
      return data;
    }

    if (error) {
      const missingCol = extractMissingColumn(error);
      if (missingCol && cleanPayload[missingCol] !== undefined) {
        delete cleanPayload[missingCol];
        continue;
      }
      const { error: rawErr } = await supabase.from('data_tambahan').update(cleanPayload).eq('id', id);
      if (!rawErr) {
        syncCetakListTidakHadir(branchId, supabase).catch(() => {});
        return { id, ...cleanPayload };
      }
    }
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return { id, ...cleanPayload };
}

export async function deleteDataTambahanRecord(id, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  // Ambil record sebelum dihapus untuk mengetahui foto_drive_file_id
  const { data: recordToDelete } = await supabase
    .from('data_tambahan')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  // Pastikan hanya menghapus record data_tambahan dan TIDAK menghapus input_utama
  const { error } = await supabase
    .from('data_tambahan')
    .delete()
    .eq('id', id)
    .neq('sumber_input', 'input_utama');

  if (error) {
    const { error: rawErr } = await supabase.from('data_tambahan').delete().eq('id', id);
    if (rawErr) throw new Error(rawErr.message);
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return recordToDelete || true;
}

export async function clearAllDataTambahan(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  // Ambil daftar file yang memiliki foto sebelum dihapus
  let findQuery = supabase.from('data_tambahan').select('id, foto_drive_file_id, branch_id');
  if (session?.role !== 'admin_pusat' && branchId) {
    findQuery = findQuery.eq('branch_id', branchId);
  }
  findQuery = findQuery.neq('sumber_input', 'input_utama').is('source_record_id', null);
  const { data: recordsWithPhotos } = await findQuery;

  let query = supabase.from('data_tambahan').delete();
  if (session?.role !== 'admin_pusat' && branchId) {
    query = query.eq('branch_id', branchId);
  } else {
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
  }

  // Filter proteksi mutlak: HANYA hapus baris yang sumber_input != 'input_utama'
  // Dan jangan hapus baris yang memiliki source_record_id
  const { error } = await query
    .neq('sumber_input', 'input_utama')
    .is('source_record_id', null);

  if (error) {
    console.warn('[clearAllDataTambahan fallback delete warning]:', error.message);
    let fallbackQ = supabase.from('data_tambahan').delete();
    if (session?.role !== 'admin_pusat' && branchId) {
      fallbackQ = fallbackQ.eq('branch_id', branchId);
    } else {
      fallbackQ = fallbackQ.neq('id', '00000000-0000-0000-0000-000000000000');
    }
    await fallbackQ.is('source_record_id', null);
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return recordsWithPhotos || [];
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
      sumber_input: 'input_tambahan',
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

  let cleanPayload = {
    training: String(updatePayload.training || '').trim().toUpperCase(),
    nik: String(updatePayload.nik || '').trim(),
    nama: String(updatePayload.nama || '').trim().toUpperCase(),
    kd_toko: String(updatePayload.kd_toko || '-').trim().toUpperCase(),
    nama_toko: String(updatePayload.nama_toko || '-').trim().toUpperCase(),
    alasan_tidak_hadir: String(updatePayload.alasan_tidak_hadir || '-').trim(),
    updated_at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('list_tidak_hadir')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (!error && data) {
      syncCetakListTidakHadir(branchId, supabase).catch(() => {});
      return data;
    }

    if (error) {
      const missingCol = extractMissingColumn(error);
      if (missingCol && cleanPayload[missingCol] !== undefined) {
        delete cleanPayload[missingCol];
        continue;
      }
      const { error: rawErr } = await supabase.from('list_tidak_hadir').update(cleanPayload).eq('id', id);
      if (!rawErr) {
        syncCetakListTidakHadir(branchId, supabase).catch(() => {});
        return { id, ...cleanPayload };
      }
    }
  }

  syncCetakListTidakHadir(branchId, supabase).catch(() => {});
  return { id, ...cleanPayload };
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

/**
 * ============================================================================
 * REKAPAN DATA TRAINING (cetak_rekap) CRUD
 * ============================================================================
 */
export async function getRekapanTrainingList({ branchId, role }) {
  return await adaptiveSelect('cetak_rekap', branchId, role, 'no', true);
}

export async function insertRekapanTrainingRecord(record, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const existing = await adaptiveSelect('cetak_rekap', branchId, session?.role || 'admin_cabang', 'no', false);
  const nextNo = (existing && existing[0]?.no ? Number(existing[0].no) : 0) + 1;

  const baseRecord = {
    no: record.no ? Number(record.no) : nextNo,
    jenis_training: String(record.jenis_training || '').trim().toUpperCase(),
    target_lskt: String(record.target_lskt || '0').trim(),
    dispensasi: String(record.dispensasi || '0').trim(),
    target_tc_report: String(record.target_tc_report || '0').trim(),
    hadir: String(record.hadir || '0').trim(),
    tidak_hadir: String(record.tidak_hadir || '0').trim(),
    no_list_peserta_tidak_hadir: String(record.no_list_peserta_tidak_hadir || '-').trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const recordWithBranch = {
    ...baseRecord,
    branch_id: branchId,
    created_by: session?.userId || null,
  };

  return await adaptiveInsert('cetak_rekap', recordWithBranch, baseRecord);
}

export async function updateRekapanTrainingRecord(id, updatePayload, session) {
  const supabase = getSupabaseAdmin();

  let cleanPayload = {
    no: updatePayload.no ? Number(updatePayload.no) : undefined,
    jenis_training: String(updatePayload.jenis_training || '').trim().toUpperCase(),
    target_lskt: String(updatePayload.target_lskt || '0').trim(),
    dispensasi: String(updatePayload.dispensasi || '0').trim(),
    target_tc_report: String(updatePayload.target_tc_report || '0').trim(),
    hadir: String(updatePayload.hadir || '0').trim(),
    tidak_hadir: String(updatePayload.tidak_hadir || '0').trim(),
    no_list_peserta_tidak_hadir: String(updatePayload.no_list_peserta_tidak_hadir || '-').trim(),
    updated_at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('cetak_rekap')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (!error && data) return data;

    if (error) {
      const missingCol = extractMissingColumn(error);
      if (missingCol && cleanPayload[missingCol] !== undefined) {
        delete cleanPayload[missingCol];
        continue;
      }
      const { error: rawErr } = await supabase.from('cetak_rekap').update(cleanPayload).eq('id', id);
      if (!rawErr) return { id, ...cleanPayload };
    }
  }

  return { id, ...cleanPayload };
}

export async function deleteRekapanTrainingRecord(id) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('cetak_rekap').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function clearAllRekapanTraining(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let error = null;
  if (session?.role !== 'admin_pusat' && branchId) {
    const res = await supabase.from('cetak_rekap').delete().eq('branch_id', branchId);
    error = res.error;
  } else {
    const res = await supabase.from('cetak_rekap').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    error = res.error;
  }

  if (error) throw new Error(error.message);
  return true;
}

export async function importRekapanTrainingRows(rows, session) {
  const supabase = getSupabaseAdmin();
  const { cabang, branchId } = await resolveUserBranchInfo(session, supabase);

  const recordsWithBranch = [];
  const cleanRecords = [];

  let idx = 0;
  for (const r of rows) {
    idx++;
    const targetLskt = parseInt(r.target_lskt || '0', 10) || 0;
    const dispensasi = parseInt(r.dispensasi || '0', 10) || 0;
    const targetTcReport = parseInt(r.target_tc_report || '0', 10) || 0;
    const hadir = parseInt(r.hadir || '0', 10) || 0;
    const tidakHadir = parseInt(r.tidak_hadir || '0', 10) || 0;

    const base = {
      no: r.no ? Number(r.no) : idx,
      jenis_training: String(r.jenis_training || r.training || 'TRAINING').trim().toUpperCase(),
      target_lskt: targetLskt,
      dispensasi: dispensasi,
      target_tc_report: targetTcReport,
      hadir: hadir,
      tidak_hadir: tidakHadir,
      no_list_peserta_tidak_hadir: String(r.no_list_peserta_tidak_hadir || '-').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    cleanRecords.push(base);
    recordsWithBranch.push({
      ...base,
      cabang: cabang,
      branch_id: branchId || cabang,
      created_by: session?.userId || null,
    });
  }

  await adaptiveInsert('cetak_rekap', recordsWithBranch, cleanRecords);
  return rows.length;
}

/**
 * ============================================================================
 * LIST SOFT SKILL (list_soft_skill) CRUD
 * ============================================================================
 */
export async function getListSoftSkillList({ branchId, role }) {
  return await adaptiveSelect('list_soft_skill', branchId, role, 'no', true);
}

export async function insertListSoftSkillRecord(record, session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  const existing = await adaptiveSelect('list_soft_skill', branchId, session?.role || 'admin_cabang', 'no', false);
  const nextNo = (existing && existing[0]?.no ? Number(existing[0].no) : 0) + 1;

  const baseRecord = {
    no: record.no ? Number(record.no) : nextNo,
    nik: String(record.nik || '').trim(),
    nama: String(record.nama || '').trim().toUpperCase(),
    jabatan: String(record.jabatan || '-').trim(),
    kategori: String(record.kategori || record.kategory || '-').trim(),
    detail_alasan: String(record.detail_alasan || '-').trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const recordWithBranch = {
    ...baseRecord,
    branch_id: branchId,
    created_by: session?.userId || null,
  };

  return await adaptiveInsert('list_soft_skill', recordWithBranch, baseRecord);
}

export async function updateListSoftSkillRecord(id, updatePayload, session) {
  const supabase = getSupabaseAdmin();

  let cleanPayload = {
    no: updatePayload.no ? Number(updatePayload.no) : undefined,
    nik: String(updatePayload.nik || '').trim(),
    nama: String(updatePayload.nama || '').trim().toUpperCase(),
    jabatan: String(updatePayload.jabatan || '-').trim(),
    kategori: String(updatePayload.kategori || updatePayload.kategory || '-').trim(),
    detail_alasan: String(updatePayload.detail_alasan || '-').trim(),
    updated_at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('list_soft_skill')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (!error && data) return data;

    if (error) {
      const missingCol = extractMissingColumn(error);
      if (missingCol && cleanPayload[missingCol] !== undefined) {
        delete cleanPayload[missingCol];
        continue;
      }
      const { error: rawErr } = await supabase.from('list_soft_skill').update(cleanPayload).eq('id', id);
      if (!rawErr) return { id, ...cleanPayload };
    }
  }

  return { id, ...cleanPayload };
}

export async function deleteListSoftSkillRecord(id) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('list_soft_skill').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function clearAllListSoftSkill(session) {
  const supabase = getSupabaseAdmin();
  const branchId = await resolveUserBranchId(session, supabase);

  let error = null;
  if (session?.role !== 'admin_pusat' && branchId) {
    const res = await supabase.from('list_soft_skill').delete().eq('branch_id', branchId);
    error = res.error;
  } else {
    const res = await supabase.from('list_soft_skill').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    error = res.error;
  }

  if (error) throw new Error(error.message);
  return true;
}

export async function importListSoftSkillRows(rows, session) {
  const supabase = getSupabaseAdmin();
  const { cabang, branchId } = await resolveUserBranchInfo(session, supabase);

  const existing = await adaptiveSelect('list_soft_skill', branchId, session?.role || 'admin_cabang', 'no', false);
  let currentNo = existing && existing[0]?.no ? Number(existing[0].no) : 0;

  const recordsWithBranch = [];
  const cleanRecords = [];

  for (const r of rows) {
    currentNo++;
    const rawNik = String(r.nik != null ? r.nik : '').trim();

    const base = {
      no: r.no ? Number(r.no) : currentNo,
      nik: rawNik,
      nama: String(r.nama || '').trim().toUpperCase(),
      jabatan: String(r.jabatan || '-').trim(),
      kategory: String(r.kategory || r.kategori || '-').trim(),
      kategori: String(r.kategory || r.kategori || '-').trim(),
      detail_alasan: String(r.detail_alasan || '-').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    cleanRecords.push(base);
    recordsWithBranch.push({
      ...base,
      cabang: cabang,
      branch_id: branchId || cabang,
      created_by: session?.userId || null,
    });
  }

  await adaptiveInsert('list_soft_skill', recordsWithBranch, cleanRecords);
  return rows.length;
}
