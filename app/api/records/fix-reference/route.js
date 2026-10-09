// app/api/records/fix-reference/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { auditLog } from '../../../../lib/audit.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST: Perbaiki referensi drive_file_id yang usang pada record foto peserta ke ID baru yang benar
 * Body: { recordId?: string, drive_file_id?: string, drive_file_name?: string, items?: Array<{ id: string, drive_file_id: string, drive_file_name?: string }> }
 */
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    const itemsToUpdate = [];

    if (Array.isArray(body.items) && body.items.length > 0) {
      itemsToUpdate.push(...body.items);
    } else if (body.recordId && body.drive_file_id) {
      itemsToUpdate.push({
        id: body.recordId,
        drive_file_id: body.drive_file_id,
        drive_file_name: body.drive_file_name,
      });
    }

    if (itemsToUpdate.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Data perbaikan referensi foto tidak valid' },
        { status: 400 }
      );
    }

    let updatedCount = 0;
    const errors = [];

    for (const item of itemsToUpdate) {
      if (!item.id || !item.drive_file_id) continue;

      // Check record ownership (absence_records or data_tambahan)
      const { data: record, error: findErr } = await supabase
        .from('absence_records')
        .select('id, nik, nama_peserta, branch_id, drive_file_id')
        .eq('id', item.id)
        .maybeSingle();

      if (record) {
        if (session.role !== 'admin_pusat' && record.branch_id !== session.branchId) {
          errors.push(`Akses ditolak untuk NIK ${record.nik} (cabang lain)`);
          continue;
        }

        const updatePayload = {
          drive_file_id: item.drive_file_id.trim(),
          updated_at: new Date().toISOString(),
        };
        if (item.drive_file_name) {
          updatePayload.drive_file_name = item.drive_file_name.trim();
        }

        const { error: upErr } = await supabase
          .from('absence_records')
          .update(updatePayload)
          .eq('id', item.id);

        if (upErr) {
          console.error(`[Fix Reference Error for ${record.nik}]:`, upErr);
          errors.push(`Gagal memperbarui NIK ${record.nik}: ${upErr.message}`);
        } else {
          updatedCount++;
          await auditLog(session.userId, 'FIX_PHOTO_REFERENCE', {
            recordId: item.id,
            nik: record.nik,
            oldFileId: record.drive_file_id,
            newFileId: item.drive_file_id,
          });
        }
      } else {
        // Cek tabel data_tambahan
        const { data: tambRecord } = await supabase
          .from('data_tambahan')
          .select('id, nik, nama, branch_id, foto_drive_file_id')
          .eq('id', item.id)
          .maybeSingle();

        if (tambRecord) {
          if (session.role !== 'admin_pusat' && tambRecord.branch_id && tambRecord.branch_id !== session.branchId) {
            errors.push(`Akses ditolak untuk NIK ${tambRecord.nik} (cabang lain)`);
            continue;
          }

          const tambPayload = {
            foto_drive_file_id: item.drive_file_id.trim(),
            updated_at: new Date().toISOString(),
          };
          if (item.drive_file_name) {
            tambPayload.foto_file_name = item.drive_file_name.trim();
          }

          const { error: tambErr } = await supabase
            .from('data_tambahan')
            .update(tambPayload)
            .eq('id', item.id);

          if (tambErr) {
            console.error(`[Fix Reference Tambahan Error for ${tambRecord.nik}]:`, tambErr);
            errors.push(`Gagal memperbarui NIK ${tambRecord.nik}: ${tambErr.message}`);
          } else {
            updatedCount++;
            await auditLog(session.userId, 'FIX_PHOTO_REFERENCE_TAMBAHAN', {
              recordId: item.id,
              nik: tambRecord.nik,
              oldFileId: tambRecord.foto_drive_file_id,
              newFileId: item.drive_file_id,
            });
          }
        } else {
          errors.push(`Record ${item.id} tidak ditemukan`);
          continue;
        }
      }
    }

    if (updatedCount === 0 && errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Gagal memperbarui referensi foto: ${errors.join(', ')}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Berhasil memperbarui referensi ID foto di database untuk ${updatedCount} peserta!`,
      updatedCount,
      errors,
    });
  } catch (err) {
    console.error('[Fix Reference API Error]:', err);
    return NextResponse.json(
      { ok: false, error: 'Terjadi kesalahan sistem: ' + err.message },
      { status: 500 }
    );
  }
}
