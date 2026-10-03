// app/api/admin/users/[id]/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';
import { hashPassword, validatePasswordStrength } from '../../../../../lib/auth.js';
import { auditLog } from '../../../../../lib/audit.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      full_name,
      role,
      branch_id,
      is_active,
      reset_password,
      unlock_account,
    } = body;

    const supabase = getSupabaseAdmin();

    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) updatePayload.full_name = full_name.trim();
    if (role !== undefined) updatePayload.role = role;
    if (branch_id !== undefined) updatePayload.branch_id = role === 'admin_pusat' ? null : branch_id;
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

    if (unlock_account) {
      updatePayload.failed_login_count = 0;
      updatePayload.locked_until = null;
    }

    if (reset_password) {
      const pwd = reset_password.trim();
      const strength = validatePasswordStrength(pwd);
      if (!strength.valid && !strength.isValid) {
        return NextResponse.json({ ok: false, error: strength.message }, { status: 400 });
      }
      updatePayload.password_hash = await hashPassword(pwd);
      updatePayload.must_change_password = true;
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select('id, username, full_name, role, branch_id, is_active, must_change_password')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal memperbarui data pengguna' }, { status: 500 });
    }

    await auditLog(session.userId, 'UPDATE_USER', { targetUserId: id });

    return NextResponse.json({ ok: true, message: 'Data pengguna berhasil diperbarui', data: updated });
  } catch (err) {
    console.error('[User PUT Error]:', err);
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

    // Cegah hapus akun sendiri
    if (session.userId === id) {
      return NextResponse.json({ ok: false, error: 'Anda tidak dapat menghapus akun Anda sendiri' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('users').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal menghapus pengguna' }, { status: 500 });
    }

    await auditLog(session.userId, 'DELETE_USER', { targetUserId: id });

    return NextResponse.json({ ok: true, message: 'Pengguna berhasil dihapus' });
  } catch (err) {
    console.error('[User DELETE Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
