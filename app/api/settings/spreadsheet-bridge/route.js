// app/api/settings/spreadsheet-bridge/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { getSessionFromRequest } from '../../../../lib/session.js';
import { getSupabaseAdmin } from '../../../../lib/supabase.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PERSISTENT_CONFIG_FILE = '/tmp/spreadsheet_bridge_config.json';
let inMemoryBridgeUrl = '';

function readDiskConfig() {
  try {
    if (fs.existsSync(PERSISTENT_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(PERSISTENT_CONFIG_FILE, 'utf8'));
      return data.bridgeUrl || '';
    }
  } catch {}
  return '';
}

function writeDiskConfig(url) {
  try {
    fs.writeFileSync(
      PERSISTENT_CONFIG_FILE,
      JSON.stringify({ bridgeUrl: url, updatedAt: new Date().toISOString() }),
      'utf8'
    );
  } catch {}
}

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
    let bridgeUrl = '';

    // 1. Cek dari app_settings
    try {
      const { data: configRows } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'spreadsheet_bridge_url');
      if (configRows && configRows[0]?.value) {
        bridgeUrl = configRows[0].value.trim();
      }
    } catch {}

    // 2. Cek dari cabang user jika belum ada
    if (!bridgeUrl && session.branchId) {
      try {
        const { data: branchData } = await supabase
          .from('branches')
          .select('drive_bridge_url')
          .eq('id', session.branchId)
          .single();
        if (branchData?.drive_bridge_url) {
          bridgeUrl = branchData.drive_bridge_url.trim();
        }
      } catch {}
    }

    // 3. Cek dari cabang manapun yang memiliki drive_bridge_url
    if (!bridgeUrl) {
      try {
        const { data: branches } = await supabase
          .from('branches')
          .select('drive_bridge_url')
          .not('drive_bridge_url', 'is', null)
          .limit(1);
        if (branches && branches[0]?.drive_bridge_url) {
          bridgeUrl = branches[0].drive_bridge_url.trim();
        }
      } catch {}
    }

    // 4. Fallback ke disk storage / in-memory
    if (!bridgeUrl) {
      bridgeUrl = readDiskConfig() || inMemoryBridgeUrl || '';
    }

    return NextResponse.json({
      ok: true,
      data: {
        bridgeUrl,
        isConfigured: Boolean(bridgeUrl && bridgeUrl.startsWith('http')),
      },
    });
  } catch (err) {
    console.error('[Spreadsheet Bridge GET Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: Simpan / update URL Web App Google Apps Script secara permanen
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

    inMemoryBridgeUrl = cleanUrl;
    writeDiskConfig(cleanUrl);

    const supabase = getSupabaseAdmin();

    // 1. Simpan ke tabel app_settings
    try {
      await supabase.from('app_settings').upsert(
        {
          key: 'spreadsheet_bridge_url',
          value: cleanUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    } catch (e) {
      console.warn('[Bridge save app_settings warning]:', e?.message);
    }

    // 2. Simpan ke tabel branches untuk cabang aktif user
    if (session.branchId) {
      try {
        await supabase
          .from('branches')
          .update({
            drive_bridge_url: cleanUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.branchId);
      } catch (bErr) {
        console.warn('[Bridge save branch warning]:', bErr?.message);
      }
    } else {
      // Jika admin_pusat atau tanpa branchId, perbarui semua cabang aktif agar sinkron
      try {
        await supabase
          .from('branches')
          .update({
            drive_bridge_url: cleanUrl,
            updated_at: new Date().toISOString(),
          })
          .neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {}
    }

    // 3. Tes Ping koneksi ke Apps Script jika berupa URL http
    let pingResult = null;
    if (cleanUrl.startsWith('http')) {
      try {
        const testRes = await fetch(cleanUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'ping' }),
        });
        if (testRes.ok) {
          pingResult = await testRes.json().catch(() => ({ ok: true, message: 'Respons diterima' }));
        } else {
          pingResult = { ok: false, status: testRes.status, statusText: testRes.statusText };
        }
      } catch (pingErr) {
        pingResult = { ok: false, error: pingErr.message };
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'URL Google Apps Script Webhook berhasil disimpan permanen',
      bridgeUrl: cleanUrl,
      pingResult,
    });
  } catch (err) {
    console.error('[Spreadsheet Bridge POST Error]:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
