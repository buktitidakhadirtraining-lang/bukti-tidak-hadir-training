// app/api/auth/change-password/route.js
import { NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  createSessionToken,
  getSessionCookieOptions,
} from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { comparePassword, hashPassword, validatePasswordStrength } from '../../../../lib/auth.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // 1. Pastikan pengguna sudah login
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' },
        { status: 401 }
      );
    }

    // 2. Baca isian dari browser
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Data yang dikirim tidak valid' },
        { status: 400 }
      );
    }
    const { currentPassword, newPassword, confirmPassword } = body || {};

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, error: 'Password saat ini dan password baru wajib diisi' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, error: 'Konfirmasi password baru tidak cocok' },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { ok: false, error: 'Password baru tidak boleh sama dengan password saat ini' },
        { status: 400 }
      );
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json(
        { ok: false, error: strength.message },
        { status: 400 }
      );
    }

    // 3. Ambil data pengguna dari database
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, branch_id, password_hash, is_active')
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { ok: false, error: 'Akun Anda dinonaktifkan. Hubungi Admin Pusat.' },
        { status: 403 }
      );
    }

    // 4. Cek password lama
    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { ok: false, error: 'Password saat ini yang Anda masukkan salah' },
        { status: 400 }
      );
    }

    // 5. Simpan password baru dan matikan tanda "wajib ganti password"
    const newHash = await hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newHash,
        must_change_password: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Change Password] Gagal update:', updateError);
      return NextResponse.json(
        { ok: false, error: 'Gagal memperbarui password di database' },
        { status: 500 }
      );
    }

    // 6. Buat token login BARU (tanda mustChangePassword = false) dan pasang di cookie
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branch_id,
      mustChangePassword: false,
    });

    const response = NextResponse.json({
      ok: true,
      message: 'Password berhasil diperbarui',
      data: {
        userId: user.id,
        username: user.username,
        role: user.role,
        branchId: user.branch_id,
        mustChangePassword: false,
      },
    });

    const cookieOptions = getSessionCookieOptions();
    response.cookies.set({
      name: cookieOptions.name,
      value: token,
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    return response;
  } catch (err) {
    console.error('[Change Password Error]:', err);
    return NextResponse.json(
      { ok: false, error: 'Terjadi kesalahan sistem saat memperbarui password' },
      { status: 500 }
    );
  }
}