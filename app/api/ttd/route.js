// app/api/ttd/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';
import { driveUpload, driveGetFile, driveTrash } from '../../../lib/drive.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_PERAN = ['dbm_operasional', 'dbm_admin', 'hrd_manager', 'tc_supervisor'];

// Cache in-memory untuk menyimpan data base64 gambar TTD per drive_file_id selama sesi server
const ttdImageCache = new Map();

const isValidUuid = (val) =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * Helper: Mengambil data cabang yang valid untuk user session saat ini
 */
async function getEffectiveBranch(session, requestedBranchId, supabase) {
  let targetBranchId = session.branchId;

  // Admin pusat dapat melihat/mengelola tanda tangan cabang tertentu jika diminta
  if (session.role === 'admin_pusat' && requestedBranchId) {
    targetBranchId = requestedBranchId;
  }

  if (!targetBranchId) {
    // Cek di tabel users jika session.branchId kosong
    if (session.userId) {
      const { data: user } = await supabase
        .from('users')
        .select('branch_id')
        .eq('id', session.userId)
        .maybeSingle();
      if (user?.branch_id) {
        targetBranchId = user.branch_id;
      }
    }
  }

  if (!targetBranchId) {
    // Ambil cabang default pertama yang aktif jika admin pusat tanpa filter
    const { data: firstBranch } = await supabase
      .from('branches')
      .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    return firstBranch || null;
  }

  const { data: branch, error } = await supabase
    .from('branches')
    .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
    .eq('id', targetBranchId)
    .maybeSingle();

  if (error || !branch) {
    return null;
  }

  return branch;
}

/**
 * GET: Ambil semua tanda tangan (metadata + dataUrl base64) untuk cabang aktif
 */
