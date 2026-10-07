// app/api/list-soft-skill/export/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { resolveUserBranchInfo, getListSoftSkillList } from '../../../../lib/data-service.js';
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
      const worksheet = workbook.addWorksheet('List Soft Skill');

      worksheet.columns = [
        { header: 'NIK', key: 'NIK', width: 18 },
        { header: 'Nama', key: 'Nama', width: 32 },
        { header: 'Jabatan', key: 'Jabatan', width: 24 },
        { header: 'Kategory', key: 'Kategory', width: 20 },
        { header: 'Detail Alasan', key: 'Detail Alasan', width: 36 },
      ];

      // Header Styling
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
        NIK: '0123456789',
        Nama: 'BUDI SANTOSO',
        Jabatan: 'PIMPINAN SHIFT',
        Kategory: 'MANGKIR',
        'Detail Alasan': 'Sakit tanpa surat dokter',
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="Template_List_Soft_Skill.xlsx"',
        },
      });
    }

    const rows = await getListSoftSkillList({ branchId: effectiveCabang, role: session.role, session });

    const exportData = (rows || []).map((r) => ({
      NIK: String(r.nik || ''),
      Nama: r.nama || '',
      Jabatan: r.jabatan || '-',
      Kategory: r.kategory || r.kategori || '-',
      'Detail Alasan': r.detail_alasan || '-',
    }));

    if (format === 'csv') {
      const csv = Papa.unparse(exportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="List_Soft_Skill_${effectiveCabang.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('List Soft Skill');

    worksheet.columns = [
      { header: 'NIK', key: 'NIK', width: 18 },
      { header: 'Nama', key: 'Nama', width: 32 },
      { header: 'Jabatan', key: 'Jabatan', width: 24 },
      { header: 'Kategory', key: 'Kategory', width: 20 },
      { header: 'Detail Alasan', key: 'Detail Alasan', width: 36 },
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
        'Content-Disposition': `attachment; filename="List_Soft_Skill_${effectiveCabang.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`,
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
