// app/api/trainings/route.js
// Endpoint terpusat & selalu segar untuk mengambil daftar Jenis Training Master
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';
import { getEnv } from '../../../lib/env.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('all') === 'true' && session.role === 'admin_pusat';

    const supabase = getSupabaseAdmin();
    let query = supabase.from('training_types').select('*');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // Urutkan konsisten: sort_order terlebih dahulu (jika ada), lalu nama abjad
    query = query.order('sort_order', { ascending: true, nullsFirst: false }).order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[API Trainings GET DB Error]:', error.message);
      return NextResponse.json(
        { ok: false, error: 'Gagal mengambil data jenis training dari database' },
        { status: 500 }
      );
    }

    const env = getEnv();
    const publicConfig = {
      supabaseUrl: env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || null,
    };

    const response = NextResponse.json({
      ok: true,
      data: data || [],
      publicConfig,
      timestamp: Date.now(),
    });

    // Header pencegah cache: pastikan browser & CDN tidak pernah menyajikan cache basi
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (err) {
    console.error('[API Trainings GET Exception]:', err);
    return NextResponse.json(
      { ok: false, error: 'Terjadi kesalahan sistem saat memuat jenis training' },
      { status: 500 }
    );
  }
}
