// app/api/rekapan-training/import/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { importRekapanTrainingRows } from '../../../../lib/data-service.js';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Expected exact headers for Rekap Data
const REQUIRED_HEADERS_REKAP = [
  'NO',
  'JENIS TRAINING',
  'TARGET LSKT',
  'DISPENSASI',
  'TARGET TC REPORT',
  'HADIR',
  'TIDAK HADIR',
  'NO LIST PESERTA TIDAK HADIR',
];

function normalizeHeaderKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle direct JSON payload (e.g. from Preview confirmation modal)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.action === 'save' && Array.isArray(body.rows)) {
        if (body.rows.length === 0) {
          return NextResponse.json({ ok: false, error: 'Tidak ada data untuk disimpan' }, { status: 400 });
        }
        const count = await importRekapanTrainingRows(body.rows, session);
        return NextResponse.json({
          ok: true,
          message: `Berhasil mengimpor ${count} baris rekapan data training`,
          count,
        });
      }
    }

    // Handle Multipart Form File Upload
    const formData = await request.formData();
    const file = formData.get('file');
    const isPreviewOnly = formData.get('preview') === 'true';

    if (!file) {
      return NextResponse.json({ ok: false, error: 'File tidak ditemukan' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let rawHeaders = [];
    let rawRows = [];

    if (filename.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
      });

      if (!parseResult.data || parseResult.data.length === 0) {
        return NextResponse.json({ ok: false, error: 'File CSV kosong' }, { status: 400 });
      }

      rawHeaders = parseResult.data[0].map((h) => String(h || '').trim());
      const headerMap = {};
      rawHeaders.forEach((h, idx) => {
        headerMap[normalizeHeaderKey(h)] = idx;
      });

      for (let i = 1; i < parseResult.data.length; i++) {
        const rowArr = parseResult.data[i];
        if (!rowArr || rowArr.length === 0 || rowArr.every((cell) => !String(cell || '').trim())) {
          continue;
        }
        rawRows.push({ rowNumber: i + 1, rowArr, headerMap });
      }
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        return NextResponse.json({ ok: false, error: 'Worksheet Excel kosong' }, { status: 400 });
      }

      const headerRow = worksheet.getRow(1);
      const headerMap = {};
      headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value != null ? cell.value : '').trim();
        rawHeaders.push(val);
        headerMap[normalizeHeaderKey(val)] = colNumber;
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        let hasData = false;
        const cellMap = {};

        row.eachCell((cell, colNumber) => {
          const val = cell.value != null ? String(cell.value).trim() : '';
          cellMap[colNumber] = val;
          if (val) hasData = true;
        });

        if (hasData) {
          rawRows.push({ rowNumber, cellMap, headerMap });
        }
      });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Format file tidak didukung. Gunakan file .xlsx atau .csv' },
        { status: 400 }
      );
    }

    // 1. Validasi Nama Kolom Header
    const normalizedUploadedHeaders = rawHeaders.map(normalizeHeaderKey);
    const missingHeaders = [];

    for (const reqH of REQUIRED_HEADERS_REKAP) {
      const normKey = normalizeHeaderKey(reqH);
      const isFound = normalizedUploadedHeaders.some((uH) => uH.includes(normKey) || normKey.includes(uH));
      if (!isFound) {
        missingHeaders.push(reqH);
      }
    }

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Format kolom file tidak sesuai. Kolom tidak ditemukan: ${missingHeaders.join(
            ', '
          )}. Format kolom yang benar harus persis: NO | JENIS TRAINING | TARGET LSKT | DISPENSASI | TARGET TC REPORT | HADIR | TIDAK HADIR | NO LIST PESERTA TIDAK HADIR`,
        },
        { status: 400 }
      );
    }

    // Helper untuk mengambil value kolom berdasarkan header key
    function getCellValue(rObj, key) {
      const normKey = normalizeHeaderKey(key);
      const colIdx = rObj.headerMap[normKey];
      if (colIdx == null) {
        // Fallback matching
        for (const [k, idx] of Object.entries(rObj.headerMap)) {
          if (k.includes(normKey) || normKey.includes(k)) {
            if (rObj.rowArr) return rObj.rowArr[idx] || '';
            if (rObj.cellMap) return rObj.cellMap[idx] || '';
          }
        }
        return '';
      }
      if (rObj.rowArr) return rObj.rowArr[colIdx] || '';
      if (rObj.cellMap) return rObj.cellMap[colIdx] || '';
      return '';
    }

    // 2. Extrak & Validasi Tipe Data per Baris
    const parsedRows = [];
    const validationErrors = [];

    for (const rObj of rawRows) {
      const noVal = getCellValue(rObj, 'NO');
      const jenisTrainingVal = getCellValue(rObj, 'JENIS TRAINING');
      const targetLsktVal = getCellValue(rObj, 'TARGET LSKT');
      const dispensasiVal = getCellValue(rObj, 'DISPENSASI');
      const targetTcReportVal = getCellValue(rObj, 'TARGET TC REPORT');
      const hadirVal = getCellValue(rObj, 'HADIR');
      const tidakHadirVal = getCellValue(rObj, 'TIDAK HADIR');
      const noListPesertaVal = getCellValue(rObj, 'NO LIST PESERTA TIDAK HADIR');

      // Validasi Angka pada kolom numerik
      const numericFields = [
        { label: 'TARGET LSKT', val: targetLsktVal },
        { label: 'DISPENSASI', val: dispensasiVal },
        { label: 'TARGET TC REPORT', val: targetTcReportVal },
        { label: 'HADIR', val: hadirVal },
        { label: 'TIDAK HADIR', val: tidakHadirVal },
      ];

      for (const field of numericFields) {
        if (field.val !== '' && isNaN(Number(field.val))) {
          validationErrors.push(
            `Baris ke-${rObj.rowNumber}: Kolom ${field.label} harus berupa angka (ditemukan: "${field.val}")`
          );
        }
      }

      parsedRows.push({
        no: noVal ? Number(noVal) : parsedRows.length + 1,
        jenis_training: String(jenisTrainingVal || '').trim().toUpperCase(),
        target_lskt: Number(targetLsktVal || 0),
        dispensasi: Number(dispensasiVal || 0),
        target_tc_report: Number(targetTcReportVal || 0),
        hadir: Number(hadirVal || 0),
        tidak_hadir: Number(tidakHadirVal || 0),
        no_list_peserta_tidak_hadir: String(noListPesertaVal || '-').trim(),
      });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Terdapat kesalahan validasi tipe data:\n${validationErrors.slice(0, 5).join('\n')}${
            validationErrors.length > 5 ? `\n...dan ${validationErrors.length - 5} kesalahan lainnya.` : ''
          }`,
        },
        { status: 400 }
      );
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Tidak ada baris data valid yang ditemukan' }, { status: 400 });
    }

    // Jika mode preview: kembalikan hasil parse data tanpa menyimpan ke database
    if (isPreviewOnly) {
      return NextResponse.json({
        ok: true,
        preview: true,
        totalRows: parsedRows.length,
        rows: parsedRows,
      });
    }

    // Simpan langsung jika bukan preview
    const count = await importRekapanTrainingRows(parsedRows, session);

    return NextResponse.json({
      ok: true,
      message: `Berhasil mengimpor ${count} baris rekapan data training`,
      count,
    });
  } catch (err) {
    console.error('[API Import RekapanTraining Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal mengimpor file' },
      { status: 500 }
    );
  }
}
