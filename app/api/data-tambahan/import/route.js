// app/api/data-tambahan/import/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { importDataTambahanRows } from '../../../../lib/data-service.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rows } = body || {};

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Tidak ada baris data yang diimpor' },
        { status: 400 }
      );
    }

    // Normalisasi format input (NO, TRAINING, NIK, NAMA, KD TOKO, NAMA TOKO, ALASAN TIDAK HADIR)
    const validRows = [];
    for (const r of rows) {
      const nik = String(r.nik || r.NIK || r['nik'] || '').trim();
      const nama = String(r.nama || r.NAMA || r['nama'] || '').trim();
      const training = String(r.training || r.TRAINING || r['training'] || 'TRAINING').trim();
      const kdToko = String(r.kd_toko || r['KD TOKO'] || r['KODE TOKO'] || r.kdToko || '-').trim();
      const namaToko = String(r.nama_toko || r['NAMA TOKO'] || r.namaToko || '-').trim();
      const alasan = String(r.alasan_tidak_hadir || r['ALASAN TIDAK HADIR'] || r.alasan || '-').trim();

      if (nik && nama) {
        validRows.push({
          training,
          nik,
          nama,
          kd_toko: kdToko,
          nama_toko: namaToko,
          alasan_tidak_hadir: alasan,
        });
      }
    }

    if (validRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Data tidak memiliki NIK dan Nama yang valid. Pastikan header sesuai template.' },
        { status: 400 }
      );
    }

    const insertedCount = await importDataTambahanRows(validRows, session);

    return NextResponse.json({
      ok: true,
      message: `Berhasil mengimpor ${insertedCount} data tambahan ke cabang Anda`,
      count: insertedCount,
    });
  } catch (err) {
    console.error('[API Data Tambahan Import Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal mengimpor data tambahan' },
      { status: 500 }
    );
  }
}
