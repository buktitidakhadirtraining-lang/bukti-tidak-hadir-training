// app/api/records/[id]/file/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../../lib/supabase.js';
import { driveGetFile, driveFindFilesByNik } from '../../../../../lib/drive.js';

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
    const checkOnly = searchParams.get('checkOnly') === 'true';

    const supabase = getSupabaseAdmin();

    const { data: record, error } = await supabase
      .from('absence_records')
      .select('id, nik, nama_peserta, branch_id, drive_file_id, drive_file_name, file_mime_type, branches ( id, name, drive_bridge_url, drive_bridge_secret_enc )')
      .eq('id', id)
      .single();

    if (error || !record) {
      return NextResponse.json({ ok: false, error: 'Data tidak ditemukan', errorCode: '404_NOT_FOUND' }, { status: 404 });
    }

    if (session.role !== 'admin_pusat' && record.branch_id !== session.branchId) {
      return NextResponse.json({ ok: false, error: 'Akses ditolak (foto milik cabang lain)', errorCode: '403_FORBIDDEN' }, { status: 403 });
    }

    if (!record.branches?.drive_bridge_url || !record.branches?.drive_bridge_secret_enc) {
      return NextResponse.json({ ok: false, error: 'Kredensial Drive Bridge belum dikonfigurasi pada cabang ini', errorCode: 'NO_CREDENTIALS' }, { status: 400 });
    }

    const branch = record.branches;
    const storedFileId = (record.drive_file_id || '').trim();

    let fileResult = null;
    let getError = null;

    // 1. Coba ambil foto dengan aksi "get" memakai drive_file_id yang tersimpan
    if (storedFileId) {
      try {
        fileResult = await driveGetFile(branch, storedFileId);
      } catch (err) {
        getError = err;
      }
    } else {
      getError = new Error('ID file drive kosong');
    }

    // Jika berhasil diambil memakai ID tersimpan:
    if (fileResult && fileResult.ok && fileResult.base64) {
      const fileName = fileResult.name || record.drive_file_name || 'bukti-berita-acara';
      let mimeType = fileResult.mimeType || record.file_mime_type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = guessMimeType(fileName, 'image/jpeg');
      }

      if (checkOnly) {
        return NextResponse.json({
          ok: true,
          status: 'OK',
          id: record.id,
          nik: record.nik,
          nama: record.nama_peserta,
          fileName,
          mimeType,
          isHealed: false,
        });
      }

      if (wantJson) {
        return NextResponse.json({
          ok: true,
          id: record.id,
          nik: record.nik,
          nama: record.nama_peserta,
          fileName,
          mimeType,
          isHealed: false,
          dataUrl: `data:${mimeType};base64,${fileResult.base64}`,
        });
      }

      const fileBuffer = Buffer.from(fileResult.base64, 'base64');
      const headers = new Headers();
      headers.set('Content-Type', mimeType);
      headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      headers.set('Cache-Control', 'public, max-age=3600');

      return new Response(fileBuffer, { status: 200, headers });
    }

    // 2. SELF-HEALING (PEMULIHAN OTOMATIS)
    // Jika 404, 403, atau ID kosong -> Panggil aksi "find" dengan prefix = NIK
    let findResult = null;
    let findError = null;

    try {
      findResult = await driveFindFilesByNik(branch, record.nik);
    } catch (err) {
      findError = err;
    }

    // Cek jika versi Apps Script belum mendukung "find"
    const findErrMsg = findError?.message || '';
    if (
      findErrMsg.includes('tidak dikenali') ||
      findErrMsg.includes('Aksi find') ||
      findErrMsg.includes('Aksi "find"')
    ) {
      const outdatedMsg = 'Apps Script cabang belum diperbarui ke versi terbaru (v5), lakukan deploy Versi baru';
      return NextResponse.json(
        {
          ok: false,
          status: 'OUTDATED_SCRIPT',
          id: record.id,
          nik: record.nik,
          nama: record.nama_peserta,
          error: outdatedMsg,
          isOutdatedScript: true,
          isHealed: false,
        },
        { status: 404 }
      );
    }

    const matchedFiles = findResult?.files || [];
    // Filter file gambar yang valid
    const imageFiles = matchedFiles.filter((f) => {
      const mime = (f.mimeType || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      return (
        mime.startsWith('image/') ||
        name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.webp')
      );
    });

    if (imageFiles.length > 0) {
      // Pilih file terbaru
      const newestFile = imageFiles[0];
      const healedFileId = newestFile.fileId || newestFile.id;

      try {
        const healedGet = await driveGetFile(branch, healedFileId);
        if (healedGet && healedGet.ok && healedGet.base64) {
          const fileName = newestFile.name || healedGet.name || 'bukti-berita-acara.png';
          let mimeType = newestFile.mimeType || healedGet.mimeType;
          if (!mimeType || mimeType === 'application/octet-stream') {
            mimeType = guessMimeType(fileName, 'image/png');
          }

          const foundCount = imageFiles.length;
          const note =
            foundCount > 1 ? `Ditemukan ${foundCount} file untuk NIK ini, memakai yang terbaru` : null;

          if (checkOnly) {
            return NextResponse.json({
              ok: true,
              status: 'RESTORED',
              id: record.id,
              nik: record.nik,
              nama: record.nama_peserta,
              fileName,
              mimeType,
              isHealed: true,
              healedFileId,
              originalFileId: storedFileId,
              foundCount,
              note,
            });
          }

          if (wantJson) {
            return NextResponse.json({
              ok: true,
              id: record.id,
              nik: record.nik,
              nama: record.nama_peserta,
              fileName,
              mimeType,
              isHealed: true,
              healedFileId,
              originalFileId: storedFileId,
              foundCount,
              note,
              dataUrl: `data:${mimeType};base64,${healedGet.base64}`,
            });
          }

          const fileBuffer = Buffer.from(healedGet.base64, 'base64');
          const headers = new Headers();
          headers.set('Content-Type', mimeType);
          headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
          headers.set('Cache-Control', 'public, max-age=3600');

          return new Response(fileBuffer, { status: 200, headers });
        }
      } catch (hErr) {
        console.warn(`[Self-healing get failed for ${healedFileId}]:`, hErr.message);
      }
    }

    // 3. Jika "find" tidak menemukan file sama sekali
    const notFoundMsg = 'Foto tidak ada di Drive. Upload ulang melalui Riwayat Data Input.';
    return NextResponse.json(
      {
        ok: false,
        status: 'NOT_IN_DRIVE',
        id: record.id,
        nik: record.nik,
        nama: record.nama_peserta,
        error: notFoundMsg,
        errorCode: 'NOT_IN_DRIVE',
        isHealed: false,
      },
      { status: 404 }
    );
  } catch (err) {
    console.error('[File Stream Error]:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Terjadi kesalahan sistem saat memuat foto',
        errorCode: 'FETCH_FAILED',
      },
      { status: 500 }
    );
  }
}
