// app/api/records/import/template/route.js
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Ambil data master aktif langsung dari database saat berkas di-generate
    const [trainingsRes, reasonsRes, branchesRes] = await Promise.all([
      supabase
        .from('training_types')
        .select('id, name, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('absence_reasons')
        .select('id, name, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('branches')
        .select('id, name, code, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);

    const trainings = trainingsRes.data || [];
    const reasons = reasonsRes.data || [];
    const branches = branchesRes.data || [];

    // Ambil contoh alasan yang benar-benar ada di tabel absence_reasons
    const sampleReason1 = reasons.length > 0 ? reasons[0].name : 'Sakit';
    const sampleReason2 = reasons.length > 1 ? reasons[1].name : sampleReason1;

    // Ambil contoh jenis training yang benar-benar ada di tabel training_types
    const sampleTraining1 = trainings.length > 0 ? trainings[0].name : 'Fried Food';
    const sampleTraining2 = trainings.length > 1 ? trainings[1].name : sampleTraining1;

    // Tentukan contoh kode/nama cabang
    let sampleBranch = 'SBY';
    if (session.branchId) {
      const userBranch = branches.find((b) => b.id === session.branchId);
      if (userBranch) {
        sampleBranch = userBranch.code || userBranch.name;
      }
    } else if (branches.length > 0) {
      sampleBranch = branches[0].code || branches[0].name;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistem Ketidakhadiran Training Indomaret';

    // --------------------------------------------------------------------------
    // Sheet 1: Template Impor
    // --------------------------------------------------------------------------
    const sheet = workbook.addWorksheet('Template Impor', {
      views: [{ showGridLines: true }],
    });

    const headers = [
      'NIK*',
      'Nama Peserta*',
      'Jabatan*',
      'Jenis Training*',
      'Batch*',
      'Tanggal Pelaksanaan (YYYY-MM-DD)*',
      'Cabang (Kode/Nama)*',
      'Alasan Ketidakhadiran*',
      'Keterangan',
    ];

    sheet.getRow(1).values = headers;
    sheet.getRow(1).height = 26;

    sheet.getRow(1).eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0056B3' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF003366' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    // 2 Baris contoh menggunakan nama alasan & jenis training yang ada di database saat ini
    const today = new Date().toISOString().split('T')[0];
    const sampleRows = [
      [
        '2024100123',
        'Budi Santoso',
        'Store Junior Leader',
        sampleTraining1,
        1,
        today,
        sampleBranch,
        sampleReason1,
        'Surat keterangan dokter / izin resmi terlampir',
      ],
      [
        '2024100456',
        'Siti Rahmawati',
        'Kasir',
        sampleTraining2,
        2,
        today,
        sampleBranch,
        sampleReason2,
        'Izin cuti / ketidakhadiran terkonfirmasi',
      ],
    ];

    sampleRows.forEach((rowValues, idx) => {
      const row = sheet.getRow(2 + idx);
      row.values = rowValues;
      row.height = 20;
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    sheet.columns = [
      { width: 18 }, // NIK
      { width: 25 }, // Nama
      { width: 22 }, // Jabatan
      { width: 26 }, // Training
      { width: 10 }, // Batch
      { width: 34 }, // Tanggal
      { width: 22 }, // Cabang
      { width: 28 }, // Alasan
      { width: 40 }, // Keterangan
    ];

    // --------------------------------------------------------------------------
    // Sheet 2: Petunjuk (Berisi petunjuk pengisian & daftar master data saat ini)
    // --------------------------------------------------------------------------
    const guideSheet = workbook.addWorksheet('Petunjuk', {
      views: [{ showGridLines: true }],
    });

    guideSheet.columns = [
      { width: 28 }, // Col A: Nama Kolom
      { width: 12 }, // Col B: Status
      { width: 55 }, // Col C: Ketentuan Pengisian
      { width: 4 },  // Col D: Spacer
      { width: 6 },  // Col E: No Training
      { width: 32 }, // Col F: Jenis Training yang Berlaku
      { width: 4 },  // Col G: Spacer
      { width: 6 },  // Col H: No Alasan
      { width: 34 }, // Col I: Alasan yang Berlaku
      { width: 4 },  // Col J: Spacer
      { width: 10 }, // Col K: Kode Cabang
      { width: 28 }, // Col L: Nama Cabang
    ];

    const guideHeaderRow = guideSheet.getRow(1);
    guideHeaderRow.height = 28;

    guideHeaderRow.getCell(1).value = 'Nama Kolom';
    guideHeaderRow.getCell(2).value = 'Status';
    guideHeaderRow.getCell(3).value = 'Ketentuan Pengisian';

    guideHeaderRow.getCell(5).value = 'No';
    guideHeaderRow.getCell(6).value = 'Jenis Training yang Berlaku Saat Ini';

    guideHeaderRow.getCell(8).value = 'No';
    guideHeaderRow.getCell(9).value = 'Alasan yang Berlaku Saat Ini';

    guideHeaderRow.getCell(11).value = 'Kode';
    guideHeaderRow.getCell(12).value = 'Nama Cabang';

    const headerColIndexes = [1, 2, 3, 5, 6, 8, 9, 11, 12];
    headerColIndexes.forEach((colIdx) => {
      const cell = guideHeaderRow.getCell(colIdx);
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0056B3' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF003366' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    const guideItems = [
      { col: 'NIK*', status: 'Wajib', desc: 'Format 8 hingga 16 digit angka (contoh: 2024100123)' },
      { col: 'Nama Peserta*', status: 'Wajib', desc: 'Nama lengkap peserta training' },
      { col: 'Jabatan*', status: 'Wajib', desc: 'Jabatan karyawan (contoh: Kasir, Store Junior Leader, dll)' },
      { col: 'Jenis Training*', status: 'Wajib', desc: 'Wajib sama persis dengan daftar pada kolom F (Jenis Training)' },
      { col: 'Batch*', status: 'Wajib', desc: 'Angka bulat positif (contoh: 1, 2, 3)' },
      { col: 'Tanggal Pelaksanaan*', status: 'Wajib', desc: 'Format YYYY-MM-DD (contoh: 2026-09-15)' },
      { col: 'Cabang (Kode/Nama)*', status: 'Wajib', desc: 'Kode cabang (contoh: SBY) atau nama cabang resmi (kolom K/L)' },
      { col: 'Alasan Ketidakhadiran*', status: 'Wajib', desc: 'Wajib sama persis dengan daftar pada kolom I (Alasan)' },
      { col: 'Keterangan', status: 'Opsional', desc: 'Catatan tambahan terkait ketidakhadiran' },
      { col: 'Catatan Berkas Bukti', status: 'Info', desc: 'File bukti diunggah terpisah melalui menu Rekap Data > Edit' },
    ];

    const maxRows = Math.max(
      guideItems.length,
      trainings.length,
      reasons.length,
      branches.length
    );

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    for (let i = 0; i < maxRows; i++) {
      const rowNum = i + 2;
      const row = guideSheet.getRow(rowNum);
      row.height = 20;

      // Panduan Kolom (Cols A, B, C)
      if (i < guideItems.length) {
        const item = guideItems[i];
        const cellA = row.getCell(1);
        const cellB = row.getCell(2);
        const cellC = row.getCell(3);

        cellA.value = item.col;
        cellA.font = { name: 'Arial', size: 9, bold: true };
        cellA.border = thinBorder;

        cellB.value = item.status;
        cellB.alignment = { horizontal: 'center' };
        cellB.font = {
          name: 'Arial',
          size: 9,
          bold: true,
          color: { argb: item.status === 'Wajib' ? 'FFDC2626' : 'FF4B5563' },
        };
        cellB.border = thinBorder;

        cellC.value = item.desc;
        cellC.font = { name: 'Arial', size: 9 };
        cellC.border = thinBorder;
      }

      // Daftar Training (Cols E, F)
      if (i < trainings.length) {
        const cellE = row.getCell(5);
        const cellF = row.getCell(6);

        cellE.value = i + 1;
        cellE.alignment = { horizontal: 'center' };
        cellE.font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } };
        cellE.border = thinBorder;

        cellF.value = trainings[i].name;
        cellF.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1F2937' } };
        cellF.border = thinBorder;
      }

      // Daftar Alasan (Cols H, I)
      if (i < reasons.length) {
        const cellH = row.getCell(8);
        const cellI = row.getCell(9);

        cellH.value = i + 1;
        cellH.alignment = { horizontal: 'center' };
        cellH.font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } };
        cellH.border = thinBorder;

        cellI.value = reasons[i].name;
        cellI.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1F2937' } };
        cellI.border = thinBorder;
      }

      // Daftar Cabang (Cols K, L)
      if (i < branches.length) {
        const cellK = row.getCell(11);
        const cellL = row.getCell(12);

        cellK.value = branches[i].code;
        cellK.alignment = { horizontal: 'center' };
        cellK.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0056B3' } };
        cellK.border = thinBorder;

        cellL.value = branches[i].name;
        cellL.font = { name: 'Arial', size: 9, color: { argb: 'FF374151' } };
        cellL.border = thinBorder;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-impor-ketidakhadiran.xlsx"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    console.error('[Template Export Error]:', err);
    return NextResponse.json({ ok: false, error: 'Gagal membuat berkas template' }, { status: 500 });
  }
}
