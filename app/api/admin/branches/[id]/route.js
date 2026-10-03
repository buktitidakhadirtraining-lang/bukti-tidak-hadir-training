// app/api/admin/branches/[id]/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';
import { encryptSecret } from '../../../../../lib/crypto.js';
import { auditLog } from '../../../../../lib/audit.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, code, drive_bridge_url, drive_bridge_secret, is_active } = body;

    const supabase = getSupabaseAdmin();

    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = name.trim();
    if (code !== undefined) updatePayload.code = code.trim().toUpperCase();
    if (drive_bridge_url !== undefined) {
      updatePayload.drive_bridge_url = drive_bridge_url ? drive_bridge_url.trim() : null;
    }
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

    if (drive_bridge_secret !== undefined && drive_bridge_secret.trim()) {
      updatePayload.drive_bridge_secret_enc = encryptSecret(drive_bridge_secret.trim());
    }

    const { data: updated, error } = await supabase
      .from('branches')
      .update(updatePayload)
      .eq('id', id)
      .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc, is_active, created_at')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal memperbarui cabang: ' + error.message }, { status: 500 });
    }

    await auditLog(session.userId, 'UPDATE_BRANCH', { branchId: id });

    return NextResponse.json({
      ok: true,
      message: 'Data cabang berhasil diperbarui',
      data: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        drive_bridge_url: updated.drive_bridge_url,
        is_active: updated.is_active,
        created_at: updated.created_at,
        has_drive_bridge: Boolean(updated.drive_bridge_url && updated.drive_bridge_secret_enc),
      },
    });
  } catch (err) {
    console.error('[Branch PUT Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Cek apakah ada catatan ketidakhadiran di cabang ini
    const { count, error: countErr } = await supabase
      .from('absence_records')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id);

    if (count > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cabang tidak dapat dihapus karena masih memiliki ${count} data ketidakhadiran terkait. Anda dapat menonaktifkan cabang ini.`,
        },
        { status: 400 }
      );
    }

    const { error: delErr } = await supabase.from('branches').delete().eq('id', id);

    if (delErr) {
      return NextResponse.json({ ok: false, error: 'Gagal menghapus cabang: ' + delErr.message }, { status: 500 });
    }

    await auditLog(session.userId, 'DELETE_BRANCH', { branchId: id });

    return NextResponse.json({ ok: true, message: 'Cabang berhasil dihapus' });
  } catch (err) {
    console.error('[Branch DELETE Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
