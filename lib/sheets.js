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
    // Hindari cache agar selalu live
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
 * 3. Data input baru di Supabase -> Otomatis dicatat ke tabel 'data_tambahan'
 */
export async function syncSpreadsheetData() {
  const supabase = getSupabaseAdmin();
  const summary = {
    syncedAt: new Date().toISOString(),
    rekapCount: 0,
    listCount: 0,
    dataTambahanCount: 0,
    errors: [],
  };

  // 1. Sinkronisasi Sheet 'cetak_rekap'
  try {
    const rekapRows = await fetchSheetCSV('cetak_rekap');
    if (rekapRows.length > 0) {
      // Header: NO, JENIS TRAINING, TARGET LSKT, DISPENSASI, TARGET TC REPORT, HADIR, TIDAK HADIR, NO LIST PESERTA TIDAK HADIR
      // Data mulai baris 1
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
        // Hapus data lama dan gantikan dengan data terkini dari sheet
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
      // Header ada di baris 0: NO, TRAINING, NIK, NAMA, KD TOKO, NAMA TOKO, ALASAN TIDAK HADIR
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

  // 3. Sinkronisasi Data Baru ke Sheet 'data_tambahan'
  // Jika ada data di absence_records yang belum tercatat di data_tambahan, catat otomatis
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
