// lib/sheets.js
// Sinkronisasi data Google Sheets <-> Supabase Database secara live time
import { getSupabaseAdmin } from './supabase.js';
import { SPREADSHEET_ID, SPREADSHEET_URL } from './config.js';

export { SPREADSHEET_ID, SPREADSHEET_URL };

/**
 * Parser CSV tangguh untuk menangani baris baru & kutip ganda
 */
export function parseCSV(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const result = [];

  for (const line of lines) {
    const row = [];
    let insideQuotes = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (c === ',' && !insideQuotes) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += c;
      }
    }
    row.push(entry.trim());
    result.push(row);
  }
  return result;
}

/**
 * Mengambil data CSV dari sheet tertentu di Google Spreadsheet
 */
export async function fetchSheetCSV(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });

  if (!res.ok) {
    throw new Error(`Gagal mengambil data sheet ${sheetName}: HTTP ${res.status}`);
  }

  const csvText = await res.text();
  return parseCSV(csvText);
}

/**
 * Sinkronisasi data dari Google Spreadsheet ke Supabase:
 * 1. Sheet 'cetak_rekap' -> Tabel 'cetak_rekap'
 * 2. Sheet 'list_tidak_hadir' -> Tabel 'list_tidak_hadir'
 * 3. Sheet 'list_soft_skill' -> Tabel 'list_soft_skill'
 * 4. Data input baru di Supabase -> Otomatis dicatat ke tabel 'data_tambahan'
 */
