// app/api/admin/clean-drive-duplicates/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { driveCleanDuplicates } from '../../../../lib/drive.js';
import { auditLog } from '../../../../lib/audit.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST: Jalankan pembersihan file duplikat di Google Drive cabang dan sinkronisasi database
 * Menerima body: { branch_id?: string }
 */
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin_cabang' && session.role !== 'admin_pusat') {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak: Hanya Administrator yang dapat menjalankan pembersihan Drive.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedBranchId = body.branch_id;

    const supabase = getSupabaseAdmin();

    // Tentukan cabang sasaran
    let targetBranches = [];
    if (session.role === 'admin_cabang') {
      const { data: branch } = await supabase
        .from('branches')
        .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
        .eq('id', session.branchId)
        .single();
      if (branch) targetBranches.push(branch);
    } else if (requestedBranchId) {
      const { data: branch } = await supabase
        .from('branches')
        .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
        .eq('id', requestedBranchId)
        .single();
      if (branch) targetBranches.push(branch);
    } else {
      // Admin Pusat tanpa parameter -> semua cabang aktif yang memiliki drive_bridge_url
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name, code, drive_bridge_url, drive_bridge_secret_enc')
        .eq('is_active', true)
        .not('drive_bridge_url', 'is', null);
      targetBranches = branches || [];
    }

    if (targetBranches.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Tidak ada cabang dengan konfigurasi Google Drive yang ditemukan' },
        { status: 400 }
      );
    }

    const results = [];
    let totalScannedAll = 0;
    let totalTrashedAll = 0;
    let totalDbUpdatedAll = 0;

    for (const branch of targetBranches) {
      if (!branch.drive_bridge_url || !branch.drive_bridge_secret_enc) {
        results.push({
          branchId: branch.id,
          branchName: branch.name,
          ok: false,
          error: 'Google Drive cabang belum terhubung',
        });
        continue;
      }

      try {
        // 1. Jalankan pembersihan file duplikat di Google Apps Script Drive Bridge
        const driveResult = await driveCleanDuplicates(branch);

        if (!driveResult.ok) {
          results.push({
            branchId: branch.id,
            branchName: branch.name,
            ok: false,
            error: driveResult.error || 'Gagal memproses pembersihan di Google Drive',
          });
          continue;
        }

        const summary = driveResult.summary || {
          totalFilesScanned: 0,
          uniqueNiksFound: 0,
          duplicateNiksFound: 0,
          duplicateFilesTrashed: 0,
        };

        totalScannedAll += summary.totalFilesScanned || 0;
        totalTrashedAll += summary.duplicateFilesTrashed || 0;

        // 2. Sinkronkan database absence_records dengan file yang dipertahankan
        let dbUpdatedCount = 0;
        const keptFiles = driveResult.keptFiles || [];

        for (const kept of keptFiles) {
          if (!kept.nik || !kept.fileId) continue;

          // Cari record di database yang memiliki NIK tersebut di cabang ini
          const { data: matchingRecords } = await supabase
            .from('absence_records')
            .select('id, drive_file_id, drive_file_name, drive_file_url')
            .eq('branch_id', branch.id)
            .ilike('nik', kept.nik.trim());

          if (matchingRecords && matchingRecords.length > 0) {
            for (const rec of matchingRecords) {
              // Jika drive_file_id belum ada atau berbeda dengan file terbaru
              if (rec.drive_file_id !== kept.fileId) {
                const updateData = {
                  drive_file_id: kept.fileId,
                  drive_file_name: kept.fileName || null,
                  drive_file_url: kept.fileUrl || `https://drive.google.com/file/d/${kept.fileId}/view`,
                  updated_at: new Date().toISOString(),
                };
                if (kept.mimeType) updateData.file_mime_type = kept.mimeType;
                if (kept.size) updateData.file_size_bytes = kept.size;

                const { error: upErr } = await supabase
                  .from('absence_records')
                  .update(updateData)
                  .eq('id', rec.id);

                if (!upErr) {
                  dbUpdatedCount++;
                }
              }
            }
          }
        }

        totalDbUpdatedAll += dbUpdatedCount;

        results.push({
          branchId: branch.id,
          branchName: branch.name,
          ok: true,
          summary: {
            ...summary,
            dbRecordsUpdated: dbUpdatedCount,
          },
          details: driveResult.details || [],
        });
      } catch (branchErr) {
        console.error(`[Clean Drive Duplicates Error for ${branch.name}]:`, branchErr);
        results.push({
          branchId: branch.id,
          branchName: branch.name,
          ok: false,
          error: branchErr.message || 'Terjadi kesalahan sistem saat memproses cabang',
        });
      }
    }

    await auditLog(session.userId, 'CLEAN_DRIVE_DUPLICATES', {
      targetBranchesCount: targetBranches.length,
      totalScanned: totalScannedAll,
      totalTrashed: totalTrashedAll,
      totalDbUpdated: totalDbUpdatedAll,
    });

    return NextResponse.json({
      ok: true,
      message: `Pembersihan selesai: ${totalTrashedAll} file duplikat dipindahkan ke sampah, ${totalDbUpdatedAll} record database diperbarui.`,
      overallSummary: {
        totalBranchesProcessed: targetBranches.length,
        totalFilesScanned: totalScannedAll,
        totalDuplicatesTrashed: totalTrashedAll,
        totalDbRecordsUpdated: totalDbUpdatedAll,
      },
      results,
    });
  } catch (err) {
    console.error('[Clean Drive Duplicates API Error]:', err);
    return NextResponse.json(
      { ok: false, error: 'Terjadi kesalahan sistem: ' + err.message },
      { status: 500 }
    );
  }
}
