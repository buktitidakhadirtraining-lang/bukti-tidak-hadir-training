// app/api/admin/branches/test-drive/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';
import { drivePing } from '../../../../../lib/drive.js';
import { decryptSecret } from '../../../../../lib/crypto.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    let { branch_id, drive_bridge_url, drive_bridge_secret } = body;

    let targetUrl = drive_bridge_url ? drive_bridge_url.trim() : null;
    let targetSecret = drive_bridge_secret ? drive_bridge_secret.trim() : null;

    // Jika secret tidak disertakan langsung (misal saat edit data cabang yang sudah ada), ambil dari database
    if (branch_id && (!targetSecret || !targetUrl)) {
      const supabase = getSupabaseAdmin();
      const { data: branch, error } = await supabase
        .from('branches')
        .select('drive_bridge_url, drive_bridge_secret_enc')
        .eq('id', branch_id)
        .single();

      if (error || !branch || !branch.drive_bridge_url || !branch.drive_bridge_secret_enc) {
        return NextResponse.json(
          { ok: false, error: 'Cabang belum memiliki URL dan Secret Drive Bridge tersimpan' },
          { status: 400 }
        );
      }

      if (!targetUrl) targetUrl = branch.drive_bridge_url;
      if (!targetSecret) targetSecret = decryptSecret(branch.drive_bridge_secret_enc);
    }

    if (!targetUrl || !targetSecret) {
      return NextResponse.json(
        { ok: false, error: 'URL Drive Bridge dan Secret Key wajib diisi untuk melakukan pengujian' },
        { status: 400 }
      );
    }

    const testRes = await drivePing({
      url: targetUrl,
      secret: targetSecret,
    });

    if (!testRes.ok) {
      return NextResponse.json({ ok: false, error: testRes.error || 'Uji koneksi gagal' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: `Koneksi Google Drive Berhasil! Folder "${testRes.folderName}" dapat diakses.`,
      folderName: testRes.folderName,
    });
  } catch (err) {
    console.error('[Test Drive Bridge Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menguji koneksi Google Drive Bridge' },
      { status: 400 }
    );
  }
}
