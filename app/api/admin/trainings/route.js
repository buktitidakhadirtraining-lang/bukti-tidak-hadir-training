// app/api/admin/trainings/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { auditLog } from '../../../../lib/audit.js';
import { sortTrainings } from '../../../../lib/training-utils.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('training_types')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal mengambil data training' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: sortTrainings(data || []) }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, is_active = true, sort_order } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Nama jenis training wajib diisi' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Hitung sort_order berikutnya agar item baru mengikuti urutan Master
    let nextSortOrder = typeof sort_order === 'number' && !Number.isNaN(sort_order) ? sort_order : null;
    if (nextSortOrder === null) {
      const { data: existingTypes } = await supabase.from('training_types').select('sort_order');
      const maxOrder = (existingTypes || []).reduce((max, row) => {
        const val = Number(row.sort_order) || 0;
        return val > max ? val : max;
      }, 0);
      nextSortOrder = maxOrder + 1;
    }

    let insertPayload = {
      name: name.trim(),
      description: description ? description.trim() : null,
      is_active: Boolean(is_active),
      sort_order: nextSortOrder,
    };

    let { data, error } = await supabase
      .from('training_types')
      .insert(insertPayload)
      .select()
      .single();

    if (error && error.message?.includes('sort_order')) {
      delete insertPayload.sort_order;
      const retry = await supabase.from('training_types').insert(insertPayload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Nama jenis training sudah ada' }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: 'Gagal menambahkan jenis training' }, { status: 500 });
    }

    await auditLog(session.userId, 'CREATE_TRAINING_TYPE', { id: data.id, name: data.name });

    return NextResponse.json(
      { ok: true, message: 'Jenis training berhasil ditambahkan', data },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
