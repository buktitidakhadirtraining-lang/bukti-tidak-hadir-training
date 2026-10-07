// app/api/list-soft-skill/import/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { importListSoftSkillRows } from '../../../../lib/data-service.js';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ ok: false, error: 'File tidak ditemukan' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let rows = [];

    if (filename.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      });
      rows = parseResult.data || [];
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (worksheet) {
        const headers = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData = {};
          let hasData = false;

          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              const val = cell.value != null ? String(cell.value).trim() : '';
              rowData[header] = val;
              if (val) hasData = true;
            }
          });

          if (hasData) {
            rows.push({
              no: rowData.no,
              nik: rowData.nik,
              nama: rowData.nama || rowData.nama_peserta,
              jabatan: rowData.jabatan,
              kategori: rowData.kategori || rowData.kategory,
              detail_alasan: rowData.detail_alasan || rowData.alasan,
            });
          }
        });
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'Format file tidak didukung. Gunakan file .xlsx atau .csv' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'File kosong atau format header tidak sesuai' },
        { status: 400 }
      );
    }

    const count = await importListSoftSkillRows(rows, session);

    return NextResponse.json({
      ok: true,
      message: `Berhasil mengimpor ${count} baris data soft skill`,
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
