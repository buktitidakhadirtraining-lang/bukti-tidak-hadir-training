// app/api/rekapan-training/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import {
  resolveUserBranchId,
  getRekapanTrainingList,
  insertRekapanTrainingRecord,
  clearAllRekapanTraining,
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

    const rows = await getRekapanTrainingList({ branchId, role: session.role });

    return NextResponse.json({
      ok: true,
      data: rows || [],
    });
  } catch (err) {
    console.error('[API GET RekapanTraining Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memuat data rekapan training' },
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
    const data = await insertRekapanTrainingRecord(body, session);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[API POST RekapanTraining Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menambahkan data rekapan training' },
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

    await clearAllRekapanTraining(session);

    return NextResponse.json({
      ok: true,
      message: 'Semua data rekapan training berhasil dihapus',
    });
  } catch (err) {
    console.error('[API DELETE ALL RekapanTraining Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menghapus semua data' },
      { status: 500 }
    );
  }
}
