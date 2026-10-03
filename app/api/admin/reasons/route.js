// app/api/admin/reasons/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { auditLog } from '../../../../lib/audit.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('absence_reasons')
      .select('*')
      .order('name');

    if (error) {
      return NextResponse.json({ ok: false, error: 'Gagal mengambil data alasan' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
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
    const { name, is_active = true } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Nama alasan ketidakhadiran wajib diisi' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('absence_reasons')
      .insert({
        name: name.trim(),
        is_active: Boolean(is_active),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Alasan ketidakhadiran tersebut sudah ada' }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: 'Gagal menambahkan alasan' }, { status: 500 });
    }

    await auditLog(session.userId, 'CREATE_ABSENCE_REASON', { id: data.id, name: data.name });

    return NextResponse.json({ ok: true, message: 'Alasan berhasil ditambahkan', data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
