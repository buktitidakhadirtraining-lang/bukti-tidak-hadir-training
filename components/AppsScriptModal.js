// components/AppsScriptModal.js
'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { SPREADSHEET_ID, SPREADSHEET_URL } from '../lib/config.js';

export const APPS_SCRIPT_CODE = `/**
 * GOOGLE APPS SCRIPT WEBHOOK BRIDGE (Code.gs)
 * Untuk Google Spreadsheet Cabang (Sheet: Data_tambahan)
 * 
 * Skrip ini dipasang oleh ADMIN CABANG pada file Google Spreadsheet cabangnya masing-masing.
 *
 * CARA MEMASANG OLEH ADMIN CABANG:
 * 1. Buka file Google Spreadsheet cabang Anda.
 * 2. Klik menu di atas: Ekstensi (Extensions) > Apps Script.
 * 3. Hapus semua tulisan di editor Apps Script, lalu PASTE (TEMPEL) seluruh kode ini.
 * 4. Klik tombol Simpan (ikon Disket).
 * 5. Klik tombol biru: Terapkan (Deploy) > Penerapan baru (New deployment).
 * 6. Klik ikon Gerigi (Setelan) di samping kiri atas popup > Pilih "Aplikasi Web" (Web app).
 * 7. Atur Konfigurasi:
 *    - Deskripsi: Webhook Data Tambahan Cabang
 *    - Jalankan sebagai (Execute as): Saya (Me / Akun Google Anda)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone)  <-- WAJIB PILIH "ANYONE"
 * 8. Klik tombol "Terapkan" (Deploy) lalu berikan izin otorisasi jika diminta Google.
 * 9. Salin URL Aplikasi Web yang berakhiran "/exec".
 * 10. Masukkan URL tersebut ke menu Pengaturan Apps Script / Pengaturan Cabang di web.
 */

var SHEET_DATA_TAMBAHAN_NAME = 'Data_tambahan';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Tidak ada data payload yang dikirim' });
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ ok: false, error: 'Payload harus berupa JSON yang valid' });
    }

    var action = payload.action;

    // Aksi 1: PENCATATAN DATA TAMBAHAN BARU
    if (action === 'append_data_tambahan') {
      return handleAppendDataTambahan(payload);
    }

    // Aksi 2: UPDATE BARIS DATA TAMBAHAN (EDIT)
    if (action === 'update_data_tambahan') {
      return handleUpdateDataTambahan(payload);
    }

    // Aksi 3: HAPUS 1 BARIS DATA TAMBAHAN
    if (action === 'delete_data_tambahan') {
      return handleDeleteDataTambahan(payload);
    }

    // Aksi 4: BERSIHKAN SELURUH DATA TAMBAHAN (HAPUS SEMUA)
    if (action === 'clear_data_tambahan') {
      return handleClearDataTambahan(payload);
    }

    // Aksi 5: TES KONEKSI (PING)
    if (action === 'ping') {
      return jsonResponse({
        ok: true,
        message: 'Koneksi ke Google Apps Script Web App berhasil aktif!',
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ ok: false, error: 'Aksi "' + action + '" tidak dikenali' });

  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'Terjadi error internal di Apps Script: ' + err.toString()
    });
  }
}

function getTargetSheet(payload) {
  var ss;
  if (payload && payload.spreadsheetId) {
    try {
      ss = SpreadsheetApp.openById(payload.spreadsheetId);
    } catch (openErr) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) return null;

  var sheetName = (payload && payload.sheet) || SHEET_DATA_TAMBAHAN_NAME;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'NO',
      'TRAINING',
      'NIK',
      'NAMA',
      'KD TOKO',
      'NAMA TOKO',
      'ALASAN TIDAK HADIR'
    ]);
    var headerRange = sheet.getRange(1, 1, 1, 7);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#2E7D32');
    headerRange.setFontColor('#FFFFFF');
  }

  return sheet;
}

function handleAppendDataTambahan(payload) {
  try {
    var sheet = getTargetSheet(payload);
    if (!sheet) return jsonResponse({ ok: false, error: 'Spreadsheet tidak ditemukan' });

    var rowData = payload.row;
    if (!rowData || !Array.isArray(rowData)) {
      return jsonResponse({ ok: false, error: 'Data baris kosong atau bukan array' });
    }

    var lastRow = sheet.getLastRow();
    if (!rowData[0] || rowData[0] === 0) {
      rowData[0] = lastRow > 1 ? lastRow : 1;
    }

    var formattedRow = [
      rowData[0],
      String(rowData[1] || ''),
      "'" + String(rowData[2] || ''),
      String(rowData[3] || ''),
      String(rowData[4] || ''),
      String(rowData[5] || ''),
      String(rowData[6] || '')
    ];

    sheet.appendRow(formattedRow);

    return jsonResponse({
      ok: true,
      message: 'Data tambahan berhasil dicatat ke Spreadsheet',
      rowNumber: sheet.getLastRow(),
      insertedData: formattedRow
    });
  } catch (sheetErr) {
    return jsonResponse({ ok: false, error: 'Gagal menulis ke Spreadsheet: ' + sheetErr.toString() });
  }
}

function handleUpdateDataTambahan(payload) {
  try {
    var sheet = getTargetSheet(payload);
    if (!sheet) return jsonResponse({ ok: false, error: 'Spreadsheet tidak ditemukan' });

    var targetNik = String(payload.nik || '').trim();
    var rowData = payload.row;
    if (!targetNik || !rowData) {
      return jsonResponse({ ok: false, error: 'NIK atau rowData kosong' });
    }

    var data = sheet.getDataRange().getValues();
    var targetRowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      var cellNik = String(data[i][2] || '').trim();
      if (cellNik === targetNik) {
        targetRowIndex = i + 1; // 1-indexed
        break;
      }
    }

    if (targetRowIndex !== -1) {
      sheet.getRange(targetRowIndex, 1, 1, 7).setValues([[
        rowData[0] || (targetRowIndex - 1),
        String(rowData[1] || ''),
        "'" + String(rowData[2] || ''),
        String(rowData[3] || ''),
        String(rowData[4] || ''),
        String(rowData[5] || ''),
        String(rowData[6] || '')
      ]]);
      return jsonResponse({ ok: true, message: 'Baris NIK ' + targetNik + ' berhasil diupdate' });
    } else {
      // Jika belum ada, append baru
      return handleAppendDataTambahan(payload);
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Gagal update: ' + err.toString() });
  }
}

function handleDeleteDataTambahan(payload) {
  try {
    var sheet = getTargetSheet(payload);
    if (!sheet) return jsonResponse({ ok: false, error: 'Spreadsheet tidak ditemukan' });

    var targetNik = String(payload.nik || '').trim();
    if (!targetNik) return jsonResponse({ ok: false, error: 'NIK kosong' });

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var cellNik = String(data[i][2] || '').trim();
      if (cellNik === targetNik) {
        sheet.deleteRow(i + 1);
        return jsonResponse({ ok: true, message: 'Baris NIK ' + targetNik + ' berhasil dihapus' });
      }
    }

    return jsonResponse({ ok: true, message: 'Baris tidak ditemukan di Spreadsheet' });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Gagal menghapus: ' + err.toString() });
  }
}

function handleClearDataTambahan(payload) {
  try {
    var sheet = getTargetSheet(payload);
    if (!sheet) return jsonResponse({ ok: false, error: 'Spreadsheet tidak ditemukan' });

    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    return jsonResponse({ ok: true, message: 'Seluruh data di sheet Data_tambahan berhasil dibersihkan' });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Gagal membersihkan: ' + err.toString() });
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'active',
      service: 'Google Apps Script Webhook Bridge - Data Tambahan Indomaret',
      version: '2.5.0',
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
`;

