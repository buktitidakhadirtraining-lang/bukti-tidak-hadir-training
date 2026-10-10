// app/api/admin/training-mapping/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalize(str) {
  return String(str || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: trainings } = await supabase.from('training_types').select('id, name');
    const masterMap = new Map();
    (trainings || []).forEach(t => {
      masterMap.set(normalize(t.name), t);
    });

    const tables = [
      { name: 'data_tambahan', col: 'training_id', textCol: 'training' },
      { name: 'list_tidak_hadir', col: 'training_id', textCol: 'training' },
      { name: 'list_soft_skill', col: 'training_id', textCol: 'training' },
      { name: 'cetak_rekap', col: 'training_id', textCol: 'jenis_training' },
    ];

    const unmappedMap = new Map();

    for (const tbl of tables) {
      if (tbl.textCol) {
        const { data: rows } = await supabase
          .from(tbl.name)
          .select(`${tbl.col}, ${tbl.textCol}`);
        
        if (rows) {
          for (const r of rows) {
            const textVal = r[tbl.textCol];
            const tId = r[tbl.col];
            const normText = normalize(textVal);
            const matchesMaster = tId || (normText && masterMap.has(normText));
            if (!matchesMaster && textVal) {
              if (!unmappedMap.has(textVal)) {
                unmappedMap.set(textVal, { legacyName: textVal, count: 0, tables: {} });
              }
              const entry = unmappedMap.get(textVal);
              entry.count++;
              entry.tables[tbl.name] = (entry.tables[tbl.name] || 0) + 1;
            }
          }
        }
      }
    }

    const unmappedList = Array.from(unmappedMap.values());
    return NextResponse.json({
      ok: true,
      data: {
        unmapped: unmappedList,
        masterTrainings: trainings || [],
      },
    });
  } catch (err) {
    console.error('[Training Mapping GET Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin_pusat') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const mappings = body.mappings || {}; // { "legacyName": "masterTrainingId" }

    const supabase = getSupabaseAdmin();
    const { data: trainings } = await supabase.from('training_types').select('id, name');
    const idToNameMap = new Map();
    (trainings || []).forEach(t => idToNameMap.set(t.id, t.name));

    let updatedCount = 0;
    const tables = ['data_tambahan', 'list_tidak_hadir', 'list_soft_skill', 'cetak_rekap'];

    for (const [legacyName, masterId] of Object.entries(mappings)) {
      if (!masterId) continue;
      const masterName = idToNameMap.get(masterId);
      if (!masterName) continue;

      for (const tbl of tables) {
        const textCol = tbl === 'cetak_rekap' ? 'jenis_training' : 'training';
        const { data: rows } = await supabase
          .from(tbl)
          .select(`id, ${textCol}`)
          .ilike(textCol, legacyName);

        if (rows && rows.length > 0) {
          for (const r of rows) {
            const { error } = await supabase
              .from(tbl)
              .update({
                training_id: masterId,
                [textCol]: masterName,
                updated_at: new Date().toISOString(),
              })
              .eq('id', r.id);
            if (!error) updatedCount++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Berhasil memetakan dan memperbarui ${updatedCount} baris data lama!`,
      updatedCount,
    });
  } catch (err) {
    console.error('[Training Mapping POST Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
