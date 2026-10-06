// app/api/list-tidak-hadir/export/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { resolveUserBranchId, getListTidakHadirList } from '../../../../lib/data-service.js';

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

    const data = await getListTidakHadirList({ branchId, role: session.role });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[API List Tidak Hadir Export Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal mengekspor data' },
      { status: 500 }
    );
  }
}
