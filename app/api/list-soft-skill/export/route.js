// app/api/list-soft-skill/export/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { resolveUserBranchId, getListSoftSkillList } from '../../../../lib/data-service.js';
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

    const rows = await getListSoftSkillList({ branchId, role: session.role });

    const exportData = (rows || []).map((r, i) => ({
      NO: r.no || i + 1,
      NIK: r.nik || '',
      NAMA: r.nama || '',
      JABATAN: r.jabatan || '-',
      KATEGORI: r.kategori || r.kategory || '-',
      'DETAIL ALASAN': r.detail_alasan || '-',
    }));

    if (format === 'csv') {
      const csv = Papa.unparse(exportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="List_Soft_Skill_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('List Soft Skill');

    worksheet.columns = [
      { header: 'NO', key: 'NO', width: 8 },
      { header: 'NIK', key: 'NIK', width: 16 },
      { header: 'NAMA', key: 'NAMA', width: 28 },
      { header: 'JABATAN', key: 'JABATAN', width: 22 },
      { header: 'KATEGORI', key: 'KATEGORI', width: 18 },
      { header: 'DETAIL ALASAN', key: 'DETAIL ALASAN', width: 30 },
    ];

    exportData.forEach((row) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="List_Soft_Skill_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('[API Export ListSoftSkill Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal mengekspor data' },
      { status: 500 }
    );
  }
}
