// app/api/rekapan-training/export/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { resolveUserBranchId, getRekapanTrainingList } from '../../../../lib/data-service.js';
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
    const requestedBranchId = searchParams.get('branch_id');

    const userBranchId = await resolveUserBranchId(session);
    const branchId = session.role === 'admin_pusat' && requestedBranchId ? requestedBranchId : userBranchId;

    const rows = await getRekapanTrainingList({ branchId, role: session.role });

    const exportData = (rows || []).map((r, i) => ({
      NO: r.no || i + 1,
      'JENIS TRAINING': r.jenis_training || '',
      'TARGET LSKT': r.target_lskt || '0',
      DISPENSASI: r.dispensasi || '0',
      TARGET: r.target_tc_report || '0',
      HADIR: r.hadir || '0',
      'TIDAK HADIR': r.tidak_hadir || '0',
      'NO LIST PESERTA TIDAK HADIR': r.no_list_peserta_tidak_hadir || '-',
    }));

    if (format === 'csv') {
      const csv = Papa.unparse(exportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Rekapan_Data_Training_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekapan Data Training');

    worksheet.columns = [
      { header: 'NO', key: 'NO', width: 8 },
      { header: 'JENIS TRAINING', key: 'JENIS TRAINING', width: 30 },
      { header: 'TARGET LSKT', key: 'TARGET LSKT', width: 16 },
      { header: 'DISPENSASI', key: 'DISPENSASI', width: 16 },
      { header: 'TARGET', key: 'TARGET', width: 16 },
      { header: 'HADIR', key: 'HADIR', width: 14 },
      { header: 'TIDAK HADIR', key: 'TIDAK HADIR', width: 16 },
      { header: 'NO LIST PESERTA TIDAK HADIR', key: 'NO LIST PESERTA TIDAK HADIR', width: 32 },
    ];

    exportData.forEach((row) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rekapan_Data_Training_${new Date().toISOString().slice(0, 10)}.xlsx"`,
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
