// app/api/list-soft-skill/import/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { importListSoftSkillRows } from '../../../../lib/data-service.js';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Required headers for List Soft Skill
const REQUIRED_HEADERS_SOFTSKILL = ['NIK', 'NAMA', 'JABATAN', 'KATEGORY', 'DETAIL ALASAN'];

function normalizeHeaderKey(str) {
  if (!str) return '';
  const norm = String(str).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  if (norm === 'KATEGORI') return 'KATEGORY';
  return norm;
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle JSON confirmation payload (from Preview Modal)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.action === 'save' && Array.isArray(body.rows)) {
        if (body.rows.length === 0) {
          return NextResponse.json({ ok: false, error: 'Tidak ada data untuk disimpan' }, { status: 400 });
        }
        const count = await importListSoftSkillRows(body.rows, session);
        return NextResponse.json({
          ok: true,
          message: `Berhasil mengimpor ${count} baris data List Soft Skill`,
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
          // Force string representation to preserve leading zeros for NIK
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

    for (const reqH of REQUIRED_HEADERS_SOFTSKILL) {
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
          )}. Format kolom yang benar harus persis: NIK | Nama | Jabatan | Kategory | Detail Alasan`,
        },
        { status: 400 }
      );
    }

    // Helper untuk mengambil value sel
    function getCellValue(rObj, key) {
      const normKey = normalizeHeaderKey(key);
      const colIdx = rObj.headerMap[normKey];
      if (colIdx == null) {
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

    // 2. Extrak & Format Data per Baris
    const parsedRows = [];

    for (const rObj of rawRows) {
      const nikVal = getCellValue(rObj, 'NIK');
      const namaVal = getCellValue(rObj, 'NAMA');
      const jabatanVal = getCellValue(rObj, 'JABATAN');
      const kategoryVal = getCellValue(rObj, 'KATEGORY');
      const detailAlasanVal = getCellValue(rObj, 'DETAIL ALASAN');

      parsedRows.push({
        no: parsedRows.length + 1,
        nik: String(nikVal != null ? nikVal : '').trim(), // Saved as text string
        nama: String(namaVal || '').trim().toUpperCase(),
        jabatan: String(jabatanVal || '-').trim(),
        kategory: String(kategoryVal || '-').trim(),
        kategori: String(kategoryVal || '-').trim(),
        detail_alasan: String(detailAlasanVal || '-').trim(),
      });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Tidak ada baris data valid yang ditemukan' }, { status: 400 });
    }

    // Jika mode preview: kembalikan data tanpa menyimpan
    if (isPreviewOnly) {
      return NextResponse.json({
        ok: true,
        preview: true,
        totalRows: parsedRows.length,
        rows: parsedRows,
      });
    }

    // Simpan langsung
    const count = await importListSoftSkillRows(parsedRows, session);

    return NextResponse.json({
      ok: true,
      message: `Berhasil mengimpor ${count} baris data List Soft Skill`,
      count,
    });
  } catch (err) {
    console.error('[API Import ListSoftSkill Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal mengimpor file' },
      { status: 500 }
    );
  }
}
