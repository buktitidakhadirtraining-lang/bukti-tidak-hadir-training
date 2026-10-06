// app/api/data-tambahan/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { SPREADSHEET_ID } from '../../../../lib/config.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PUT: Edit data tambahan berdasarkan ID
 */
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

    const supabase = getSupabaseAdmin();

    const updatePayload = {
      training: (training || '').trim(),
      nik: (nik || '').trim(),
      nama: (nama || '').trim(),
      kd_toko: (kd_toko || '').trim(),
      nama_toko: (nama_toko || '').trim(),
      alasan_tidak_hadir: (alasan_tidak_hadir || '').trim(),
      updated_at: new Date().toISOString(),
    };

    if (no !== undefined && no !== null) {
      updatePayload.no = Number(no);
    }

    const { data, error } = await supabase
      .from('data_tambahan')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Panggil sync webhook ke spreadsheet jika ada
    try {
      let bridgeUrl = null;
      try {
        const { data: settings } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'spreadsheet_bridge_url')
          .limit(1);
        if (settings && settings[0]?.value) bridgeUrl = settings[0].value.trim();
      } catch {}

      if (!bridgeUrl) {
        const { data: branches } = await supabase
          .from('branches')
          .select('drive_bridge_url')
          .not('drive_bridge_url', 'is', null)
          .limit(1);
        if (branches && branches[0]?.drive_bridge_url) bridgeUrl = branches[0].drive_bridge_url.trim();
      }

      if (bridgeUrl && bridgeUrl.startsWith('http')) {
        await fetch(bridgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'update_data_tambahan',
            sheet: 'Data_tambahan',
            spreadsheetId: SPREADSHEET_ID,
            nik: updatePayload.nik,
            row: [
              updatePayload.no || data.no,
              updatePayload.training,
              updatePayload.nik,
              updatePayload.nama,
              updatePayload.kd_toko,
              updatePayload.nama_toko,
              updatePayload.alasan_tidak_hadir,
            ],
          }),
        }).catch(() => {});
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      message: 'Data tambahan berhasil diperbarui',
      data,
    });
  } catch (err) {
    console.error('[Data Tambahan PUT Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: Hapus 1 data tambahan berdasarkan ID
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Ambil data sebelum dihapus
    const { data: existing } = await supabase
      .from('data_tambahan')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('data_tambahan')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Panggil sync webhook hapus ke spreadsheet jika ada
    try {
      let bridgeUrl = null;
      try {
        const { data: settings } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'spreadsheet_bridge_url')
          .limit(1);
        if (settings && settings[0]?.value) bridgeUrl = settings[0].value.trim();
      } catch {}

      if (!bridgeUrl) {
        const { data: branches } = await supabase
          .from('branches')
          .select('drive_bridge_url')
          .not('drive_bridge_url', 'is', null)
          .limit(1);
        if (branches && branches[0]?.drive_bridge_url) bridgeUrl = branches[0].drive_bridge_url.trim();
      }

      if (bridgeUrl && bridgeUrl.startsWith('http') && existing?.nik) {
        await fetch(bridgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'delete_data_tambahan',
            sheet: 'Data_tambahan',
            spreadsheetId: SPREADSHEET_ID,
            nik: existing.nik,
          }),
        }).catch(() => {});
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      message: 'Data tambahan berhasil dihapus',
    });
  } catch (err) {
    console.error('[Data Tambahan DELETE Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
