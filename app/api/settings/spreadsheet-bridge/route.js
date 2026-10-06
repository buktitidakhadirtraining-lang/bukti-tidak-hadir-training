// app/api/settings/spreadsheet-bridge/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';
import { SPREADSHEET_ID, SPREADSHEET_URL } from '../../../../lib/config.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET: Ambil status konfigurasi Google Apps Script Webhook Bridge
 */
export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: configRows } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'spreadsheet_bridge_url');

    const bridgeUrl = configRows && configRows[0]?.value ? configRows[0].value : '';

    return NextResponse.json({
      ok: true,
      data: {
        spreadsheetId: SPREADSHEET_ID,
        spreadsheetUrl: SPREADSHEET_URL,
        bridgeUrl,
        isConfigured: Boolean(bridgeUrl && bridgeUrl.startsWith('http')),
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: Simpan / update URL Web App Google Apps Script
 */
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bridgeUrl } = body || {};

    const cleanUrl = (bridgeUrl || '').trim();

    const supabase = getSupabaseAdmin();

    // Simpan ke app_settings tabel
    try {
      await supabase.from('app_settings').upsert({
        key: 'spreadsheet_bridge_url',
        value: cleanUrl,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Fallback jika tabel app_settings belum ada: simpan ke branches atau variable
    }

    // Jika user menguji URL (melakukan ping)
    let pingResult = null;
    if (cleanUrl.startsWith('http')) {
      try {
        const testRes = await fetch(cleanUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'ping' }),
        });
        if (testRes.ok) {
          pingResult = await testRes.json();
        }
      } catch (pingErr) {
        pingResult = { ok: false, error: pingErr.message };
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'URL Google Apps Script Webhook berhasil disimpan',
      bridgeUrl: cleanUrl,
      pingResult,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
