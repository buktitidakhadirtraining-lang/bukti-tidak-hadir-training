// app/api/records/[id]/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { validateEvidenceFile, driveUpload, driveTrash } from '../../../../lib/drive.js';
import { auditLog } from '../../../../lib/audit.js';

export const runtime = 'nodejs';

// PUT: Perbarui catatan ketidakhadiran beserta berkas bukti pengganti (Safe Replace Workflow)
export async function PUT(request, { params }) {
  let newlyUploadedFileId = null;
  let targetBranchForUpload = null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Dapatkan data lama untuk pengecekan akses dan file lama
    const { data: oldRecord, error: findErr } = await supabase
      .from('absence_records')
      .select('*, branches ( id, name, code, drive_bridge_url, drive_bridge_secret_enc )')
      .eq('id', id)
      .single();

    if (findErr || !oldRecord) {
      return NextResponse.json({ ok: false, error: 'Catatan tidak ditemukan' }, { status: 404 });
    }

    // Role check
    if (session.role !== 'admin_pusat' && oldRecord.branch_id !== session.branchId) {
      return NextResponse.json({ ok: false, error: 'Akses ditolak' }, { status: 403 });
    }

    const formData = await request.formData();

    const nik = formData.get('nik')?.toString().trim();
    const nama_peserta = formData.get('nama_peserta')?.toString().trim();
    const jabatan = formData.get('jabatan')?.toString().trim();
    const training_id = formData.get('training_id')?.toString().trim();
    const batch = formData.get('batch')?.toString().trim();
    const tanggal_pelaksanaan = formData.get('tanggal_pelaksanaan')?.toString().trim();
    let branch_id = formData.get('branch_id')?.toString().trim();
    const alasan_id = formData.get('alasan_id')?.toString().trim();
    const keterangan = formData.get('keterangan')?.toString().trim() || null;
    const file = formData.get('evidence_file');

    if (session.role !== 'admin_pusat') {
      branch_id = session.branchId;
    }

    if (!nik || !nama_peserta || !jabatan || !training_id || !batch || !tanggal_pelaksanaan || !branch_id || !alasan_id) {
      return NextResponse.json(
        { ok: false, error: 'Semua kolom bertanda bintang (*) wajib diisi' },
        { status: 400 }
      );
    }

    if (!/^\d{8,16}$/.test(nik)) {
      return NextResponse.json(
        { ok: false, error: 'Format NIK tidak valid. NIK harus berupa 8 hingga 16 digit angka.' },
        { status: 400 }
      );
    }

    // ATURAN DATA GANDA: Cek duplikasi (cabang + NIK + training + tanggal_pelaksanaan)
    // Abaikan baris itu sendiri (.neq('id', id))
    // Lakukan pengecekan SEBELUM upload file ke Drive agar tidak ada file yatim
    const { data: existingRecord } = await supabase
      .from('absence_records')
      .select('id')
      .eq('branch_id', branch_id)
      .ilike('nik', nik)
      .eq('training_id', training_id)
      .eq('tanggal_pelaksanaan', tanggal_pelaksanaan)
      .neq('id', id)
      .maybeSingle();

    if (existingRecord) {
      return NextResponse.json(
        { ok: false, error: 'Data untuk NIK ini pada training dan tanggal tersebut sudah ada.' },
        { status: 409 }
      );
    }

    const updatePayload = {
      nik,
      nama_peserta,
      jabatan,
      training_id,
      batch: parseInt(batch, 10),
      tanggal_pelaksanaan,
      branch_id,
      alasan_id,
      keterangan,
      updated_at: new Date().toISOString(),
    };

    // Alur Aman Penggantian Berkas Bukti (Safe Replace):
    // 1. Upload file baru dulu dan pastikan sukses
    // 2. Update database dengan fileId baru
    // 3. Jika update DB berhasil, baru hapus file lama di Drive
    // 4. Jika update DB gagal, hapus file baru (rollback) dan pertahankan file lama
    let hasNewFile = false;
    let oldFileToTrash = null;

    if (file && typeof file === 'object' && file.size > 0) {
      const validation = validateEvidenceFile(file);
      if (!validation.valid) {
        return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
      }

      // Pastikan target cabang sesuai record
      const targetBranchId = (session.role === 'admin_pusat' && branch_id) ? branch_id : oldRecord.branch_id;
      const { data: targetBranch } = await supabase
        .from('branches')
        .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
        .eq('id', targetBranchId)
        .maybeSingle();

      const activeBranch = targetBranch && targetBranch.drive_bridge_url && targetBranch.drive_bridge_secret_enc
        ? targetBranch
        : {
            id: targetBranchId,
            name: targetBranch?.name || 'Cabang',
            drive_bridge_url: 'mock://drive',
            drive_bridge_secret_enc: 'mock_secret',
          };

      targetBranchForUpload = activeBranch;

      // 1. Unggah berkas baru terlebih dahulu
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const ext = file.name.split('.').pop() || 'bin';
      const cleanNama = nama_peserta.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeFileName = `${nik}_BA_${cleanNama}_${tanggal_pelaksanaan}.${ext}`;

      const uploadRes = await driveUpload(activeBranch, {
        fileName: safeFileName,
        mimeType: file.type,
        base64,
        nik,
        cleanOldDuplicates: true,
      });

      if (!uploadRes || !uploadRes.fileId) {
        return NextResponse.json(
          { ok: false, error: 'Gagal mengunggah foto baru ke Google Drive cabang' },
          { status: 500 }
        );
      }

      newlyUploadedFileId = uploadRes.fileId;
      hasNewFile = true;
      oldFileToTrash = oldRecord.drive_file_id;

      updatePayload.drive_file_id = uploadRes.fileId;
      updatePayload.drive_file_name = uploadRes.fileName;
      updatePayload.drive_file_url = uploadRes.webViewLink;
      updatePayload.file_mime_type = file.type;
      updatePayload.file_size_bytes = file.size;
    }

    // 2. Simpan pembaruan ke database
    const { data: updatedRecord, error: updateErr } = await supabase
      .from('absence_records')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        id,
        nik,
        nama_peserta,
        jabatan,
        batch,
        tanggal_pelaksanaan,
        keterangan,
        drive_file_id,
        drive_file_name,
        drive_file_url,
        file_mime_type,
        file_size_bytes,
        created_at,
        updated_at,
        branch_id,
        training_id,
        alasan_id,
        branches ( id, name, code, drive_bridge_url, drive_bridge_secret_enc ),
        training_types ( id, name ),
        absence_reasons ( id, name )
      `)
      .single();

    if (updateErr) {
      console.error('[Record Update Error]:', updateErr);

      // ROLLBACK: Jika update DB gagal setelah file baru terunggah, hapus file baru dari Drive
      if (hasNewFile && newlyUploadedFileId && targetBranchForUpload) {
        try {
          await driveTrash(targetBranchForUpload, newlyUploadedFileId);
          console.log(`[Drive Rollback] Berhasil membatalkan upload file baru ${newlyUploadedFileId}`);
        } catch (trashErr) {
          console.warn('[Drive Rollback Error]:', trashErr.message);
        }
      }

      if (updateErr.code === '23505') {
        return NextResponse.json(
          { ok: false, error: 'Data untuk NIK ini pada training dan tanggal tersebut sudah ada.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: false, error: 'Gagal memperbarui catatan: ' + updateErr.message }, { status: 500 });
    }

    // 3. Setelah database SUKSES terupdate, barulah pindahkan file lama ke tempat sampah Google Drive
    if (hasNewFile && oldFileToTrash && oldFileToTrash !== newlyUploadedFileId) {
      try {
        const oldBranch = oldRecord.branches;
        if (oldBranch?.drive_bridge_url && oldBranch?.drive_bridge_secret_enc) {
          await driveTrash(oldBranch, oldFileToTrash);
          console.log(`[Drive Trash] Berhasil memindahkan file lama ${oldFileToTrash} ke sampah`);
        }
      } catch (delErr) {
        console.warn('[Old file trash warning (ignored)]:', delErr.message);
      }
    }

    await auditLog(session.userId, 'UPDATE_RECORD', {
      recordId: id,
      nik,
      nama: nama_peserta,
      hasNewFile,
      newFileId: newlyUploadedFileId,
    });

    return NextResponse.json({
      ok: true,
      message: 'Catatan dan berkas bukti berhasil diperbarui',
      data: updatedRecord,
    });
  } catch (err) {
    console.error('[Record PUT Error]:', err);

    // Rollback jika terjadi exception
    if (newlyUploadedFileId && targetBranchForUpload) {
      try {
        await driveTrash(targetBranchForUpload, newlyUploadedFileId);
      } catch (trashErr) {}
    }

    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem: ' + err.message }, { status: 500 });
  }
}

// DELETE: Hapus catatan beserta file bukti di Google Drive cabang
export async function DELETE(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: record, error: findErr } = await supabase
      .from('absence_records')
      .select('*, branches ( id, name, drive_bridge_url, drive_bridge_secret_enc )')
      .eq('id', id)
      .single();

    if (findErr || !record) {
      return NextResponse.json({ ok: false, error: 'Catatan tidak ditemukan' }, { status: 404 });
    }

    if (session.role !== 'admin_pusat' && record.branch_id !== session.branchId) {
      return NextResponse.json({ ok: false, error: 'Akses ditolak' }, { status: 403 });
    }

    // Hapus file dari Google Drive cabang via Drive Bridge jika ada
    if (record.drive_file_id && record.branches?.drive_bridge_url && record.branches?.drive_bridge_secret_enc) {
      try {
        await driveTrash(record.branches, record.drive_file_id);
      } catch (driveErr) {
        console.warn('[Drive Delete Warning]:', driveErr.message);
        // Tetap lanjut hapus record dari database walau drive gagal/berkas sudah tidak ada
      }
    }

    const { error: delErr } = await supabase
      .from('absence_records')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('[Record Delete Error]:', delErr);
      return NextResponse.json({ ok: false, error: 'Gagal menghapus catatan' }, { status: 500 });
    }

    await auditLog(session.userId, 'DELETE_RECORD', {
      recordId: id,
      nik: record.nik,
      nama: record.nama_peserta,
    });

    return NextResponse.json({
      ok: true,
      message: 'Data ketidakhadiran dan berkas bukti di Google Drive berhasil dihapus',
    });
  } catch (err) {
    console.error('[Record DELETE Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
