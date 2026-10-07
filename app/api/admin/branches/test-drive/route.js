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
    let { branch_id, drive_bridge_url, drive_bridge_secret } = body || {};

    let targetUrl = drive_bridge_url ? String(drive_bridge_url).trim() : '';
    let secretToUse = null;
    let secretSource = 'none';

    // Cek apakah admin mengetik secret baru di kolom (bukan placeholder dot '•' dan tidak kosong)
    const isNewInputSecret =
      drive_bridge_secret &&
      typeof drive_bridge_secret === 'string' &&
      drive_bridge_secret.trim().length > 0 &&
      !drive_bridge_secret.includes('•');

    if (isNewInputSecret) {
      secretToUse = drive_bridge_secret.trim();
      secretSource = 'input_baru';
    } else if (branch_id) {
      // Ambil secret tersimpan di database untuk cabang ini
      const supabase = getSupabaseAdmin();
      const { data: branch, error } = await supabase
        .from('branches')
        .select('drive_bridge_url, drive_bridge_secret_enc')
        .eq('id', branch_id)
        .maybeSingle();

      if (error || !branch) {
        return NextResponse.json(
          { ok: false, error: 'Data cabang tidak ditemukan di database' },
          { status: 400 }
        );
      }

      if (!targetUrl && branch.drive_bridge_url) {
        targetUrl = String(branch.drive_bridge_url).trim();
      }

      if (!branch.drive_bridge_secret_enc) {
        return NextResponse.json(
          { ok: false, error: 'Cabang belum memiliki Secret Drive Bridge tersimpan. Silakan masukkan Secret Key baru.' },
          { status: 400 }
        );
      }

      const decrypted = decryptSecret(branch.drive_bridge_secret_enc);
      if (!decrypted || !decrypted.trim()) {
        return NextResponse.json(
          { ok: false, error: 'Secret tersimpan tidak bisa didekripsi, silakan masukkan ulang secret' },
          { status: 400 }
        );
      }

      secretToUse = decrypted.trim();
      secretSource = 'database';
    }

    if (!targetUrl) {
      return NextResponse.json(
        { ok: false, error: 'URL Drive Bridge wajib diisi untuk menguji koneksi' },
        { status: 400 }
      );
    }

    if (!secretToUse) {
      return NextResponse.json(
        { ok: false, error: 'Secret Key Drive Bridge wajib diisi untuk menguji koneksi cabang baru' },
        { status: 400 }
      );
    }

    // Panggil drivePing dari server (menghindari CORS) dengan logging aman (tanpa mencetak plaintext secret)
    const testRes = await drivePing({
      url: targetUrl,
      secret: secretToUse,
      source: secretSource,
    });

    if (!testRes.ok) {
      return NextResponse.json({ ok: false, error: testRes.error || 'Uji koneksi gagal' }, { status: 400 });
    }

    console.log(
      `[Test Drive Bridge Result] Success: Folder "${testRes.folderName}" | Source: ${secretSource}`
    );

    return NextResponse.json({
      ok: true,
      message: `Koneksi Google Drive Berhasil! Folder "${testRes.folderName}" dapat diakses.`,
      folderName: testRes.folderName,
    });
  } catch (err) {
    console.error('[Test Drive Bridge Error]:', err.message || err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menguji koneksi Google Drive Bridge' },
      { status: 400 }
    );
  }
}
