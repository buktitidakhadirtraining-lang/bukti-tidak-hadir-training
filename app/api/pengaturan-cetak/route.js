// app/api/pengaturan-cetak/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const isValidUuid = (val) =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export const DEFAULT_SOFT_SKILL_CONFIG = {
  mengetahui2_jabatan: 'Deputy Branch Manager ADM',
  mengetahui2_nama: 'RICKY MARIO',
  mengetahui1_jabatan: 'Human Resource Manager',
  mengetahui1_nama: 'ABEDNEGO SETYA NUGROHO',
  membuat_jabatan: 'Training Center Supervisor',
  membuat_nama: 'ROKHMAN',
  mode_gambar: 'hanya_ttd', // 'hanya_ttd' | 'lengkap'
  ttd_scale: 100, // 80 - 130 (%)
  ttd_offset_y: 0, // -20 sampai +20 (px)
  ttd_offset_x: 0, // -30 sampai +30 (px)
};

/**
 * Helper: Mengambil data cabang yang valid untuk user session saat ini
 */
async function getEffectiveBranch(session, requestedBranchId, supabase) {
  let targetBranchId = session.branchId;

  if (session.role === 'admin_pusat' && requestedBranchId) {
    targetBranchId = requestedBranchId;
  }

  if (!targetBranchId && session.userId) {
    const { data: user } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', session.userId)
      .maybeSingle();
    if (user?.branch_id) {
      targetBranchId = user.branch_id;
    }
  }

  if (!targetBranchId) {
    const { data: firstBranch } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    return firstBranch || null;
  }

  const { data: branch, error } = await supabase
    .from('branches')
    .select('id, name, code')
    .eq('id', targetBranchId)
    .maybeSingle();

  if (error || !branch) {
    return null;
  }

  return branch;
}

/**
 * GET: Ambil pengaturan cetak untuk cabang aktif
 */
export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branch_id');
    const jenis = searchParams.get('jenis') || 'soft_skill';
    const supabase = getSupabaseAdmin();

    const branch = await getEffectiveBranch(session, requestedBranchId, supabase);
    if (!branch) {
      return NextResponse.json({ ok: false, error: 'Data cabang tidak ditemukan' }, { status: 404 });
    }

    const { data: record, error: dbError } = await supabase
      .from('pengaturan_cetak')
      .select('id, cabang, jenis, data, updated_at')
      .ilike('cabang', branch.name.trim())
      .eq('jenis', jenis)
      .maybeSingle();

    if (dbError) {
      console.warn('[GET /api/pengaturan-cetak] DB error:', dbError.message);
      // Jika tabel belum dibuat atau error, tetap return nilai default agar UI tidak rusak
      return NextResponse.json({
        ok: true,
        data: DEFAULT_SOFT_SKILL_CONFIG,
        cabang: branch.name,
        branchId: branch.id,
        isDefault: true,
        warning: dbError.message,
      });
    }

    const mergedData = {
      ...DEFAULT_SOFT_SKILL_CONFIG,
      ...(record?.data || {}),
    };

    return NextResponse.json({
      ok: true,
      data: mergedData,
      cabang: branch.name,
      branchId: branch.id,
      isDefault: !record,
    });
  } catch (err) {
    console.error('[GET /api/pengaturan-cetak Error]:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}

/**
 * POST: Simpan / Perbarui pengaturan cetak untuk cabang aktif
 */
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Hanya Admin Cabang atau Admin Pusat yang boleh menyimpan
    if (session.role !== 'admin_cabang' && session.role !== 'admin_pusat') {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak: Hanya Admin Cabang atau Admin Pusat yang dapat mengubah pengaturan penandatangan.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { jenis = 'soft_skill', data, branch_id: requestedBranchId } = body;

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Data pengaturan penandatangan wajib disertakan' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const branch = await getEffectiveBranch(session, requestedBranchId, supabase);

    if (!branch) {
      return NextResponse.json({ ok: false, error: 'Data cabang tidak ditemukan' }, { status: 404 });
    }

    const payload = {
      cabang: branch.name.trim(),
      jenis: jenis || 'soft_skill',
      data: {
        mengetahui2_jabatan: data.mengetahui2_jabatan?.trim() || DEFAULT_SOFT_SKILL_CONFIG.mengetahui2_jabatan,
        mengetahui2_nama: data.mengetahui2_nama?.trim() || DEFAULT_SOFT_SKILL_CONFIG.mengetahui2_nama,
        mengetahui1_jabatan: data.mengetahui1_jabatan?.trim() || DEFAULT_SOFT_SKILL_CONFIG.mengetahui1_jabatan,
        mengetahui1_nama: data.mengetahui1_nama?.trim() || DEFAULT_SOFT_SKILL_CONFIG.mengetahui1_nama,
        membuat_jabatan: data.membuat_jabatan?.trim() || DEFAULT_SOFT_SKILL_CONFIG.membuat_jabatan,
        membuat_nama: data.membuat_nama?.trim() || DEFAULT_SOFT_SKILL_CONFIG.membuat_nama,
        mode_gambar: data.mode_gambar === 'lengkap' ? 'lengkap' : 'hanya_ttd',
        ttd_scale: typeof data.ttd_scale === 'number' ? Math.max(80, Math.min(130, data.ttd_scale)) : 100,
        ttd_offset_y: typeof data.ttd_offset_y === 'number' ? Math.max(-20, Math.min(20, data.ttd_offset_y)) : 0,
        ttd_offset_x: typeof data.ttd_offset_x === 'number' ? Math.max(-30, Math.min(30, data.ttd_offset_x)) : 0,
      },
      updated_by: isValidUuid(session.userId) ? session.userId : null,
      updated_at: new Date().toISOString(),
    };

    const { data: savedRecord, error: upsertError } = await supabase
      .from('pengaturan_cetak')
      .upsert(payload, { onConflict: 'cabang,jenis' })
      .select()
      .single();

    if (upsertError) {
      console.error('[POST /api/pengaturan-cetak] Upsert Error:', upsertError.message);
      return NextResponse.json(
        {
          ok: false,
          error: `Gagal menyimpan data ke database Supabase: ${upsertError.message}. Pastikan tabel 'pengaturan_cetak' sudah dibuat di Supabase SQL Editor.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: savedRecord.data,
      message: 'Pengaturan penandatangan berhasil disimpan!',
    });
  } catch (err) {
    console.error('[POST /api/pengaturan-cetak Exception]:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Kesalahan sistem' }, { status: 500 });
  }
}
