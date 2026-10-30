// app/api/admin/trainings/cascade-rename/route.js
// Melakukan update terarah nama baru jenis training ke Master dan seluruh data terkait di semua cabang
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session.js';
import { getSupabaseAdmin } from '@/lib/supabase.js';
import { auditLog } from '@/lib/audit.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, oldName, newName, updateLegacy = true } = body;

    if (!id || !newName || !newName.trim()) {
      return NextResponse.json({ ok: false, error: 'ID dan Nama Baru wajib diisi' }, { status: 400 });
    }

    const cleanOld = String(oldName || '').trim();
    const cleanNew = String(newName).trim();
    const supabase = getSupabaseAdmin();

    // 1. Update nama di tabel training_types
    const { data: updatedMaster, error: masterErr } = await supabase
      .from('training_types')
      .update({
        name: cleanNew,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (masterErr) {
      console.error('[cascade-rename Master Error]:', masterErr);
      return NextResponse.json(
        { ok: false, error: masterErr.message || 'Gagal mengubah nama di Master' },
        { status: 500 }
      );
    }

    let summary = {
      updated_absence_records: 0,
      updated_data_tambahan: 0,
      total_updated: 0,
    };

    if (updateLegacy) {
      // 2. Coba jalankan Database Function RPC: fn_update_training_name_cascade
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_update_training_name_cascade', {
          p_training_id: id,
          p_old_name: cleanOld,
          p_new_name: cleanNew,
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          summary = {
            updated_absence_records: rpcRes.updated_absence_records || 0,
            updated_data_tambahan: rpcRes.updated_data_tambahan || 0,
            total_updated: rpcRes.total_updated || 0,
          };
        } else {
          throw new Error(rpcErr?.message || 'RPC tidak tersedia, beralih ke direct update');
        }
      } catch (rpcFallbackErr) {
        console.log('[RPC Fallback to Direct Query]:', rpcFallbackErr.message);

        // Fallback: jalankan direct query dengan service role client (melewati RLS cabang dengan aman)
        // A. absence_records
        const { data: absRows, error: absErr } = await supabase
          .from('absence_records')
          .update({
            training_id: id,
            jenis_training_id: id,
            updated_at: new Date().toISOString(),
          })
          .eq('training_id', id)
          .select('id');

        summary.updated_absence_records = absRows ? absRows.length : 0;

        // B. data_tambahan
        let tambCount = 0;
        // Cari by training_id atau by nama lama
        const { data: tambRowsById } = await supabase
          .from('data_tambahan')
          .update({
            training: cleanNew,
            training_id: id,
            jenis_training_id: id,
            updated_at: new Date().toISOString(),
          })
          .eq('training_id', id)
          .select('id');
        tambCount += tambRowsById ? tambRowsById.length : 0;

        if (cleanOld) {
          const { data: tambRowsByText } = await supabase
            .from('data_tambahan')
            .update({
              training: cleanNew,
              training_id: id,
              jenis_training_id: id,
              updated_at: new Date().toISOString(),
            })
            .ilike('training', cleanOld)
            .select('id');
          tambCount += tambRowsByText ? tambRowsByText.length : 0;
        }
        summary.updated_data_tambahan = tambCount;

        // C. Tabel-tabel cetak jika ada
        if (cleanOld) {
          try {
            await supabase
              .from('cetak_rekap')
              .update({
                jenis_training: cleanNew,
                training_id: id,
                updated_at: new Date().toISOString(),
              })
              .ilike('jenis_training', cleanOld);
          } catch (_) {}

          try {
            await supabase
              .from('list_tidak_hadir')
              .update({
                training: cleanNew,
                training_id: id,
                updated_at: new Date().toISOString(),
              })
              .ilike('training', cleanOld);
          } catch (_) {}
        }

        summary.total_updated = summary.updated_absence_records + summary.updated_data_tambahan;
      }
    }

    // Audit log
    await auditLog(session, 'UPDATE_TRAINING_CASCADE', 'training_types', id, {
      old_name: cleanOld,
      new_name: cleanNew,
      update_legacy: updateLegacy,
      summary,
    });

    return NextResponse.json({
      ok: true,
      message: updateLegacy
        ? `Nama jenis training dan ${summary.total_updated} data terkait berhasil diperbarui.`
        : 'Nama jenis training berhasil diperbarui di Master.',
      data: updatedMaster,
      summary,
    });
  } catch (err) {
    console.error('[cascade-rename Exception]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
