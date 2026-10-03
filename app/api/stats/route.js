// app/api/stats/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const year = searchParams.get('year') || String(new Date().getFullYear());
    const month = searchParams.get('month');

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('absence_records')
      .select(`
        id,
        tanggal_pelaksanaan,
        drive_file_id,
        branch_id,
        training_id,
        alasan_id,
        branches ( id, name, code ),
        training_types ( id, name ),
        absence_reasons ( id, name )
      `);

    // Scoping
    if (session.role !== 'admin_pusat') {
      query = query.eq('branch_id', session.branchId);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (year) {
      if (month) {
        const m = String(month).padStart(2, '0');
        const startDate = `${year}-${m}-01`;
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('tanggal_pelaksanaan', startDate).lte('tanggal_pelaksanaan', endDate);
      } else {
        query = query.gte('tanggal_pelaksanaan', `${year}-01-01`).lte('tanggal_pelaksanaan', `${year}-12-31`);
      }
    }

    const { data: records, error } = await query;

    if (error) {
      console.error('[Stats Query Error]:', error);
      return NextResponse.json({ ok: false, error: 'Gagal mengambil data statistik' }, { status: 500 });
    }

    const list = records || [];
    const totalAbsent = list.length;
    let withProofCount = 0;
    let withoutProofCount = 0;

    const trainingMap = {};
    const reasonMap = {};
    const branchMap = {};
    const monthlyMap = {};

    for (let i = 1; i <= 12; i++) {
      const key = `${year}-${String(i).padStart(2, '0')}`;
      monthlyMap[key] = 0;
    }

    list.forEach((rec) => {
      if (rec.drive_file_id) {
        withProofCount++;
      } else {
        withoutProofCount++;
      }

      // Group training
      const tName = rec.training_types?.name || 'Lainnya';
      trainingMap[tName] = (trainingMap[tName] || 0) + 1;

      // Group reason
      const rName = rec.absence_reasons?.name || 'Lainnya';
      reasonMap[rName] = (reasonMap[rName] || 0) + 1;

      // Group branch
      const bName = rec.branches?.name || 'Cabang Tidak Terdaftar';
      branchMap[bName] = (branchMap[bName] || 0) + 1;

      // Group monthly
      if (rec.tanggal_pelaksanaan) {
        const ym = rec.tanggal_pelaksanaan.substring(0, 7);
        if (monthlyMap[ym] !== undefined) {
          monthlyMap[ym]++;
        } else {
          monthlyMap[ym] = 1;
        }
      }
    });

    const byTraining = Object.entries(trainingMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const byReason = Object.entries(reasonMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const byBranch = Object.entries(branchMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const monthlyTrend = Object.entries(monthlyMap)
      .map(([key, count]) => {
        const parts = key.split('-');
        const monthNum = parseInt(parts[1], 10);
        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
          'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
        ];
        return {
          monthKey: key,
          label: monthNames[monthNum - 1] || key,
          count,
        };
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    return NextResponse.json({
      ok: true,
      data: {
        totalAbsent,
        withProofCount,
        withoutProofCount,
        proofRatePercentage: totalAbsent > 0 ? Math.round((withProofCount / totalAbsent) * 100) : 0,
        byTraining,
        byReason,
        byBranch,
        monthlyTrend,
      },
    });
  } catch (err) {
    console.error('[Stats API Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