export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branch_id');
    const supabase = getSupabaseAdmin();

    const branch = await getEffectiveBranch(session, requestedBranchId, supabase);
    if (!branch) {
      return NextResponse.json({ ok: false, error: 'Data cabang tidak ditemukan' }, { status: 404 });
    }

    const isDriveReady = Boolean(branch.drive_bridge_url && branch.drive_bridge_secret_enc);

    // Ambil data ttd_cabang yang tersimpan di Supabase
    let query = supabase
      .from('ttd_cabang')
      .select('id, cabang, peran, drive_file_id, file_name, mime_type, updated_at')
      .ilike('cabang', branch.name.trim());

    const { data: ttdRecords, error: dbError } = await query;

    if (dbError) {
      console.error('[GET /api/ttd] Database error:', dbError.message);
      return NextResponse.json({
        ok: true,
        data: [],
        cabang: branch.name,
        branchCode: branch.code,
        isDriveReady,
        warning: `Tabel ttd_cabang error di Supabase: ${dbError.message}`,
      });
    }

    // Ambil konten file dari Google Drive untuk setiap slot TTD yang ada (menggunakan cache memori jika ada)
    const resultList = [];
    for (const rec of ttdRecords || []) {
      let dataUrl = null;
      if (isDriveReady && rec.drive_file_id) {
        if (ttdImageCache.has(rec.drive_file_id)) {
          const cached = ttdImageCache.get(rec.drive_file_id);
          dataUrl = `data:${cached.mimeType || 'image/png'};base64,${cached.base64}`;
        } else {
          try {
            const fileResult = await driveGetFile(branch, rec.drive_file_id);
            if (fileResult?.base64) {
              const mime = fileResult.mimeType || rec.mime_type || 'image/png';
              ttdImageCache.set(rec.drive_file_id, {
                base64: fileResult.base64,
                mimeType: mime,
              });
              dataUrl = `data:${mime};base64,${fileResult.base64}`;
            }
          } catch (fetchErr) {
            console.warn(`[GET /api/ttd] Gagal mengambil file TTD ${rec.peran}:`, fetchErr.message);
          }
        }
      }

      resultList.push({
        ...rec,
        dataUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      data: resultList,
      cabang: branch.name,
      branchCode: branch.code,
      branchId: branch.id,
      isDriveReady,
    });
  } catch (err) {
    console.error('[GET /api/ttd Error]:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}

/**
 * POST: Upload atau Ganti gambar tanda tangan ke Google Drive cabang
 */
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Hak akses: hanya admin_cabang atau admin_pusat
    if (session.role !== 'admin_cabang' && session.role !== 'admin_pusat') {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak: Hanya Admin Cabang atau Admin Pusat yang dapat mengupload tanda tangan.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { peran, base64, mimeType = 'image/png', branch_id: requestedBranchId } = body;

    if (!peran || !VALID_PERAN.includes(peran)) {
      return NextResponse.json(
        { ok: false, error: `Peran tanda tangan tidak valid. Pilihan: ${VALID_PERAN.join(', ')}` },
        { status: 400 }
      );
    }

    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Data gambar tanda tangan (base64) wajib disertakan' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const branch = await getEffectiveBranch(session, requestedBranchId, supabase);

    if (!branch) {
      return NextResponse.json({ ok: false, error: 'Data cabang tidak ditemukan' }, { status: 404 });
    }

    // Periksa koneksi Drive Bridge
    if (!branch.drive_bridge_url || !branch.drive_bridge_secret_enc) {
      return NextResponse.json(
        { ok: false, error: 'Google Drive cabang belum terhubung, hubungi Admin Pusat' },
        { status: 400 }
      );
    }

    // Format nama file: TTD_<KODE_CABANG>_<PERAN>_<timestamp>.png
    const branchCode = (branch.code || 'CAB').toUpperCase();
    const cleanPeran = peran.trim().toLowerCase();
    const peranUpper = cleanPeran.toUpperCase();
    const timestamp = Math.floor(Date.now() / 1000);
    const standardFileName = `TTD_${branchCode}_${peranUpper}_${timestamp}.png`;

    // Ambil record lama jika ada untuk keperluan "Ganti" (upload baru dulu, jika sukses baru trash yang lama)
    const { data: existingRecord } = await supabase
      .from('ttd_cabang')
      .select('id, drive_file_id')
      .ilike('cabang', branch.name.trim())
      .eq('peran', cleanPeran)
      .maybeSingle();

    // 1. Upload file baru ke Google Drive cabang
    let uploadResult;
    try {
      uploadResult = await driveUpload(branch, {
        fileName: standardFileName,
        mimeType: mimeType || 'image/png',
        base64,
      });
    } catch (uploadErr) {
      console.error('[POST /api/ttd] Drive Upload Gagal:', uploadErr);
      return NextResponse.json(
        { ok: false, error: `Gagal mengunggah tanda tangan ke Google Drive: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    if (!uploadResult || !uploadResult.fileId) {
      return NextResponse.json(
        { ok: false, error: 'Gagal mendapatkan ID berkas dari Google Drive cabang' },
        { status: 500 }
      );
    }

    // 2. Simpan / Perbarui data di tabel ttd_cabang
    const payload = {
      cabang: branch.name.trim(),
      peran: cleanPeran,
      drive_file_id: uploadResult.fileId,
      file_name: standardFileName,
      mime_type: mimeType || 'image/png',
      updated_by: isValidUuid(session.userId) ? session.userId : null,
      updated_at: new Date().toISOString(),
    };

    const { data: savedRecord, error: upsertError } = await supabase
      .from('ttd_cabang')
      .upsert(payload, { onConflict: 'cabang,peran' })
      .select()
      .single();

    if (upsertError) {
      console.error('[POST /api/ttd] Upsert error:', upsertError.message);
      // PENTING: Bersihkan file yang baru diupload ke Drive agar tidak menjadi file yatim/sampah di Drive
      try {
        await driveTrash(branch, uploadResult.fileId);
      } catch (trashErr) {
        console.warn('[POST /api/ttd] Gagal menghapus file baru setelah upsert error:', trashErr.message);
      }

      return NextResponse.json(
        {
          ok: false,
          error: `Gagal menyimpan data TTD ke database Supabase: ${upsertError.message}. Pastikan script tabel 'ttd_cabang' sudah dijalankan di Supabase SQL Editor.`,
        },
        { status: 500 }
      );
    }

    // 3. Setelah sukses tersimpan di database, barulah pindahkan file lama ke tempat sampah Drive jika ada
    if (existingRecord?.drive_file_id && existingRecord.drive_file_id !== uploadResult.fileId) {
      try {
        ttdImageCache.delete(existingRecord.drive_file_id);
        await driveTrash(branch, existingRecord.drive_file_id);
      } catch (trashErr) {
        console.warn('[POST /api/ttd] Gagal memindahkan file lama ke sampah (diabaikan):', trashErr.message);
      }
    }

    // Simpan gambar baru ke cache server untuk request GET berikutnya
    ttdImageCache.set(uploadResult.fileId, {
      base64,
      mimeType: mimeType || 'image/png',
    });

    return NextResponse.json({
      ok: true,
      data: savedRecord,
      dataUrl: `data:${mimeType};base64,${base64}`,
      message: 'Tanda tangan berhasil disimpan ke Google Drive cabang!',
    });
  } catch (err) {
    console.error('[POST /api/ttd Exception]:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Kesalahan sistem' }, { status: 500 });
  }
}

/**
 * DELETE: Hapus tanda tangan dari Google Drive cabang dan hapus record dari database
 */
export async function DELETE(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin_cabang' && session.role !== 'admin_pusat') {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak: Hanya Admin Cabang atau Admin Pusat yang dapat menghapus tanda tangan.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const peran = searchParams.get('peran');
    const requestedBranchId = searchParams.get('branch_id');

    if (!peran || !VALID_PERAN.includes(peran)) {
      return NextResponse.json(
        { ok: false, error: `Peran tanda tangan tidak valid. Pilihan: ${VALID_PERAN.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const branch = await getEffectiveBranch(session, requestedBranchId, supabase);

    if (!branch) {
      return NextResponse.json({ ok: false, error: 'Data cabang tidak ditemukan' }, { status: 404 });
    }

    const cleanPeran = peran.trim().toLowerCase();

    // Cari file TTD yang ada
    const { data: existingRecord } = await supabase
      .from('ttd_cabang')
      .select('id, drive_file_id')
      .ilike('cabang', branch.name.trim())
      .eq('peran', cleanPeran)
      .maybeSingle();

    if (!existingRecord) {
      return NextResponse.json({ ok: false, error: 'Data tanda tangan tidak ditemukan di sistem' }, { status: 404 });
    }

    // 1. Pindahkan file ke sampah Google Drive & bersihkan cache
    if (branch.drive_bridge_url && branch.drive_bridge_secret_enc && existingRecord.drive_file_id) {
      ttdImageCache.delete(existingRecord.drive_file_id);
      try {
        await driveTrash(branch, existingRecord.drive_file_id);
      } catch (trashErr) {
        console.warn('[DELETE /api/ttd] Gagal trash di Drive:', trashErr.message);
      }
    }

    // 2. Hapus record dari Supabase
    const { error: deleteError } = await supabase.from('ttd_cabang').delete().eq('id', existingRecord.id);
    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: `Gagal menghapus record tanda tangan dari database: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Tanda tangan berhasil dihapus dan dipindahkan ke Sampah Google Drive!',
    });
  } catch (err) {
    console.error('[DELETE /api/ttd Error]:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}