export async function syncSpreadsheetData() {
  const supabase = getSupabaseAdmin();
  const summary = {
    syncedAt: new Date().toISOString(),
    rekapCount: 0,
    listCount: 0,
    softSkillCount: 0,
    dataTambahanCount: 0,
    errors: [],
  };

  // 1. Sinkronisasi Sheet 'cetak_rekap'
  try {
    const rekapRows = await fetchSheetCSV('cetak_rekap');
    if (rekapRows.length > 0) {
      const rekapRecords = [];
      for (let i = 1; i < rekapRows.length; i++) {
        const row = rekapRows[i];
        const trainingName = (row[1] || '').trim();
        if (!trainingName) continue;

        rekapRecords.push({
          no: parseInt(row[0], 10) || i,
          jenis_training: trainingName,
          target_lskt: row[2] || '0',
          dispensasi: row[3] || '0',
          target_tc_report: row[4] || '',
          hadir: row[5] || '',
          tidak_hadir: row[6] || '',
          no_list_peserta_tidak_hadir: row[7] || '',
          updated_at: new Date().toISOString(),
        });
      }

      if (rekapRecords.length > 0) {
        await supabase.from('cetak_rekap').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: insErr } = await supabase.from('cetak_rekap').insert(rekapRecords);
        if (insErr) {
          console.error('[Sync] Gagal insert cetak_rekap:', insErr);
          summary.errors.push(`cetak_rekap: ${insErr.message || JSON.stringify(insErr)}`);
        } else {
          summary.rekapCount = rekapRecords.length;
        }
      }
    }
  } catch (err) {
    console.error('[Sync] Error syncing cetak_rekap:', err);
    summary.errors.push(`cetak_rekap: ${err.message}`);
  }

  // 2. Sinkronisasi Sheet 'list_tidak_hadir'
  try {
    const listRows = await fetchSheetCSV('list_tidak_hadir');
    if (listRows.length > 0) {
      const listRecords = [];
      for (let i = 1; i < listRows.length; i++) {
        const row = listRows[i];
        const training = (row[1] || '').trim();
        const nik = (row[2] || '').trim();
        const nama = (row[3] || '').trim();
        if (!training && !nik && !nama) continue;

        listRecords.push({
          no: parseInt(row[0], 10) || i,
          training: training || '-',
          nik: nik || '-',
          nama: nama || '-',
          kd_toko: (row[4] || '').trim(),
          nama_toko: (row[5] || '').trim(),
          alasan_tidak_hadir: (row[6] || '').trim(),
          updated_at: new Date().toISOString(),
        });
      }

      if (listRecords.length > 0) {
        await supabase.from('list_tidak_hadir').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: insListErr } = await supabase.from('list_tidak_hadir').insert(listRecords);
        if (insListErr) {
          console.error('[Sync] Gagal insert list_tidak_hadir:', insListErr);
          summary.errors.push(`list_tidak_hadir: ${insListErr.message || JSON.stringify(insListErr)}`);
        } else {
          summary.listCount = listRecords.length;
        }
      }
    }
  } catch (err) {
    console.error('[Sync] Error syncing list_tidak_hadir:', err);
    summary.errors.push(`list_tidak_hadir: ${err.message}`);
  }

  // 3. Sinkronisasi Sheet 'list_soft_skill' (Gambar 7 & 8)
  try {
    const softSkillRows = await fetchSheetCSV('list_soft_skill');
    if (softSkillRows.length > 0) {
      // Header: NIK, Nama, Jabatan, Kategory, Detail Alasan
      const softSkillRecords = [];
      for (let i = 1; i < softSkillRows.length; i++) {
        const row = softSkillRows[i];
        const nik = (row[0] || '').trim();
        const nama = (row[1] || '').trim();
        if (!nik && !nama) continue;

        softSkillRecords.push({
          no: i,
          nik,
          nama,
          jabatan: (row[2] || '').trim(),
          kategory: (row[3] || '').trim(),
          detail_alasan: (row[4] || '').trim(),
          updated_at: new Date().toISOString(),
        });
      }

      if (softSkillRecords.length > 0) {
        await supabase.from('list_soft_skill').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: insSsErr } = await supabase.from('list_soft_skill').insert(softSkillRecords);
        if (insSsErr) {
          console.error('[Sync] Gagal insert list_soft_skill:', insSsErr);
          summary.errors.push(`list_soft_skill: ${insSsErr.message || JSON.stringify(insSsErr)}`);
        } else {
          summary.softSkillCount = softSkillRecords.length;
        }
      }
    }
  } catch (err) {
    console.error('[Sync] Error syncing list_soft_skill:', err);
    summary.errors.push(`list_soft_skill: ${err.message}`);
  }

  // 4. Sinkronisasi Data Otomatis dari absence_records ke 'data_tambahan'
  try {
    const { data: latestAbsences } = await supabase
      .from('absence_records')
      .select(`
        id,
        nik,
        nama_peserta,
        jabatan,
        keterangan,
        created_at,
        training_types ( name ),
        absence_reasons ( name ),
        branches ( name, code )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: existingTambahan } = await supabase
      .from('data_tambahan')
      .select('source_record_id, nik, training');

    const recordedSourceIds = new Set((existingTambahan || []).map((t) => t.source_record_id).filter(Boolean));
    const recordedNiks = new Set((existingTambahan || []).map((t) => `${t.nik}_${t.training}`));

    let nextNo = (existingTambahan || []).length + 1;
    const newItems = [];

    if (Array.isArray(latestAbsences)) {
      for (const rec of latestAbsences) {
        const trainingName = rec.training_types?.name || 'TRAINING';
        const uniqueKey = `${rec.nik}_${trainingName}`;
        if (!recordedSourceIds.has(rec.id) && !recordedNiks.has(uniqueKey)) {
          newItems.push({
            no: nextNo++,
            training: trainingName,
            nik: rec.nik,
            nama: rec.nama_peserta,
            kd_toko: rec.branches?.code || rec.jabatan || '-',
            nama_toko: rec.branches?.name || 'Cabang',
            alasan_tidak_hadir: rec.absence_reasons?.name || rec.keterangan || '-',
            source_record_id: rec.id,
            created_at: rec.created_at || new Date().toISOString(),
          });
        }
      }
    }

    if (newItems.length > 0) {
      await supabase.from('data_tambahan').insert(newItems);
      summary.dataTambahanCount = newItems.length;
    }
  } catch (err) {
    console.error('[Sync] Error syncing data_tambahan:', err);
  }

  return summary;
}

/**
 * Menyimpan data tambahan baru:
 * 1. Simpan ke database Supabase tabel 'data_tambahan'
 * 2. Otomatis kirim / catat ke Google Spreadsheet sheet 'Data_tambahan'
 */
export async function insertDataTambahan({
  training,
  nik,
  nama,
  kd_toko,
  nama_toko,
  alasan_tidak_hadir,
}) {
  const supabase = getSupabaseAdmin();

  // Ambil nomor urut berikutnya
  const { data: existing } = await supabase
    .from('data_tambahan')
    .select('no')
    .order('no', { ascending: false })
    .limit(1);

  const nextNo = (existing && existing[0]?.no ? Number(existing[0].no) : 0) + 1;

  const newRecord = {
    no: nextNo,
    training: (training || '').trim(),
    nik: (nik || '').trim(),
    nama: (nama || '').trim(),
    kd_toko: (kd_toko || '').trim(),
    nama_toko: (nama_toko || '').trim(),
    alasan_tidak_hadir: (alasan_tidak_hadir || '').trim(),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('data_tambahan').insert([newRecord]);
  if (error) {
    throw new Error('Gagal menyimpan ke database Supabase: ' + (error.message || JSON.stringify(error)));
  }

  // Kirim ke Google Apps Script Web App / Webhook jika dikonfigurasi
  let gasSyncStatus = { sent: false, message: 'Belum dikonfigurasi' };
  try {
    let bridgeUrl = null;

    // 1. Coba ambil dari app_settings
    try {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'spreadsheet_bridge_url')
        .limit(1);
      if (settings && settings[0]?.value) {
        bridgeUrl = settings[0].value.trim();
      }
    } catch {}

    // 2. Coba ambil dari cabang jika belum ketemu
    if (!bridgeUrl) {
      const { data: branches } = await supabase
        .from('branches')
        .select('drive_bridge_url')
        .not('drive_bridge_url', 'is', null)
        .limit(1);

      if (branches && branches[0]?.drive_bridge_url) {
        bridgeUrl = branches[0].drive_bridge_url.trim();
      }
    }

    // 3. Coba ambil dari file config permanen di server
    if (!bridgeUrl) {
      try {
        const fs = await import('fs');
        if (fs.existsSync('/tmp/spreadsheet_bridge_config.json')) {
          const cfg = JSON.parse(fs.readFileSync('/tmp/spreadsheet_bridge_config.json', 'utf8'));
          if (cfg.bridgeUrl) bridgeUrl = cfg.bridgeUrl.trim();
        }
      } catch {}
    }

    if (bridgeUrl && bridgeUrl.startsWith('http')) {
      const payload = {
        action: 'append_data_tambahan',
        sheet: 'Data_tambahan',
        spreadsheetId: SPREADSHEET_ID,
        row: [
          newRecord.no,
          newRecord.training,
          newRecord.nik,
          newRecord.nama,
          newRecord.kd_toko,
          newRecord.nama_toko,
          newRecord.alasan_tidak_hadir,
        ],
      };

      const gasRes = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      if (gasRes.ok) {
        const gasJson = await gasRes.json().catch(() => ({ ok: true }));
        gasSyncStatus = { sent: true, success: true, response: gasJson };
      } else {
        gasSyncStatus = { sent: true, success: false, status: gasRes.status };
      }
    }
  } catch (bridgeErr) {
    console.warn('[Sync Sheet Bridge Note]:', bridgeErr.message);
    gasSyncStatus = { sent: true, success: false, error: bridgeErr.message };
  }

  return {
    ...newRecord,
    gasSyncStatus,
  };
}
