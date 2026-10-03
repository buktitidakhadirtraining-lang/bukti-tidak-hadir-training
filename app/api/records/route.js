// app/api/records/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/session.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';
import { validateEvidenceFile, driveUpload, driveTrash } from '../../../lib/drive.js';
import { auditLog } from '../../../lib/audit.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: Ambil daftar catatan ketidakhadiran dengan filter dan paginasi
export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(400, Math.max(5, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    const branchId = searchParams.get('branch_id');
    const trainingId = searchParams.get('training_id');
    const reasonId = searchParams.get('reason_id');
    const position = searchParams.get('position');
    const batch = searchParams.get('batch');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const search = searchParams.get('search');
    const hasProof = searchParams.get('has_proof');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') === 'asc' ? true : false;

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('absence_records')
      .select(
        `
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
        branches ( id, name, code ),
        training_types ( id, name ),
        absence_reasons ( id, name ),
        users!absence_records_created_by_fkey ( id, full_name, username )
      `,
        { count: 'exact' }
      );

    // Filter akses role: jika bukan admin_pusat, batasi ke cabang pengguna
    if (session.role !== 'admin_pusat') {
      query = query.eq('branch_id', session.branchId);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (trainingId) query = query.eq('training_id', trainingId);
    if (reasonId) query = query.eq('alasan_id', reasonId);
    if (position) query = query.eq('jabatan', position);
    if (batch) query = query.eq('batch', parseInt(batch, 10));

    // Filter Tahun & Bulan pada tanggal_pelaksanaan
    if (year) {
      if (month) {
        const m = String(month).padStart(2, '0');
        const startDate = `${year}-${m}-01`;
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('tanggal_pelaksanaan', startDate).lte('tanggal_pelaksanaan', endDate);
      } else {
        query = query.gte('tanggal_pelaksanaan', `${year}-01-01`).lte('tanggal_pelaksanaan', `${year}-12-31`);
      }
    }

    // Pencarian NIK atau Nama Peserta (bersihkan karakter khusus koma, kurung, persen, dan backslash)
    if (search && search.trim()) {
      const cleanSearch = search.replace(/[,()%\\]/g, '').trim();
      if (cleanSearch) {
        query = query.or(`nik.ilike.%${cleanSearch}%,nama_peserta.ilike.%${cleanSearch}%`);
      }
    }

    // Filter keberadaan file bukti
    if (hasProof === 'true') {
      query = query.not('drive_file_id', 'is', null);
    } else if (hasProof === 'false') {
      query = query.is('drive_file_id', null);
    }

    // Pengurutan
    query = query.order(sortBy, { ascending: sortOrder });

    // Paginasi
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[Records GET Error]:', error);
      return NextResponse.json({ ok: false, error: 'Gagal mengambil data ketidakhadiran' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('[Records GET Error]:', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}

// POST: Tambah data ketidakhadiran baru beserta berkas bukti (Multipart Form)
export async function POST(request) {
  let branch = null;
  let driveFileData = {
    drive_file_id: null,
    drive_file_name: null,
    drive_file_url: null,
    file_mime_type: null,
    file_size_bytes: null,
  };

  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
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

    // Jika admin cabang, paksa branch_id sesuai cabangnya
    if (session.role !== 'admin_pusat') {
      branch_id = session.branchId;
    }

    // Validasi field wajib form
    if (!nik || !nama_peserta || !jabatan || !training_id || !batch || !tanggal_pelaksanaan || !branch_id || !alasan_id) {
      return NextResponse.json(
        { ok: false, error: 'Semua kolom bertanda bintang (*) wajib diisi' },
        { status: 400 }
      );
    }

    // Bukti wajib: file bukti (evidence_file) WAJIB untuk input manual
    if (!file || typeof file !== 'object' || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: 'File bukti Berita Acara wajib diunggah.' },
        { status: 400 }
      );
    }

    // Validasi format NIK (hanya angka, 8-16 digit)
    if (!/^\d{8,16}$/.test(nik)) {
      return NextResponse.json(
        { ok: false, error: 'Format NIK tidak valid. NIK harus berupa 8 hingga 16 digit angka.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Dapatkan data cabang untuk verifikasi & Google Drive Bridge
    const { data: branchData, error: branchErr } = await supabase
      .from('branches')
      .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
      .eq('id', branch_id)
      .single();

    if (branchErr || !branchData) {
      return NextResponse.json(
        { ok: false, error: 'Cabang tidak ditemukan atau tidak aktif' },
        { status: 400 }
      );
    }
    branch = branchData;

    // Periksa apakah Google Drive cabang sudah terhubung
    const isDriveReady = Boolean(branch.drive_bridge_url && branch.drive_bridge_secret_enc);
    if (!isDriveReady) {
      return NextResponse.json(
        {
          ok: false,
          error: `Input data untuk cabang "${branch.name}" diblokir karena Google Drive cabang belum terhubung. Hubungi Admin Cabang atau Admin Pusat untuk mengonfigurasi Drive Bridge.`,
        },
        { status: 400 }
      );
    }

    // ATURAN DATA GANDA: Cek duplikasi (cabang + NIK + training + tanggal_pelaksanaan)
    // Lakukan pengecekan SEBELUM upload file ke Drive agar tidak ada file yatim
    const { data: existingRecord } = await supabase
      .from('absence_records')
      .select('id')
      .eq('branch_id', branch_id)
      .ilike('nik', nik)
      .eq('training_id', training_id)
      .eq('tanggal_pelaksanaan', tanggal_pelaksanaan)
      .maybeSingle();

    if (existingRecord) {
      return NextResponse.json(
        { ok: false, error: 'Data untuk NIK ini pada training dan tanggal tersebut sudah ada.' },
        { status: 409 }
      );
    }

    // Validasi file bukti berita acara
    const validation = validateEvidenceFile(file);
    if (!validation.valid) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    // Upload berkas bukti ke Google Drive via Drive Bridge
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const ext = file.name.split('.').pop() || 'bin';
      const cleanNama = nama_peserta.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeFileName = `${nik}_BA_${cleanNama}_${tanggal_pelaksanaan}.${ext}`;

      const uploadRes = await driveUpload(branch, {
        fileName: safeFileName,
        mimeType: file.type,
        base64,
      });

      driveFileData = {
        drive_file_id: uploadRes.fileId,
        drive_file_name: uploadRes.fileName,
        drive_file_url: uploadRes.webViewLink,
        file_mime_type: file.type,
        file_size_bytes: file.size,
      };
    } catch (driveErr) {
      console.error('[Drive Upload Error]:', driveErr);
      return NextResponse.json(
        {
          ok: false,
          error: `Gagal mengunggah berkas bukti ke Google Drive cabang: ${driveErr.message}`,
        },
        { status: 500 }
      );
    }

    // Simpan data ke tabel absence_records
    const { data: newRecord, error: insertError } = await supabase
      .from('absence_records')
      .insert({
        nik,
        nama_peserta,
        jabatan,
        training_id,
        batch: parseInt(batch, 10),
        tanggal_pelaksanaan,
        branch_id,
        alasan_id,
        keterangan,
        drive_file_id: driveFileData.drive_file_id,
        drive_file_name: driveFileData.drive_file_name,
        drive_file_url: driveFileData.drive_file_url,
        file_mime_type: driveFileData.file_mime_type,
        file_size_bytes: driveFileData.file_size_bytes,
        created_by: session.userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Record Insert Error]:', insertError);

      // ROLLBACK FILE: jika insert ke database gagal setelah file terunggah ke Drive,
      // panggil driveTrash pada file itu agar tidak tersisa di Drive
      if (driveFileData.drive_file_id && branch) {
        try {
          await driveTrash(branch, driveFileData.drive_file_id);
          console.log(`[Drive Rollback] Berhasil menghapus file yatim ${driveFileData.drive_file_id}`);
        } catch (trashErr) {
          console.error('[Drive Rollback Failed]:', trashErr.message);
        }
      }

      // Tangani error unique violation kode Postgres 23505
      if (insertError.code === '23505') {
        return NextResponse.json(
          { ok: false, error: 'Data untuk NIK ini pada training dan tanggal tersebut sudah ada.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { ok: false, error: 'Gagal menyimpan data ketidakhadiran ke database: ' + insertError.message },
        { status: 500 }
      );
    }

    await auditLog(session.userId, 'CREATE_RECORD', {
      recordId: newRecord.id,
      nik,
      nama: nama_peserta,
      branchId: branch_id,
    });

    return NextResponse.json({
      ok: true,
      message: 'Data ketidakhadiran berhasil disimpan',
      data: newRecord,
    });
  } catch (err) {
    console.error('[Records POST Error]:', err);

    // Rollback file jika terjadi exception tak terduga setelah file terunggah ke Drive
    if (driveFileData?.drive_file_id && branch) {
      try {
        await driveTrash(branch, driveFileData.drive_file_id);
      } catch (trashErr) {
        console.error('[Drive Rollback Exception]:', trashErr.message);
      }
    }

    return NextResponse.json(
      { ok: false, error: 'Terjadi kesalahan sistem saat menyimpan data' },
      { status: 500 }
    );
  }
}
