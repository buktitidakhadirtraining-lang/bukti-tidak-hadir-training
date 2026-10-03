// app/api/meta/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';
import { POSITIONS, MONTHS } from '../../../lib/config.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const [branchesRes, trainingsRes, reasonsRes] = await Promise.all([
      supabase
        .from('branches')
        .select('id, name, code, is_active, drive_bridge_url, drive_bridge_secret_enc')
        .eq('is_active', true)
        .order('name'),
      supabase.from('training_types').select('id, name, is_active').eq('is_active', true).order('name'),
      supabase.from('absence_reasons').select('id, name, is_active').eq('is_active', true).order('name'),
    ]);

    let reasons = reasonsRes.data || [];

    // Pastikan 'Lain - lain' selalu ada di daftar alasan
    const hasLainLain = reasons.some((r) => r.name.toLowerCase().includes('lain'));
    if (!hasLainLain) {
      try {
        const { data: inserted } = await supabase
          .from('absence_reasons')
          .insert({ name: 'Lain - lain', is_active: true, sort_order: 11 })
          .select()
          .single();
        if (inserted) {
          reasons.push(inserted);
        } else {
          reasons.push({ id: 'ar-011', name: 'Lain - lain', is_active: true });
        }
      } catch {
        reasons.push({ id: 'ar-011', name: 'Lain - lain', is_active: true });
      }
      reasons.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    }

    // Format data cabang: sediakan flag `driveReady` tanpa mengekspos secret
    const branches = (branchesRes.data || []).map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      is_active: b.is_active,
      driveReady: Boolean(b.drive_bridge_url && b.drive_bridge_secret_enc),
    }));

    const trainings = trainingsRes.data || [];

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
    const batches = Array.from({ length: 50 }, (_, i) => i + 1);

    return NextResponse.json({
      ok: true,
      data: {
        branches,
        trainings,
        reasons,
        positions: POSITIONS,
        months: MONTHS,
        years,
        batches,
        userRole: session.role,
        userBranchId: session.branchId,
      },
    });
  } catch (err) {
    console.error('[Meta API Error]:', err);
    return NextResponse.json(
      { ok: false, error: 'Gagal mengambil metadata sistem' },
      { status: 500 }
    );
  }
}
