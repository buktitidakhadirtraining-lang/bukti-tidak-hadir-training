// app/api/records/[id]/file/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';
import { driveGetFile } from '../../../../../lib/drive.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: record, error } = await supabase
      .from('absence_records')
      .select('id, branch_id, drive_file_id, drive_file_name, file_mime_type, branches ( id, name, drive_bridge_url, drive_bridge_secret_enc )')
      .eq('id', id)
      .single();

    if (error || !record || !record.drive_file_id) {
      return NextResponse.json({ ok: false, error: 'Berkas bukti tidak ditemukan' }, { status: 404 });
    }

    if (session.role !== 'admin_pusat' && record.branch_id !== session.branchId) {
      return NextResponse.json({ ok: false, error: 'Akses ditolak' }, { status: 403 });
    }

    if (!record.branches?.drive_bridge_url || !record.branches?.drive_bridge_secret_enc) {
      return NextResponse.json({ ok: false, error: 'Kredensial Drive Bridge belum dikonfigurasi pada cabang ini' }, { status: 400 });
    }

    const fileResult = await driveGetFile(record.branches, record.drive_file_id);

    const fileBuffer = Buffer.from(fileResult.base64, 'base64');
    const mimeType = fileResult.mimeType || record.file_mime_type || 'application/octet-stream';
    const fileName = fileResult.name || record.drive_file_name || 'bukti-berita-acara';

    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('[File Stream Error]:', err);
    return NextResponse.json({ ok: false, error: 'Gagal mengambil berkas bukti dari Google Drive: ' + err.message }, { status: 500 });
  }
}
