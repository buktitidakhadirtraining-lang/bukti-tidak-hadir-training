// app/api/admin/trainings/check-usage/route.js
// Memeriksa berapa banyak data di Input Data & Input Data Tambahan yang memakai nama lama
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session.js';
import { getSupabaseAdmin } from '@/lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get('id');
    const oldName = searchParams.get('name')?.trim();

    if (!oldName) {
      return NextResponse.json({ ok: true, countAbsence: 0, countTambahan: 0, totalCount: 0 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Hitung data di absence_records (Input Data)
    // Bisa berdasarkan training_id atau nama jenis training
    let countAbsence = 0;
    if (trainingId) {
      const { count } = await supabase
        .from('absence_records')
        .select('id', { count: 'exact', head: true })
        .eq('training_id', trainingId);
      countAbsence = count || 0;
    }

    // 2. Hitung data di data_tambahan (Input Data Tambahan)
    // Berdasarkan training_id, jenis_training_id, atau text kolom training
    let countTambahan = 0;
    const { count: countTambahanText } = await supabase
      .from('data_tambahan')
      .select('id', { count: 'exact', head: true })
      .ilike('training', oldName);
    countTambahan = countTambahanText || 0;

    if (trainingId) {
      const { count: countTambahanId } = await supabase
        .from('data_tambahan')
        .select('id', { count: 'exact', head: true })
        .eq('training_id', trainingId);
      if (countTambahanId && countTambahanId > countTambahan) {
        countTambahan = countTambahanId;
      }
    }

    return NextResponse.json({
      ok: true,
      countAbsence,
      countTambahan,
      totalCount: countAbsence + countTambahan,
      oldName,
    });
  } catch (err) {
    console.error('[check-usage Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memeriksa penggunaan data' },
      { status: 500 }
    );
  }
}
