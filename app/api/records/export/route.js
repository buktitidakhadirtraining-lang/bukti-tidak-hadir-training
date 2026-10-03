// app/api/records/export/route.js
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { formatDateIndo } from '../../../../lib/config.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xlsx'; // 'xlsx' atau 'csv'
    const branchId = searchParams.get('branch_id');
    const trainingId = searchParams.get('training_id');
    const reasonId = searchParams.get('reason_id');
    const position = searchParams.get('position');
    const batch = searchParams.get('batch');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const search = searchParams.get('search');
    const hasProof = searchParams.get('has_proof');

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('absence_records')
      .select(`
        id,
        nik,
        nama_peserta,
        jabatan,
        batch,
        tanggal_pelaksanaan,
        keterangan,
        drive_file_id,
        drive_file_name,
        drive_file_url,
        branches ( name, code ),
        training_types ( name ),
        absence_reasons ( name ),
        created_at
      `)
      .order('tanggal_pelaksanaan', { ascending: false });

    // Role check
    if (session.role !== 'admin_pusat') {
      query = query.eq('branch_id', session.branchId);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (trainingId) query = query.eq('training_id', trainingId);
    if (reasonId) query = query.eq('alasan_id', reasonId);
    if (position) query = query.eq('jabatan', position);
    if (batch) query = query.eq('batch', parseInt(batch, 10));

    if (year) {
      if (month) {
        const m = String(month).padStart(2, '0');
        const startDate = `${year}-${m}-01`;
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('tanggal_pelaksanaan', startDate).lte('tanggal_pelaksanaan', endDate);
      } else {
        query = query.gte('tanggal_pelaksanaan', `${year}-01-01`).lte('tanggal_pelaksanaan', `${year}-12-31`);
      }
    }

    if (search && search.trim()) {
      const cleanSearch = search.replace(/[,()%\\]/g, '').trim();
      if (cleanSearch) {
        query = query.or(`nik.ilike.%${cleanSearch}%,nama_peserta.ilike.%${cleanSearch}%`);
      }
    }

    if (hasProof === 'true') {
      query = query.not('drive_file_id', 'is', null);
    } else if (hasProof === 'false') {
      query = query.is('drive_file_id', null);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error('[Export Query Error]:', error);
      return NextResponse.json({ ok: false, error: 'Gagal mengambil data untuk ekspor' }, { status: 500 });
    }

    const list = records || [];

    // Format CSV
    if (format === 'csv') {
      const rows = list.map((item, idx) => ({
        'No': idx + 1,
        'NIK': item.nik,
        'Nama Peserta': item.nama_peserta,
        'Jabatan': item.jabatan,
        'Cabang': item.branches?.name || '',
        'Jenis Training': item.training_types?.name || '',
        'Batch': item.batch,
        'Tanggal Pelaksanaan': item.tanggal_pelaksanaan,
        'Alasan Ketidakhadiran': item.absence_reasons?.name || '',
        'Keterangan': item.keterangan || '',
        'Status Bukti': item.drive_file_id ? 'Ada Bukti' : 'Tidak Ada',
        'Nama File Bukti': item.drive_file_name || '',
      }));

      const csvString = Papa.unparse(rows);
      const filename = `rekap-ketidakhadiran-${Date.now()}.csv`;

      return new Response(csvString, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Format Excel (XLSX) dengan ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistem Ketidakhadiran Training Indomaret';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Rekap Ketidakhadiran', {
      views: [{ showGridLines: true }],
    });

    // Judul Lembar Kerja
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DATA REKAPITULASI KETIDAKHADIRAN PESERTA TRAINING';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0056B3' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:L2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Diekspor pada: ${formatDateIndo(new Date())} | Total Data: ${list.length} Peserta`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF666666' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 18;

    // Header Kolom
    const headers = [
      { key: 'no', header: 'NO', width: 6 },
      { key: 'nik', header: 'NIK', width: 16 },
      { key: 'nama_peserta', header: 'NAMA PESERTA', width: 26 },
      { key: 'jabatan', header: 'JABATAN', width: 22 },
      { key: 'cabang', header: 'CABANG', width: 18 },
      { key: 'training', header: 'JENIS TRAINING', width: 22 },
      { key: 'batch', header: 'BATCH', width: 10 },
      { key: 'tanggal', header: 'TANGGAL PELAKSANAAN', width: 22 },
      { key: 'alasan', header: 'ALASAN', width: 22 },
      { key: 'keterangan', header: 'KETERANGAN', width: 30 },
      { key: 'status_bukti', header: 'STATUS BUKTI', width: 16 },
      { key: 'nama_file', header: 'NAMA FILE BUKTI', width: 26 },
    ];

    sheet.getRow(4).values = headers.map((h) => h.header);
    sheet.getRow(4).height = 24;

    // Styling Header
    sheet.getRow(4).eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0056B3' }, // Indomaret Blue
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF003366' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    // Isi Data
    list.forEach((item, index) => {
      const rowIndex = 5 + index;
      const row = sheet.getRow(rowIndex);

      row.values = [
        index + 1,
        item.nik,
        item.nama_peserta,
        item.jabatan,
        item.branches?.name || '',
        item.training_types?.name || '',
        item.batch,
        item.tanggal_pelaksanaan,
        item.absence_reasons?.name || '',
        item.keterangan || '-',
        item.drive_file_id ? 'Ada Bukti' : 'Tidak Ada',
        item.drive_file_name || '-',
      ];

      row.height = 20;

      // Styling Baris Sel
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };

        if (rowIndex % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }

        // Penjajaran khusus
        if ([1, 2, 7, 8, 11].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }

        // Warna status bukti
        if (colNumber === 11) {
          if (item.drive_file_id) {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0D9488' } };
          } else {
            cell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF9CA3AF' } };
          }
        }
      });
    });

    // Sesuaikan lebar kolom
    headers.forEach((col, idx) => {
      sheet.getColumn(idx + 1).width = col.width;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `rekap-ketidakhadiran-${Date.now()}.xlsx`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[Export API Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem saat mengekspor data' }, { status: 500 });
  }
}