export default function AppsScriptModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Ambil URL yang saat ini tersimpan
  useEffect(() => {
    if (!isOpen) return;
    async function loadConfig() {
      try {
        const res = await fetch('/api/settings/spreadsheet-bridge');
        const json = await res.json();
        if (json.ok && json.data?.bridgeUrl) {
          setBridgeUrl(json.data.bridgeUrl);
        }
      } catch (err) {
        console.warn('Gagal memuat config bridge:', err);
      }
    }
    loadConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopied(true);
      toast.success('Kode Apps Script (Code.gs) berhasil disalin ke clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Gagal menyalin teks');
    }
  }

  async function handleSaveAndTest() {
    if (!bridgeUrl.trim()) {
      toast.error('Masukkan URL Web App Google Apps Script');
      return;
    }

    setSavingUrl(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/settings/spreadsheet-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridgeUrl: bridgeUrl.trim() }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        setTestResult(json.pingResult);
        if (json.pingResult?.ok) {
          toast.success('URL Apps Script tersimpan dan berhasil terhubung!');
        } else {
          toast.success('URL Apps Script tersimpan!');
        }
      } else {
        toast.error(json.error || 'Gagal menyimpan URL');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan: ' + err.message);
    } finally {
      setSavingUrl(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-title">
                Pengaturan Google Apps Script Webhook (Code.gs)
              </h2>
              <p className="text-xs text-gray-500">
                Hubungkan website langsung ke Google Spreadsheet sheet Data_tambahan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Kolom Pengaturan URL Web App */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-3">
            <label className="block font-bold text-gray-900 text-xs flex items-center justify-between">
              <span>Masukkan URL Web App Google Apps Script Anda (berakhiran /exec):</span>
              <span className="text-[11px] text-emerald-800 font-semibold">Tersimpan di Sistem</span>
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="url"
                value={bridgeUrl}
                onChange={(e) => setBridgeUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleSaveAndTest}
                disabled={savingUrl || !bridgeUrl.trim()}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center justify-center gap-2 disabled:opacity-50 min-h-[40px]"
              >
                {savingUrl ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Simpan &amp; Tes Koneksi</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  testResult.ok
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {testResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Sukses Terhubung: {testResult.message || 'Koneksi ke Web App Spreadsheet berhasil aktif!'}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Status: {testResult.error || 'Web App menerima panggilan.'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Langkah 1, 2, 3 */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 text-blue-900 space-y-2">
            <h3 className="font-bold flex items-center gap-2 text-sm text-[#0056b3]">
              <HelpCircle className="w-4 h-4" />
              Cara Memasang Kode di Spreadsheet Anda:
            </h3>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-blue-950 font-medium">
              <li>
                Buka Spreadsheet Anda:{' '}
                <a
                  href={SPREADSHEET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline text-[#0056b3] inline-flex items-center gap-1"
                >
                  Buka Google Sheet Sumber <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Di menu bar spreadsheet, klik: <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.
              </li>
              <li>
                Hapus seluruh teks di file <code>Code.gs</code>, lalu <strong>Salin (Copy)</strong> kode di bawah dan <strong>Paste (Tempel)</strong> ke sana.
              </li>
              <li>Klik ikon <strong>Simpan (Save / Disket)</strong>.</li>
              <li>
                Klik tombol biru <strong>Terapkan (Deploy)</strong> di kanan atas &gt; <strong>Penerapan baru (New deployment)</strong>.
              </li>
              <li>
                Pilih jenis <strong>Aplikasi web (Web app)</strong>. Pada opsi <em>Who has access</em>, pilih <strong>Anyone (Siapa saja)</strong>. Lalu klik <strong>Deploy</strong>.
              </li>
              <li>Salin URL Aplikasi Web (berakhiran <code>/exec</code>), lalu tempelkan ke kolom input di atas dan klik <strong>Simpan &amp; Tes Koneksi</strong>.</li>
            </ol>
          </div>

          {/* Kotak Kode Code.gs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-700">Kode Lengkap (Code.gs) - Versi Terbaru:</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0056b3] hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Seluruh Kode'}</span>
              </button>
            </div>

            <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[260px] leading-relaxed border border-gray-800">
              {APPS_SCRIPT_CODE}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-xs transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin ke Clipboard' : 'Salin Kode Code.gs'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
