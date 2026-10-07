// app/api/list-soft-skill/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import {
  resolveUserBranchId,
  getListSoftSkillList,
  insertListSoftSkillRecord,
  clearAllListSoftSkill,
} from '../../../lib/data-service.js';

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

    const rows = await getListSoftSkillList({ branchId, role: session.role });

    return NextResponse.json({
      ok: true,
      data: rows || [],
    });
  } catch (err) {
    console.error('[API GET ListSoftSkill Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memuat data list soft skill' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = await insertListSoftSkillRecord(body, session);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[API POST ListSoftSkill Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menambahkan data soft skill' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await clearAllListSoftSkill(session);

    return NextResponse.json({
      ok: true,
      message: 'Semua data list soft skill berhasil dihapus',
    });
  } catch (err) {
    console.error('[API DELETE ALL ListSoftSkill Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menghapus semua data' },
      { status: 500 }
    );
  }
}
