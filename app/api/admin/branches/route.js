// app/api/admin/branches/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { encryptSecret } from '../../../../lib/crypto.js';
import { auditLog } from '../../../../lib/audit.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: Daftar semua cabang
export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Akses khusus Admin Pusat' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc, is_active, created_at')
      .order('name');

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal mengambil data cabang: ' + error.message }, { status: 500 });
    }

    // Jangan kirim isi secret terenkripsi ke frontend demi keamanan, cukup status has_drive_bridge
    const safeBranches = (branches || []).map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      drive_bridge_url: b.drive_bridge_url || null,
      is_active: b.is_active,
      created_at: b.created_at,
      has_drive_bridge: Boolean(b.drive_bridge_url && b.drive_bridge_secret_enc),
    }));

    return NextResponse.json({ ok: true, data: safeBranches });
  } catch (err) {
    console.error('[Admin Branches GET Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}

// POST: Tambah cabang baru
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Akses khusus Admin Pusat' }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, drive_bridge_url, drive_bridge_secret, is_active = true } = body;

    if (!name || !code) {
      return NextResponse.json({ ok: false, error: 'Nama dan Kode Cabang wajib diisi' }, { status: 400 });
    }

    let encryptedSecret = null;
    if (drive_bridge_secret && drive_bridge_secret.trim()) {
      encryptedSecret = encryptSecret(drive_bridge_secret.trim());
    }

    const cleanUrl = drive_bridge_url ? drive_bridge_url.trim() : null;

    const supabase = getSupabaseAdmin();
    const { data: newBranch, error } = await supabase
      .from('branches')
      .insert({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        drive_bridge_url: cleanUrl,
        drive_bridge_secret_enc: encryptedSecret,
        is_active: Boolean(is_active),
      })
      .select('id, name, code, drive_bridge_url, is_active, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Kode cabang atau nama cabang sudah terdaftar di sistem' }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: 'Gagal menambahkan cabang: ' + error.message }, { status: 500 });
    }

    await auditLog(session.userId, 'CREATE_BRANCH', { branchId: newBranch.id, code: newBranch.code });

    return NextResponse.json({
      ok: true,
      message: 'Cabang berhasil ditambahkan',
      data: {
        ...newBranch,
        has_drive_bridge: Boolean(newBranch.drive_bridge_url && encryptedSecret),
      },
    });
  } catch (err) {
    console.error('[Admin Branches POST Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
