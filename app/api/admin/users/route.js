// app/api/admin/users/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { hashPassword, validatePasswordStrength } from '../../../../lib/auth.js';
import { auditLog } from '../../../../lib/audit.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        role,
        branch_id,
        is_active,
        must_change_password,
        failed_login_count,
        locked_until,
        created_at,
        branches ( id, name, code )
      `)
      .order('username');

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal mengambil data pengguna' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: users || [] });
  } catch (err) {
    console.error('[Admin Users GET Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { username, full_name, role, branch_id, initial_password } = body;

    if (!username || !full_name || !role) {
      return NextResponse.json({ ok: false, error: 'Username, Nama Lengkap, dan Role wajib diisi' }, { status: 400 });
    }

    if (role === 'admin_cabang' && !branch_id) {
      return NextResponse.json({ ok: false, error: 'Admin Cabang wajib memilih cabang penugasan' }, { status: 400 });
    }

    const pwdToUse = initial_password ? initial_password.trim() : 'Indomaret123!';
    const strength = validatePasswordStrength(pwdToUse);
    if (!strength.valid) {
      return NextResponse.json({ ok: false, error: strength.message }, { status: 400 });
    }

    const passwordHash = await hashPassword(pwdToUse);
    const supabase = getSupabaseAdmin();

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username: username.trim().toLowerCase(),
        full_name: full_name.trim(),
        role,
        branch_id: role === 'admin_pusat' ? null : branch_id,
        password_hash: passwordHash,
        must_change_password: true,
        is_active: true,
      })
      .select('id, username, full_name, role, branch_id, is_active, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Username sudah digunakan' }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: 'Gagal membuat pengguna: ' + error.message }, { status: 500 });
    }

    await auditLog(session.userId, 'CREATE_USER', { targetUserId: newUser.id, username: newUser.username });

    return NextResponse.json({
      ok: true,
      message: 'Pengguna berhasil ditambahkan dengan password awal: ' + pwdToUse,
      data: newUser,
    });
  } catch (err) {
    console.error('[Admin Users POST Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
