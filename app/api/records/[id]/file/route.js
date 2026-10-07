// app/api/records/[id]/file/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';
import { driveGetFile } from '../../../../../lib/drive.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function guessMimeType(fileName, fallbackMime) {
  if (!fileName) return fallbackMime || 'application/octet-stream';
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'pdf':
      return 'application/pdf';
    default:
      return fallbackMime || 'image/jpeg';
  }
}

export async function GET(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const wantJson = searchParams.get('json') === 'true';

    const supabase = getSupabaseAdmin();

    const { data: record, error } = await supabase
      .from('absence_records')
      .select('id, nik, nama_peserta, branch_id, drive_file_id, drive_file_name, file_mime_type, branches ( id, name, drive_bridge_url, drive_bridge_secret_enc )')
      .eq('id', id)
      .single();

    if (error || !record || !record.drive_file_id) {
      return NextResponse.json({ ok: false, error: 'ID file bukti kosong atau data tidak ditemukan', errorCode: '404_NOT_FOUND' }, { status: 404 });
    }

    if (session.role !== 'admin_pusat' && record.branch_id !== session.branchId) {
      return NextResponse.json({ ok: false, error: 'Akses ditolak (foto milik cabang lain)', errorCode: '403_FORBIDDEN' }, { status: 403 });
    }

    if (!record.branches?.drive_bridge_url || !record.branches?.drive_bridge_secret_enc) {
      return NextResponse.json({ ok: false, error: 'Kredensial Drive Bridge belum dikonfigurasi pada cabang ini', errorCode: 'NO_CREDENTIALS' }, { status: 400 });
    }

    const fileResult = await driveGetFile(record.branches, record.drive_file_id);

    const fileName = fileResult.name || record.drive_file_name || 'bukti-berita-acara';
    let mimeType = fileResult.mimeType || record.file_mime_type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      mimeType = guessMimeType(fileName, 'image/jpeg');
    }

    const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif' || fileName.toLowerCase().endsWith('.heic') || fileName.toLowerCase().endsWith('.heif');

    if (wantJson) {
      return NextResponse.json({
        ok: true,
        id: record.id,
        nik: record.nik,
        nama: record.nama_peserta,
        fileName,
        mimeType,
        isHeic,
        dataUrl: `data:${mimeType};base64,${fileResult.base64}`,
      });
    }

    const fileBuffer = Buffer.from(fileResult.base64, 'base64');
    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    headers.set('Cache-Control', 'public, max-age=3600');
    if (isHeic) {
      headers.set('X-Unsupported-Format', 'HEIC');
    }

    return new Response(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('[File Stream Error]:', err);
    let statusCode = 500;
    let errCode = 'FETCH_FAILED';
    const msg = err.message || '';

    if (msg.includes('timeout') || msg.includes('Timeout')) {
      statusCode = 504;
      errCode = 'TIMEOUT';
    } else if (msg.includes('tidak ditemukan') || msg.includes('404')) {
      statusCode = 404;
      errCode = 'NOT_FOUND';
    } else if (msg.includes('Akses') || msg.includes('403') || msg.includes('di luar folder')) {
      statusCode = 403;
      errCode = 'FORBIDDEN';
    }

    return NextResponse.json(
      { ok: false, error: msg, errorCode: errCode },
      { status: statusCode }
    );
  }
}
