// app/api/list-tidak-hadir/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import {
  resolveUserBranchId,
  getListTidakHadirList,
  insertListTidakHadirRecord,
  clearAllListTidakHadir,
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

    const data = await getListTidakHadirList({ branchId, role: session.role });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[API List Tidak Hadir GET Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Sesi login tidak valid. Silakan login kembali.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { training, nik, nama, kd_toko, nama_toko, alasan_tidak_hadir } = body || {};

    if (!nik || !nama) {
      return NextResponse.json(
        { ok: false, error: 'NIK dan Nama Peserta wajib diisi' },
        { status: 400 }
      );
    }

    const saved = await insertListTidakHadirRecord(
      {
        training: training || 'TRAINING',
        nik,
        nama,
        kd_toko: kd_toko || '-',
        nama_toko: nama_toko || '-',
        alasan_tidak_hadir: alasan_tidak_hadir || '-',
      },
      session
    );

    return NextResponse.json({
      ok: true,
      message: 'Data peserta tidak hadir berhasil disimpan ke database cabang Anda.',
      data: saved,
    });
  } catch (err) {
    console.error('[API List Tidak Hadir POST Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menyimpan data peserta tidak hadir' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Sesi login tidak valid' },
        { status: 401 }
      );
    }

    await clearAllListTidakHadir(session);

    return NextResponse.json({
      ok: true,
      message: 'Semua data peserta tidak hadir di cabang Anda berhasil dibersihkan',
    });
  } catch (err) {
    console.error('[API List Tidak Hadir DELETE All Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal membersihkan data' },
      { status: 500 }
    );
  }
}
