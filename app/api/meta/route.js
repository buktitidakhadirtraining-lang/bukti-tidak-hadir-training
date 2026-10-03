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
        .order('name'),
      supabase.from('training_types').select('id, name, is_active').order('name'),
      supabase.from('absence_reasons').select('id, name, is_active').order('name'),
    ]);

    // Format data cabang: sediakan flag `driveReady` tanpa mengekspos secret
    const branches = (branchesRes.data || []).map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      is_active: b.is_active,
      driveReady: Boolean(b.drive_bridge_url && b.drive_bridge_secret_enc),
    }));

    const trainings = trainingsRes.data || [];
    const reasons = reasonsRes.data || [];

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
