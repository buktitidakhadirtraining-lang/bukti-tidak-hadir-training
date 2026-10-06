// app/api/data-tambahan/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase.js';
import { insertDataTambahan } from '../../../lib/sheets.js';
import { getSessionFromRequest } from '../../../lib/session.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('data_tambahan')
      .select('*')
      .order('no', { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (err) {
    console.error('[API Data Tambahan GET Error]:', err);
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

    const saved = await insertDataTambahan({
      training: training || 'TRAINING',
      nik,
      nama,
      kd_toko: kd_toko || '-',
      nama_toko: nama_toko || '-',
      alasan_tidak_hadir: alasan_tidak_hadir || '-',
    });

    return NextResponse.json({
      ok: true,
      message: 'Data tambahan berhasil disimpan ke Supabase & Google Spreadsheet (Data_tambahan)',
      data: saved,
    });
  } catch (err) {
    console.error('[API Data Tambahan POST Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menyimpan data tambahan' },
      { status: 500 }
    );
  }
}
