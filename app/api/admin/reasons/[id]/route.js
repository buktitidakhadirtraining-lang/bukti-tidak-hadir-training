// app/api/admin/reasons/[id]/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';
import { auditLog } from '../../../../../lib/audit.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;
    const { name, is_active } = await request.json();

    const supabase = getSupabaseAdmin();
    const updatePayload = { updated_at: new Date().toISOString() };
    if (name !== undefined) updatePayload.name = name.trim();
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

    const { data, error } = await supabase
      .from('absence_reasons')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal memperbarui alasan' }, { status: 500 });
    }

    await auditLog(session.userId, 'UPDATE_ABSENCE_REASON', { id });

    return NextResponse.json({ ok: true, message: 'Alasan berhasil diperbarui', data });
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

    const { id } = params;
    const supabase = getSupabaseAdmin();

    const { count } = await supabase
      .from('absence_records')
      .select('*', { count: 'exact', head: true })
      .eq('alasan_id', id);

    if (count > 0) {
      return NextResponse.json(
        { ok: false, error: `Alasan tidak dapat dihapus karena digunakan pada ${count} catatan. Anda dapat menonaktifkannya.` },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('absence_reasons').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal menghapus alasan' }, { status: 500 });
    }

    await auditLog(session.userId, 'DELETE_ABSENCE_REASON', { id });

    return NextResponse.json({ ok: true, message: 'Alasan berhasil dihapus' });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
