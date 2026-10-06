// app/api/sync-sheets/route.js
import { NextResponse } from 'next/server';
import { syncSpreadsheetData } from '../../../lib/sheets.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let lastSyncTime = 0;
let cachedSyncResult = null;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const now = Date.now();

    // Debounce sync minimal tiap 8-10 detik agar tidak membebani Google Sheets
    if (force || now - lastSyncTime > 8000 || !cachedSyncResult) {
      cachedSyncResult = await syncSpreadsheetData();
      lastSyncTime = now;
    }

    const supabase = getSupabaseAdmin();

    // Ambil data terkini dari tabel Supabase
    const [rekapRes, listRes, softSkillRes, tambahanRes] = await Promise.all([
      supabase.from('cetak_rekap').select('*').order('no', { ascending: true }),
      supabase.from('list_tidak_hadir').select('*').order('no', { ascending: true }),
      supabase.from('list_soft_skill').select('*').order('no', { ascending: true }),
      supabase.from('data_tambahan').select('*').order('no', { ascending: true }).limit(200),
    ]);

    return NextResponse.json({
      ok: true,
      syncInfo: cachedSyncResult,
      lastSyncTime: new Date(lastSyncTime).toISOString(),
      rekap: rekapRes.data || [],
      listTidakHadir: listRes.data || [],
      softSkill: softSkillRes.data || [],
      dataTambahan: tambahanRes.data || [],
    });
  } catch (err) {
    console.error('[API Sync Sheets Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal sinkronisasi Google Sheets' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await syncSpreadsheetData();
    lastSyncTime = Date.now();
    cachedSyncResult = result;

    const supabase = getSupabaseAdmin();
    const [rekapRes, listRes, softSkillRes] = await Promise.all([
      supabase.from('cetak_rekap').select('*').order('no', { ascending: true }),
      supabase.from('list_tidak_hadir').select('*').order('no', { ascending: true }),
      supabase.from('list_soft_skill').select('*').order('no', { ascending: true }),
    ]);

    return NextResponse.json({
      ok: true,
      syncInfo: result,
      rekap: rekapRes.data || [],
      listTidakHadir: listRes.data || [],
      softSkill: softSkillRes.data || [],
    });
  } catch (err) {
    console.error('[API Sync Sheets POST Error]:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal sinkronisasi Google Sheets' },
      { status: 500 }
    );
  }
}
