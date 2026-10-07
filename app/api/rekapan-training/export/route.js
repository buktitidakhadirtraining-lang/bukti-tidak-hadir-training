// app/api/rekapan-training/export/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { resolveUserBranchInfo, getRekapanTrainingList } from '../../../../lib/data-service.js';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xlsx';
    const isTemplate = searchParams.get('template') === 'true';
    const requestedBranchId = searchParams.get('branch_id');

    const branchInfo = await resolveUserBranchInfo(session);
    const effectiveCabang = session.role === 'admin_pusat' && requestedBranchId ? requestedBranchId : branchInfo.cabang;

    // Handle Download Template Excel Kosong
    if (isTemplate) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Data Training');

      worksheet.columns = [
        { header: 'NO', key: 'NO', width: 10 },
        { header: 'JENIS TRAINING', key: 'JENIS TRAINING', width: 32 },
        { header: 'TARGET LSKT', key: 'TARGET LSKT', width: 16 },
        { header: 'DISPENSASI', key: 'DISPENSASI', width: 16 },
        { header: 'TARGET TC REPORT', key: 'TARGET TC REPORT', width: 20 },
        { header: 'HADIR', key: 'HADIR', width: 14 },
        { header: 'TIDAK HADIR', key: 'TIDAK HADIR', width: 16 },
        { header: 'NO LIST PESERTA TIDAK HADIR', key: 'NO LIST PESERTA TIDAK HADIR', width: 32 },
      ];

      // Styling Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0056B3' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Sample Row
      worksheet.addRow({
        NO: 1,
        'JENIS TRAINING': 'CREW STORE BASIC',
        'TARGET LSKT': 50,
        DISPENSASI: 5,
        'TARGET TC REPORT': 45,
        HADIR: 40,
        'TIDAK HADIR': 5,
        'NO LIST PESERTA TIDAK HADIR': 'A.1 / B.2',
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="Template_Rekap_Data_Training.xlsx"',
        },
      });
    }

    const rows = await getRekapanTrainingList({ branchId: effectiveCabang, role: session.role, session });

    const exportData = (rows || []).map((r, i) => ({
      NO: r.no || i + 1,
      'JENIS TRAINING': r.jenis_training || '',
      'TARGET LSKT': Number(r.target_lskt || 0),
      DISPENSASI: Number(r.dispensasi || 0),
      'TARGET TC REPORT': Number(r.target_tc_report || 0),
      HADIR: Number(r.hadir || 0),
      'TIDAK HADIR': Number(r.tidak_hadir || 0),
      'NO LIST PESERTA TIDAK HADIR': r.no_list_peserta_tidak_hadir || '-',
    }));

    if (format === 'csv') {
      const csv = Papa.unparse(exportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Rekap_Data_Training_${effectiveCabang.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Data Training');

    worksheet.columns = [
      { header: 'NO', key: 'NO', width: 8 },
      { header: 'JENIS TRAINING', key: 'JENIS TRAINING', width: 32 },
      { header: 'TARGET LSKT', key: 'TARGET LSKT', width: 16 },
      { header: 'DISPENSASI', key: 'DISPENSASI', width: 16 },
      { header: 'TARGET TC REPORT', key: 'TARGET TC REPORT', width: 20 },
      { header: 'HADIR', key: 'HADIR', width: 14 },
      { header: 'TIDAK HADIR', key: 'TIDAK HADIR', width: 16 },
      { header: 'NO LIST PESERTA TIDAK HADIR', key: 'NO LIST PESERTA TIDAK HADIR', width: 32 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0056B3' },
    };

    exportData.forEach((row) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rekap_Data_Training_${effectiveCabang.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('[API Export RekapanTraining Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal mengekspor data' },
      { status: 500 }
    );
  }
}
