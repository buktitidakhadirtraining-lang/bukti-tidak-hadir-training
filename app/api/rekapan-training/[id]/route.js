// app/api/rekapan-training/[id]/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import {
  updateRekapanTrainingRecord,
  deleteRekapanTrainingRecord,
} from '../../../../lib/data-service.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    const data = await updateRekapanTrainingRecord(id, body, session);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[API PUT RekapanTraining Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memperbarui data' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    await deleteRekapanTrainingRecord(id);

    return NextResponse.json({
      ok: true,
      message: 'Data berhasil dihapus',
    });
  } catch (err) {
    console.error('[API DELETE RekapanTraining Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menghapus data' },
      { status: 500 }
    );
  }
}
