// app/api/sync-sheets/route.js
// Endpoint data cetak & rekap terisolasi per Cabang (100% Bebas Google Sheets)
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import {
  resolveUserBranchId,
  getCetakListTidakHadir,
  getCetakRekapData,
  getDataTambahanList,
  getListTidakHadirList,
} from '../../../lib/data-service.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branch_id');

    const userBranchId = await resolveUserBranchId(session);
    const branchId = session.role === 'admin_pusat' && requestedBranchId ? requestedBranchId : userBranchId;

    const [combinedList, rekapData, dataTambahan, listTidakHadir] = await Promise.all([
      getCetakListTidakHadir({ branchId, role: session.role }),
      getCetakRekapData({ branchId, role: session.role }),
      getDataTambahanList({ branchId, role: session.role }),
      getListTidakHadirList({ branchId, role: session.role }),
    ]);

    // Ambil list_soft_skill jika ada
    const supabase = getSupabaseAdmin();
    let softSkillQuery = supabase.from('list_soft_skill').select('*').order('no', { ascending: true });
    if (session.role !== 'admin_pusat' && branchId) {
      softSkillQuery = softSkillQuery.eq('branch_id', branchId);
    }
    const { data: softSkillData } = await softSkillQuery;

    return NextResponse.json({
      ok: true,
      syncInfo: { success: true, message: 'Data lokal cabang termuat' },
      lastSyncTime: new Date().toISOString(),
      rekap: rekapData || [],
      listTidakHadir: combinedList || [], // Mengembalikan gabungan data_tambahan + list_tidak_hadir
      rawListTidakHadir: listTidakHadir || [],
      dataTambahan: dataTambahan || [],
      softSkill: softSkillData || [],
    });
  } catch (err) {
    console.error('[API Sync/Cetak Data Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memuat data cetak' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}
