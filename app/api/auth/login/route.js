// app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import {
  comparePassword,
  hashPassword,
  isAccountLocked,
  handleFailedLogin,
  resetFailedLogin,
} from '../../../../lib/auth.js';
import { createSessionToken, getSessionCookieOptions } from '../../../../lib/session.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: 'Username dan password wajib diisi' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();

    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (envErr) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Database Supabase belum dikonfigurasi. Silakan atur SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local.',
        },
        { status: 500 }
      );
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, full_name, role, branch_id, is_active, must_change_password, failed_login_count, locked_until')
      .ilike('username', cleanUsername)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { ok: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi Admin Pusat.' },
        { status: 403 }
      );
    }

    if (isAccountLocked(user)) {
      const lockUntilDate = new Date(user.locked_until);
      const minutesRemaining = Math.ceil((lockUntilDate.getTime() - Date.now()) / (60 * 1000));
      return NextResponse.json(
        {
          ok: false,
          error: `Akun terkunci karena salah memasukkan password sebanyak 5 kali. Silakan tunggu ${minutesRemaining} menit lagi.`,
        },
        { status: 423 }
      );
    }

    let isMatch = await comparePassword(password, user.password_hash);

    // Pemulihan hash warisan (jika akun di database masih menyimpan hash dummy lama):
    // Izinkan login sekali dan otomatis perbarui hash ke bcrypt valid.
    // Setelah password diganti pengguna, password_hash sudah baru sehingga blok ini tidak akan aktif lagi.
    const isLegacyBrokenHash =
      user.password_hash === '$2a$10$cK8aSILI1HDNtig6g5KE.eng5hlEZdT3RuIUtewCXbYyE0BWW2bLm' ||
      user.password_hash === '$2a$10$U1Hp1eivxEB1/m2CRngclODYURdj0eKxRxRH7dzayBZhhNfD3l7/G';

    if (!isMatch && isLegacyBrokenHash && (password === 'Admin123!' || password === 'admin123')) {
      isMatch = true;
      try {
        const fixedHash = await hashPassword(password);
        await supabase
          .from('users')
          .update({ password_hash: fixedHash, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      } catch (patchErr) {
        console.warn('[Login] Gagal update hash warisan:', patchErr);
      }
    }

    if (!isMatch) {
      const lockResult = await handleFailedLogin(user.id, user.failed_login_count);
      if (lockResult.locked) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Akun terkunci selama 15 menit karena 5 kali salah memasukkan password.',
          },
          { status: 423 }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          error: `Username atau password salah. Sisa kesempatan sebelum akun terkunci: ${lockResult.remainingAttempts} kali.`,
        },
        { status: 401 }
      );
    }

    // Reset hitungan gagal login
    await resetFailedLogin(user.id);

    // Buat JWT token
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branch_id,
      mustChangePassword: user.must_change_password,
    });

    const response = NextResponse.json({
      ok: true,
      data: {
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        branchId: user.branch_id,
        mustChangePassword: user.must_change_password,
      },
    });

    // Simpan token ke cookie httpOnly
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
    console.error('[Login API Error]:', err);
    return NextResponse.json(
      { ok: false, error: 'Terjadi kesalahan sistem saat memproses login.' },
      { status: 500 }
    );
  }
}
