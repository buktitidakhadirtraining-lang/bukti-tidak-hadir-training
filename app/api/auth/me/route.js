// app/api/auth/me/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Belum terautentikasi' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        role,
        branch_id,
        must_change_password,
        branches (
          name,
          code
        )
      `)
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            id: session.userId,
            username: session.username,
            role: session.role,
            branch_id: session.branchId,
            full_name: session.username,
            branch_name: null,
            must_change_password: session.mustChangePassword,
          },
        }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branches?.name || null,
        branch_code: user.branches?.code || null,
        must_change_password: user.must_change_password,
      },
    });
  } catch (err) {
    console.error('[Auth Me API Error]:', err);
    return NextResponse.json(
      { ok: false, error: 'Gagal mengambil data sesi' },
      { status: 500 }
    );
  }
}
