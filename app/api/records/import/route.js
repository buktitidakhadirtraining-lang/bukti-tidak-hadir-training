// app/api/records/import/route.js
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { auditLog } from '../../../../lib/audit.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file !== 'object') {
      return NextResponse.json({ ok: false, error: 'File Excel (.xlsx) atau CSV wajib dipilih' }, { status: 400 });
    }

    const fileName = file.name || '';
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv') || file.type === 'text/csv';

    if (!isXlsx && !isCsv) {
      return NextResponse.json(
        { ok: false, error: 'Format berkas tidak didukung. Harap unggah berkas berekstensi .xlsx atau .csv' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabaseAdmin();

    // Ambil master data untuk mapping
    const [branchesRes, trainingsRes, reasonsRes] = await Promise.all([
      supabase.from('branches').select('id, name, code'),
      supabase.from('training_types').select('id, name'),
      supabase.from('absence_reasons').select('id, name'),
    ]);

    const branches = branchesRes.data || [];
    const trainings = trainingsRes.data || [];
    const reasons = reasonsRes.data || [];

    // Map pencarian case-insensitive
    const branchMap = new Map();
    branches.forEach((b) => {
      branchMap.set(b.code.toUpperCase(), b.id);
      branchMap.set(b.name.toUpperCase(), b.id);
    });

    const trainingMap = new Map();
    trainings.forEach((t) => {
      trainingMap.set(t.name.toUpperCase(), t.id);
    });

    const reasonMap = new Map();
    reasons.forEach((r) => {
      reasonMap.set(r.name.toUpperCase(), r.id);
    });

    let rawRows = [];

    if (isXlsx) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        return NextResponse.json({ ok: false, error: 'Berkas Excel kosong' }, { status: 400 });
      }

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const values = row.values;
          // ExcelJS rows are 1-indexed, values[1] = col A, values[2] = col B, etc.
          rawRows.push({
            rowNumber,
            nik: String(values[1] || '').trim(),
            nama_peserta: String(values[2] || '').trim(),
            jabatan: String(values[3] || '').trim(),
            training: String(values[4] || '').trim(),
            batch: String(values[5] || '').trim(),
            tanggal: values[6] instanceof Date ? values[6].toISOString().split('T')[0] : String(values[6] || '').trim(),
            cabang: String(values[7] || '').trim(),
            alasan: String(values[8] || '').trim(),
            keterangan: String(values[9] || '').trim(),
          });
        }
      });
    } else {
      const text = fileBuffer.toString('utf-8');
      const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });
      const rows = parsed.data || [];
      rows.slice(1).forEach((r, idx) => {
        rawRows.push({
          rowNumber: idx + 2,
          nik: String(r[0] || '').trim(),
          nama_peserta: String(r[1] || '').trim(),
          jabatan: String(r[2] || '').trim(),
          training: String(r[3] || '').trim(),
          batch: String(r[4] || '').trim(),
          tanggal: String(r[5] || '').trim(),
          cabang: String(r[6] || '').trim(),
          alasan: String(r[7] || '').trim(),
          keterangan: String(r[8] || '').trim(),
        });
      });
    }

    if (rawRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Tidak ada baris data yang ditemukan dalam berkas' },
        { status: 400 }
      );
    }

    // Siapkan query pengecekan data ganda terhadap database
    const candidateNiks = [...new Set(rawRows.map((r) => r.nik).filter((n) => /^\d{8,16}$/.test(n)))];
    const candidateBranches =
      session.role === 'admin_pusat'
        ? [...new Set(rawRows.map((r) => branchMap.get(r.cabang?.toUpperCase())).filter(Boolean))]
        : [session.branchId];
    const candidateTrainings = [
      ...new Set(rawRows.map((r) => trainingMap.get(r.training?.toUpperCase())).filter(Boolean)),
    ];
    const candidateDates = [
      ...new Set(rawRows.map((r) => r.tanggal).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))),
    ];

    const existingDbKeys = new Set();
    if (
      candidateBranches.length > 0 &&
      candidateNiks.length > 0 &&
      candidateTrainings.length > 0 &&
      candidateDates.length > 0
    ) {
      const { data: dbRecords } = await supabase
        .from('absence_records')
        .select('branch_id, nik, training_id, tanggal_pelaksanaan')
        .in('branch_id', candidateBranches)
        .in('nik', candidateNiks)
        .in('training_id', candidateTrainings)
        .in('tanggal_pelaksanaan', candidateDates);

      if (dbRecords && dbRecords.length > 0) {
        dbRecords.forEach((d) => {
          existingDbKeys.add(
            `${d.branch_id}|${d.nik.trim().toUpperCase()}|${d.training_id}|${d.tanggal_pelaksanaan}`
          );
        });
      }
    }

    const errors = [];
    const validRecords = [];
    const seenInFile = new Set();

    rawRows.forEach((r) => {
      // Lewati baris kosong total
      if (!r.nik && !r.nama_peserta) return;

      const rowErrors = [];

      if (!r.nik || !/^\d{8,16}$/.test(r.nik)) {
        rowErrors.push('NIK harus 8-16 digit angka');
      }

      if (!r.nama_peserta) {
        rowErrors.push('Nama peserta wajib diisi');
      }

      if (!r.jabatan) {
        rowErrors.push('Jabatan wajib diisi');
      }

      const trainingId = trainingMap.get(r.training.toUpperCase());
      if (!trainingId) {
        rowErrors.push(`Jenis training "${r.training}" tidak ditemukan dalam master training`);
      }

      const batchNum = parseInt(r.batch, 10);
      if (isNaN(batchNum) || batchNum <= 0) {
        rowErrors.push('Batch harus berupa angka positif');
      }

      if (!r.tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(r.tanggal)) {
        rowErrors.push('Format tanggal tidak valid (gunakan YYYY-MM-DD)');
      }

      let branchId = null;
      if (session.role === 'admin_pusat') {
        branchId = branchMap.get(r.cabang.toUpperCase());
        if (!branchId) {
          rowErrors.push(`Cabang "${r.cabang}" tidak ditemukan dalam sistem`);
        }
      } else {
        branchId = session.branchId;
      }

      const reasonId = reasonMap.get(r.alasan.toUpperCase());
      if (!reasonId) {
        rowErrors.push(`Alasan "${r.alasan}" tidak ditemukan dalam master alasan`);
      }

      // ATURAN DATA GANDA: Cek duplikasi (cabang + NIK + training + tanggal_pelaksanaan)
      // Deteksi ganda terhadap database DAN antar baris dalam file yang sama
      if (
        branchId &&
        trainingId &&
        r.nik &&
        /^\d{8,16}$/.test(r.nik) &&
        r.tanggal &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.tanggal)
      ) {
        const uniqueKey = `${branchId}|${r.nik.toUpperCase()}|${trainingId}|${r.tanggal}`;

        if (seenInFile.has(uniqueKey)) {
          rowErrors.push('Data untuk NIK ini pada training dan tanggal tersebut sudah ada dalam berkas ini');
        } else {
          seenInFile.add(uniqueKey);
        }

        if (existingDbKeys.has(uniqueKey)) {
          rowErrors.push('Data untuk NIK ini pada training dan tanggal tersebut sudah ada.');
        }
      }

      if (rowErrors.length > 0) {
        errors.push({
          rowNumber: r.rowNumber,
          nik: r.nik,
          name: r.nama_peserta,
          message: rowErrors.join(', '),
        });
      } else {
        validRecords.push({
          nik: r.nik,
          nama_peserta: r.nama_peserta,
          jabatan: r.jabatan,
          training_id: trainingId,
          batch: batchNum,
          tanggal_pelaksanaan: r.tanggal,
          branch_id: branchId,
          alasan_id: reasonId,
          keterangan: r.keterangan || null,
          created_by: session.userId,
        });
      }
    });

    if (validRecords.length === 0) {
      const isAllDuplicate =
        errors.length > 0 && errors.every((e) => e.message.includes('sudah ada'));
      return NextResponse.json(
        {
          ok: false,
          error: isAllDuplicate
            ? 'Data untuk NIK ini pada training dan tanggal tersebut sudah ada.'
            : 'Semua baris data memiliki kesalahan dan tidak dapat diimpor.',
          totalRows: rawRows.length,
          errors,
        },
        { status: isAllDuplicate ? 409 : 400 }
      );
    }

    // Insert batch ke Supabase
    const { data: inserted, error: insertErr } = await supabase
      .from('absence_records')
      .insert(validRecords)
      .select('id');

    if (insertErr) {
      console.error('[Import Insert Error]:', insertErr);
      if (insertErr.code === '23505') {
        return NextResponse.json(
          { ok: false, error: 'Data untuk NIK ini pada training dan tanggal tersebut sudah ada.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { ok: false, error: 'Gagal menyimpan baris data ke database: ' + insertErr.message },
        { status: 500 }
      );
    }

    await auditLog(session.userId, 'IMPORT_RECORDS', {
      totalRows: rawRows.length,
      successCount: inserted.length,
      failedCount: errors.length,
    });

    return NextResponse.json({
      ok: true,
      message: `Berhasil mengimpor ${inserted.length} data ketidakhadiran.${errors.length > 0 ? ` (${errors.length} baris dilewati karena format tidak sesuai)` : ''}`,
      totalRows: rawRows.length,
      successCount: inserted.length,
      failedCount: errors.length,
      errors,
    });
  } catch (err) {
    console.error('[Import API Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem saat memproses impor' }, { status: 500 });
  }
}
