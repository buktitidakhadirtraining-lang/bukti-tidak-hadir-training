// app/api/data-tambahan/[id]/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import {
  resolveUserBranchId,
  updateDataTambahanRecord,
  deleteDataTambahanRecord,
} from '../../../../lib/data-service.js';
import { driveUpload, driveTrash } from '../../../../lib/drive.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function formatTambahanFileName(nik, nama, ext = 'jpg') {
  const cleanNik = String(nik || '').trim();
  const cleanNama = String(nama || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const cleanExt = (ext || 'jpg').replace(/^\./, '').toLowerCase() === 'jpeg' ? 'jpg' : (ext || 'jpg').replace(/^\./, '').toLowerCase();
  return `${cleanNik}_TB_${cleanNama}_${dateStr}.${cleanExt}`;
}

/**
 * PUT: Edit data tambahan berdasarkan ID (termasuk ganti / hapus foto)
 */
export async function PUT(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const contentType = request.headers.get('content-type') || '';
    const supabase = getSupabaseAdmin();

    // Ambil data record saat ini sebelum diedit
    const { data: currentRec, error: fetchErr } = await supabase
      .from('data_tambahan')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !currentRec) {
      return NextResponse.json({ ok: false, error: 'Data tambahan tidak ditemukan' }, { status: 404 });
    }

    let training = currentRec.training;
    let nik = currentRec.nik;
    let nama = currentRec.nama;
    let kd_toko = currentRec.kd_toko;
    let nama_toko = currentRec.nama_toko;
    let alasan_tidak_hadir = currentRec.alasan_tidak_hadir;
    let no = currentRec.no;
    let deletePhoto = false;
    let newPhotoFile = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      if (formData.has('training')) training = formData.get('training')?.toString().trim();
      if (formData.has('nik')) nik = formData.get('nik')?.toString().trim();
      if (formData.has('nama')) nama = formData.get('nama')?.toString().trim();
      if (formData.has('kd_toko')) kd_toko = formData.get('kd_toko')?.toString().trim();
      if (formData.has('nama_toko')) nama_toko = formData.get('nama_toko')?.toString().trim();
      if (formData.has('alasan_tidak_hadir')) alasan_tidak_hadir = formData.get('alasan_tidak_hadir')?.toString().trim();
      if (formData.has('no')) no = formData.get('no')?.toString().trim();
      deletePhoto = formData.get('delete_photo') === 'true';

      const f = formData.get('foto') || formData.get('evidence_file') || formData.get('file');
      if (f && typeof f === 'object' && f.size > 0) {
        newPhotoFile = f;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      if (body.training !== undefined) training = body.training;
      if (body.nik !== undefined) nik = body.nik;
      if (body.nama !== undefined) nama = body.nama;
      if (body.kd_toko !== undefined) kd_toko = body.kd_toko;
      if (body.nama_toko !== undefined) nama_toko = body.nama_toko;
      if (body.alasan_tidak_hadir !== undefined) alasan_tidak_hadir = body.alasan_tidak_hadir;
      if (body.no !== undefined) no = body.no;
      deletePhoto = body.delete_photo === true;
    }

    if (!nik || !nama) {
      return NextResponse.json({ ok: false, error: 'NIK dan Nama wajib diisi' }, { status: 400 });
    }

    // Ambil branch data user
    const userBranchId = await resolveUserBranchId(session);
    const branchId = currentRec.branch_id || userBranchId;
    let branch = null;
    if (branchId) {
      const { data: bData } = await supabase
        .from('branches')
        .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
        .eq('id', branchId)
        .maybeSingle();
      branch = bData;
    }

    const oldFileId = currentRec.foto_drive_file_id || null;
    let updatePayload = {
      training,
      nik,
      nama,
      kd_toko: kd_toko || '-',
      nama_toko: nama_toko || '-',
      alasan_tidak_hadir: alasan_tidak_hadir || '-',
      no,
    };

    // ALUR 1: Hapus Foto saja
    if (deletePhoto) {
      updatePayload.foto_drive_file_id = null;
      updatePayload.foto_file_name = null;
      updatePayload.foto_mime_type = null;
      updatePayload.foto_uploaded_at = null;

      const updated = await updateDataTambahanRecord(id, updatePayload, session);

      // Setelah database sukses terupdate, baru trash foto lama di Drive
      if (oldFileId && branch) {
        try {
          await driveTrash(branch, oldFileId);
        } catch (trashErr) {
          console.warn('[Drive Trash Old Photo Warning]:', trashErr.message);
        }
      }

      return NextResponse.json({
        ok: true,
        message: 'Foto berhasil dihapus dari data tambahan',
        data: updated,
      });
    }

    // ALUR 2: Ganti Foto Baru
    if (newPhotoFile) {
      const isDriveReady = Boolean(branch?.drive_bridge_url && branch?.drive_bridge_secret_enc);
      if (!isDriveReady) {
        return NextResponse.json(
          { ok: false, error: 'Google Drive cabang belum terhubung, hubungi Admin Pusat' },
          { status: 400 }
        );
      }

      if (newPhotoFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: 'Ukuran berkas foto baru melebihi batas maksimal 5 MB' },
          { status: 400 }
        );
      }

      const fileExt = (newPhotoFile.name?.split('.').pop() || 'jpg').toLowerCase();
      const safeFileName = formatTambahanFileName(nik, nama, fileExt);
      const arrayBuffer = await newPhotoFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = newPhotoFile.type || 'image/jpeg';

      // 1. Upload file baru dulu ke Drive
      let uploadRes;
      try {
        uploadRes = await driveUpload(branch, {
          fileName: safeFileName,
          mimeType,
          base64,
          nik,
          cleanOldDuplicates: false,
        });
      } catch (uploadErr) {
        console.error('[Upload New Photo Tambahan Error]:', uploadErr);
        return NextResponse.json(
          { ok: false, error: `Gagal mengunggah foto baru ke Drive: ${uploadErr.message}` },
          { status: 500 }
        );
      }

      const newFileId = uploadRes.fileId;
      updatePayload.foto_drive_file_id = newFileId;
      updatePayload.foto_file_name = uploadRes.fileName || safeFileName;
      updatePayload.foto_mime_type = mimeType;
      updatePayload.foto_uploaded_at = new Date().toISOString();

      // 2. Perbarui record di database dengan fileId baru
      try {
        const updated = await updateDataTambahanRecord(id, updatePayload, session);

        // 3. Hanya jika update database berhasil, baru trash file lama
        if (oldFileId && oldFileId !== newFileId && branch) {
          try {
            await driveTrash(branch, oldFileId);
            console.log(`[Drive Trash Old Photo] Berhasil menghapus file lama ${oldFileId}`);
          } catch (trashErr) {
            console.warn('[Drive Trash Old Photo Warning]:', trashErr.message);
          }
        }

        return NextResponse.json({
          ok: true,
          message: 'Data dan foto tambahan berhasil diperbarui',
          data: updated,
        });
      } catch (dbErr) {
        // Jika update database gagal, JANGAN hapus file lama! Rollback file baru dari Drive
        console.error('[DB Update Tambahan Failed]:', dbErr);
        if (newFileId && branch) {
          try {
            await driveTrash(branch, newFileId);
            console.log(`[Drive Rollback] Berhasil membatalkan upload file baru ${newFileId}`);
          } catch (rbErr) {
            console.warn('[Drive Rollback Failed]:', rbErr.message);
          }
        }
        return NextResponse.json(
          { ok: false, error: 'Gagal memperbarui data di database: ' + dbErr.message },
          { status: 500 }
        );
      }
    }

    // ALUR 3: Edit tanpa mengubah foto
    const updated = await updateDataTambahanRecord(id, updatePayload, session);

    return NextResponse.json({
      ok: true,
      message: 'Data tambahan berhasil diperbarui',
      data: updated,
    });
  } catch (err) {
    console.error('[API Data Tambahan PUT Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memperbarui data tambahan' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Hapus 1 baris data tambahan berdasarkan ID dan trash fotonya
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: recToDelete } = await supabase
      .from('data_tambahan')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    await deleteDataTambahanRecord(id, session);

    // Jika ada foto, trash di Google Drive cabang
    if (recToDelete?.foto_drive_file_id) {
      const userBranchId = await resolveUserBranchId(session);
      const branchId = recToDelete.branch_id || userBranchId;
      if (branchId) {
        const { data: branch } = await supabase
          .from('branches')
          .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
          .eq('id', branchId)
          .maybeSingle();

        if (branch) {
          try {
            await driveTrash(branch, recToDelete.foto_drive_file_id);
          } catch (tErr) {
            console.warn('[Delete Single Photo Drive Trash Warning]:', tErr.message);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Data tambahan dan foto terkait berhasil dihapus',
    });
  } catch (err) {
    console.error('[API Data Tambahan DELETE Single Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menghapus data tambahan' },
      { status: 500 }
    );
  }
}
