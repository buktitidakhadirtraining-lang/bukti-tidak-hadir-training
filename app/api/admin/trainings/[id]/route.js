// app/api/admin/trainings/[id]/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';
import { auditLog } from '../../../../../lib/audit.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function PUT(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, is_active, sort_order } = await request.json();

    const supabase = getSupabaseAdmin();
    const updatePayload = { updated_at: new Date().toISOString() };
    if (name !== undefined) updatePayload.name = name.trim();
    if (description !== undefined) updatePayload.description = description ? description.trim() : null;
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);
    if (sort_order !== undefined && !Number.isNaN(Number(sort_order))) {
      updatePayload.sort_order = Number(sort_order);
    }

    const { data, error } = await supabase
      .from('training_types')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal memperbarui jenis training' }, { status: 500 });
    }

    await auditLog(session.userId, 'UPDATE_TRAINING_TYPE', { id });

    return NextResponse.json(
      { ok: true, message: 'Jenis training berhasil diperbarui', data },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { count } = await supabase
      .from('absence_records')
      .select('*', { count: 'exact', head: true })
      .eq('training_id', id);

    if (count > 0) {
      return NextResponse.json(
        { ok: false, error: `Jenis training tidak dapat dihapus karena digunakan pada ${count} catatan ketidakhadiran. Silakan nonaktifkan saja.` },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('training_types').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal menghapus jenis training' }, { status: 500 });
    }

    await auditLog(session.userId, 'DELETE_TRAINING_TYPE', { id });

    return NextResponse.json(
      { ok: true, message: 'Jenis training berhasil dihapus' },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
