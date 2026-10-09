// app/api/data-tambahan/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';
import {
  resolveUserBranchId,
  getDataTambahanList,
  insertDataTambahanRecord,
  clearAllDataTambahan,
} from '../../../lib/data-service.js';
import { driveUpload, driveTrash } from '../../../lib/drive.js';

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

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branch_id');

    const userBranchId = await resolveUserBranchId(session);
    const branchId = session.role === 'admin_pusat' && requestedBranchId ? requestedBranchId : userBranchId;

    const data = await getDataTambahanList({ branchId, role: session.role });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[API Data Tambahan GET Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let uploadedFileId = null;
  let branch = null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Sesi login tidak valid. Silakan login kembali.' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let training = 'TRAINING';
    let nik = '';
    let nama = '';
    let kd_toko = '-';
    let nama_toko = '-';
    let alasan_tidak_hadir = '-';
    let fotoFile = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      training = formData.get('training')?.toString().trim() || 'TRAINING';
      nik = formData.get('nik')?.toString().trim() || '';
      nama = formData.get('nama')?.toString().trim() || '';
      kd_toko = formData.get('kd_toko')?.toString().trim() || '-';
      nama_toko = formData.get('nama_toko')?.toString().trim() || '-';
      alasan_tidak_hadir = formData.get('alasan_tidak_hadir')?.toString().trim() || '-';
      const f = formData.get('foto') || formData.get('evidence_file') || formData.get('file');
      if (f && typeof f === 'object' && f.size > 0) {
        fotoFile = f;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      training = body.training || 'TRAINING';
      nik = body.nik || '';
      nama = body.nama || '';
      kd_toko = body.kd_toko || '-';
      nama_toko = body.nama_toko || '-';
      alasan_tidak_hadir = body.alasan_tidak_hadir || '-';
    }

    if (!nik || !nama) {
      return NextResponse.json(
        { ok: false, error: 'NIK dan Nama Peserta wajib diisi' },
        { status: 400 }
      );
    }

    // Dapatkan data cabang user
    const userBranchId = await resolveUserBranchId(session);
    const supabase = getSupabaseAdmin();
    if (userBranchId) {
      const { data: bData } = await supabase
        .from('branches')
        .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
        .eq('id', userBranchId)
        .maybeSingle();
      branch = bData;
    }

    let fotoData = {
      foto_drive_file_id: null,
      foto_file_name: null,
      foto_mime_type: null,
      foto_uploaded_at: null,
    };

    // Jika ada lampiran foto, proses upload ke Google Drive cabang
    if (fotoFile) {
      const isDriveReady = Boolean(branch?.drive_bridge_url && branch?.drive_bridge_secret_enc);
      if (!isDriveReady) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Google Drive cabang belum terhubung, hubungi Admin Pusat',
            canSaveWithoutPhoto: true,
          },
          { status: 400 }
        );
      }

      // Validasi ukuran foto maksimal 5 MB (5 * 1024 * 1024 bytes)
      const MAX_SIZE = 5 * 1024 * 1024;
      if (fotoFile.size > MAX_SIZE) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Ukuran berkas foto melebihi batas maksimal 5 MB. Harap perkecil atau pilih foto lain.',
          },
          { status: 400 }
        );
      }

      const fileExt = (fotoFile.name?.split('.').pop() || 'jpg').toLowerCase();
      const safeFileName = formatTambahanFileName(nik, nama, fileExt);

      const arrayBuffer = await fotoFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = fotoFile.type || 'image/jpeg';

      const uploadRes = await driveUpload(branch, {
        fileName: safeFileName,
        mimeType,
        base64,
        nik,
        cleanOldDuplicates: false,
      });

      uploadedFileId = uploadRes.fileId;
      fotoData = {
        foto_drive_file_id: uploadRes.fileId,
        foto_file_name: uploadRes.fileName || safeFileName,
        foto_mime_type: mimeType,
        foto_uploaded_at: new Date().toISOString(),
      };
    }

    // Simpan ke database Supabase
    try {
      const saved = await insertDataTambahanRecord(
        {
          training: training || 'TRAINING',
          nik,
          nama,
          kd_toko: kd_toko || '-',
          nama_toko: nama_toko || '-',
          alasan_tidak_hadir: alasan_tidak_hadir || '-',
          ...fotoData,
        },
        session
      );

      return NextResponse.json({
        ok: true,
        message: 'Data tambahan berhasil disimpan ke database cabang Anda.',
        data: saved,
      });
    } catch (insertErr) {
      console.error('[DB Insert Error Data Tambahan]:', insertErr);
      // ROLLBACK: jika simpan DB gagal setelah upload foto ke Drive, hapus file baru dari Drive
      if (uploadedFileId && branch) {
        try {
          await driveTrash(branch, uploadedFileId);
          console.log(`[Drive Rollback] Berhasil menghapus file yatim ${uploadedFileId}`);
        } catch (trashErr) {
          console.warn('[Drive Rollback Failed]:', trashErr.message);
        }
      }
      return NextResponse.json(
        { ok: false, error: 'Gagal menyimpan data tambahan: ' + insertErr.message },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[API Data Tambahan POST Error]:', err);
    // Rollback jika terjadi exception
    if (uploadedFileId && branch) {
      try {
        await driveTrash(branch, uploadedFileId);
      } catch (trashErr) {
        console.warn('[Drive Rollback Failed]:', trashErr.message);
      }
    }
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal menyimpan data tambahan' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Hapus SEMUA data tambahan untuk cabang aktif
 * Sekaligus trash semua foto di Google Drive (maks 3 paralel)
 */
export async function DELETE(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Sesi login tidak valid' },
        { status: 401 }
      );
    }

    const userBranchId = await resolveUserBranchId(session);
    const supabase = getSupabaseAdmin();
    let branch = null;
    if (userBranchId) {
      const { data: bData } = await supabase
        .from('branches')
        .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
        .eq('id', userBranchId)
        .maybeSingle();
      branch = bData;
    }

    // Hapus dari database dan dapatkan daftar fileId yang dihapus
    const deletedRecords = await clearAllDataTambahan(session);

    // Hapus foto di Drive cabang jika ada
    if (Array.isArray(deletedRecords) && deletedRecords.length > 0 && branch) {
      const fileIdsToTrash = deletedRecords
        .map((r) => r.foto_drive_file_id)
        .filter(Boolean);

      if (fileIdsToTrash.length > 0) {
        const concurrency = 3;
        let idx = 0;
        const worker = async () => {
          while (idx < fileIdsToTrash.length) {
            const fid = fileIdsToTrash[idx++];
            try {
              await driveTrash(branch, fid);
            } catch (tErr) {
              console.warn(`[Bulk Trash Drive Failed for ${fid}]:`, tErr.message);
            }
          }
        };

        const workers = [];
        for (let i = 0; i < Math.min(concurrency, fileIdsToTrash.length); i++) {
          workers.push(worker());
        }
        await Promise.all(workers);
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Semua data tambahan di cabang Anda beserta fotonya berhasil dibersihkan',
    });
  } catch (err) {
    console.error('[API Data Tambahan DELETE All Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal membersihkan data tambahan' },
      { status: 500 }
    );
  }
}
