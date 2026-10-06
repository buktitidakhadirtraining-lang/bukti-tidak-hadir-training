// app/api/list-tidak-hadir/[id]/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import {
  updateListTidakHadirRecord,
  deleteListTidakHadirRecord,
} from '../../../../lib/data-service.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { training, nik, nama, kd_toko, nama_toko, alasan_tidak_hadir, no } = body || {};

    if (!nik || !nama) {
      return NextResponse.json({ ok: false, error: 'NIK dan Nama wajib diisi' }, { status: 400 });
    }

    const updated = await updateListTidakHadirRecord(
      id,
      {
        training,
        nik,
        nama,
        kd_toko,
        nama_toko,
        alasan_tidak_hadir,
        no,
      },
      session
    );

    return NextResponse.json({
      ok: true,
      message: 'Data peserta tidak hadir berhasil diperbarui',
      data: updated,
    });
  } catch (err) {
    console.error('[API List Tidak Hadir PUT Error]:', err);
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

    const { id } = await params;
    await deleteListTidakHadirRecord(id, session);

    return NextResponse.json({
      ok: true,
      message: 'Data peserta tidak hadir berhasil dihapus',
    });
  } catch (err) {
    console.error('[API List Tidak Hadir DELETE Single Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menghapus data' },
      { status: 500 }
    );
  }
}
