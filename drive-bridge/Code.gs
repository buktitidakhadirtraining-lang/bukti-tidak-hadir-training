/**
 * GOOGLE APPS SCRIPT WEBHOOK BRIDGE (Code.gs)
 * Untuk Google Spreadsheet Rekap & Data Tambahan:
 * https://docs.google.com/spreadsheets/d/1X9rBiIzAo-PHIAPAFcAU3ElpHBSVDga_BftgSeqWdqY
 *
 * FUNGSI UTAMA:
 * 1. Otomatis menerima data baru dari form "Input Data Tambahan" website
 *    dan mencatatnya langsung ke sheet "Data_tambahan".
 * 2. Menyediakan fungsi upload bukti ke Google Drive cabang.
 * 3. Menangani ping/tes koneksi dari sistem website.
 *
 * CARA PASANG:
 * 1. Buka Google Spreadsheet Anda.
 * 2. Klik menu: Extensions (Ekstensi) > Apps Script.
 * 3. Hapus seluruh isi di editor, lalu salin (paste) SELURUH KODE DI BAWAH INI.
 * 4. Klik ikon Disket (Save / Simpan).
 * 5. Klik tombol biru: Deploy (Terapkan) > New deployment (Penerapan baru).
 * 6. Klik ikon gerigi di kiri atas > Pilih "Web app".
 * 7. Atur pengaturannya:
 *    - Description: Webhook Data Tambahan & Drive Bridge
 *    - Execute as: Me (email akun Anda)
 *    - Who has access: Anyone (Siapa saja)  <-- WAJIB PILIH ANYONE
 * 8. Klik tombol "Deploy" (Terapkan).
 * 9. Berikan izin otorisasi jika diminta (Authorize access > Pilih akun Google > Advanced > Go to Untitled project).
 * 10. Salin URL Web App yang muncul (berakhiran /exec).
 * 11. Masukkan URL tersebut ke aplikasi website (Menu Admin Cabang atau Pengaturan Webhook).
 */

// ==============================================================================
// 1. KONFIGURASI UTAMA
// ==============================================================================
// Ganti ID Folder di bawah jika Anda juga menggunakan Google Drive untuk upload foto bukti
var ROOT_FOLDER_ID = 'MASUKKAN_ID_FOLDER_GOOGLE_DRIVE_DISINI'; 

// Ganti atau samakan dengan SECRET di aplikasi website (bebas Anda tentukan)
var SHARED_SECRET = 'indomaret2026';

// Nama sheet target untuk pencatatan otomatis data tambahan
var SHEET_DATA_TAMBAHAN_NAME = 'Data_tambahan';

// ==============================================================================
// 2. ENTRY POINT HTTP POST (Menerima kiriman data dari sistem website)
// ==============================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Tidak ada data payload yang dikirim' });
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ ok: false, error: 'Payload harus berupa JSON: ' + parseErr.toString() });
    }

    var action = payload.action;

    // Aksi 1: PENCATATAN OTOMATIS DATA TAMBAHAN KE SPREADSHEET
    if (action === 'append_data_tambahan') {
      return handleAppendDataTambahan(payload);
    }

    // Aksi 2: TES KONEKSI DARI WEBSITE (PING)
    if (action === 'ping') {
      return jsonResponse({
        ok: true,
        message: 'Koneksi ke Google Apps Script Web App berhasil aktif!',
        timestamp: new Date().toISOString()
      });
    }

    // Aksi 3: UPLOAD FOTO BUKTI KE GOOGLE DRIVE
    if (action === 'upload') {
      return handleUploadDrive(payload);
    }

    // Aksi 4: BACA FOTO BUKTI DARI GOOGLE DRIVE
    if (action === 'get') {
      return handleGetDrive(payload);
    }

    // Aksi 5: HAPUS FILE GOOGLE DRIVE
    if (action === 'trash') {
      return handleTrashDrive(payload);
    }

    return jsonResponse({ ok: false, error: 'Aksi "' + action + '" tidak dikenali' });

  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'Terjadi error internal di Apps Script: ' + err.toString()
    });
  }
}

// ==============================================================================
// 3. HANDLER: MENCATAT DATA TAMBAHAN KE GOOGLE SPREADSHEET
// ==============================================================================
function handleAppendDataTambahan(payload) {
  try {
    var ss;
    if (payload.spreadsheetId) {
      try {
        ss = SpreadsheetApp.openById(payload.spreadsheetId);
      } catch (openErr) {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!ss) {
      return jsonResponse({
        ok: false,
        error: 'Spreadsheet tidak ditemukan. Pastikan skrip ini terpasang di Spreadsheet target.'
      });
    }

    var sheetName = payload.sheet || SHEET_DATA_TAMBAHAN_NAME;
    var sheet = ss.getSheetByName(sheetName);

    // Jika sheet belum ada, buatkan sheet baru secara otomatis
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // Buat header standar resmi sesuai format:
      // NO | TRAINING | NIK | NAMA | KD TOKO | NAMA TOKO | ALASAN TIDAK HADIR
      sheet.appendRow([
        'NO',
        'TRAINING',
        'NIK',
        'NAMA',
        'KD TOKO',
        'NAMA TOKO',
        'ALASAN TIDAK HADIR'
      ]);
      
      // Berikan style header rapi
      var headerRange = sheet.getRange(1, 1, 1, 7);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4CAF50');
      headerRange.setFontColor('#FFFFFF');
    }

    var rowData = payload.row;
    if (!rowData || !Array.isArray(rowData)) {
      return jsonResponse({
        ok: false,
        error: 'Data baris (row) tidak valid atau kosong'
      });
    }

    // Hitung nomor urut berikutnya jika baris pertama (NO) kosong atau 0
    var lastRow = sheet.getLastRow();
    if (!rowData[0] || rowData[0] === 0) {
      rowData[0] = lastRow > 1 ? (lastRow) : 1;
    }

    // Pastikan NIK dan Kode Toko disimpan sebagai string (agar angka 0 di depan tidak hilang)
    var formattedRow = [
      rowData[0],
      String(rowData[1] || ''),
      "'" + String(rowData[2] || ''), // Tanda petik agar terbaca teks di spreadsheet
      String(rowData[3] || ''),
      String(rowData[4] || ''),
      String(rowData[5] || ''),
      String(rowData[6] || '')
    ];

    // Sisipkan baris baru ke paling bawah sheet Data_tambahan
    sheet.appendRow(formattedRow);

    return jsonResponse({
      ok: true,
      message: 'Data tambahan berhasil dicatat ke sheet ' + sheetName,
      rowNumber: sheet.getLastRow(),
      insertedData: formattedRow
    });

  } catch (sheetErr) {
    return jsonResponse({
      ok: false,
      error: 'Gagal menulis ke Spreadsheet: ' + sheetErr.toString()
    });
  }
}

// ==============================================================================
// 4. HANDLER GOOGLE DRIVE (UPLOAD FOTO BUKTI)
// ==============================================================================
function handleUploadDrive(payload) {
  try {
    var fileName = payload.fileName || ('bukti_' + new Date().getTime() + '.jpg');
    var mimeType = payload.mimeType || 'image/jpeg';
    var base64 = payload.base64;

    if (!base64) {
      return jsonResponse({ ok: false, error: 'Konten file base64 wajib ada' });
    }

    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);

    var folder;
    try {
      folder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    } catch (e) {
      folder = DriveApp.getRootFolder();
    }

    var file = folder.createFile(blob);

    return jsonResponse({
      ok: true,
      fileId: file.getId(),
      fileName: file.getName(),
      webViewLink: file.getUrl()
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Gagal upload ke Drive: ' + err.toString() });
  }
}

function handleGetDrive(payload) {
  try {
    var file = DriveApp.getFileById(payload.fileId);
    var blob = file.getBlob();
    return jsonResponse({
      ok: true,
      name: file.getName(),
      mimeType: file.getMimeType(),
      base64: Utilities.base64Encode(blob.getBytes())
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Gagal membaca file: ' + err.toString() });
  }
}

function handleTrashDrive(payload) {
  try {
    if (!payload.fileId) return jsonResponse({ ok: true });
    var file = DriveApp.getFileById(payload.fileId);
    file.setTrashed(true);
    return jsonResponse({ ok: true, message: 'File berhasil dihapus' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// ==============================================================================
// 5. ENTRY POINT HTTP GET (Untuk cek status di browser)
// ==============================================================================
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'active',
      service: 'Google Apps Script Webhook Bridge - Data Tambahan & Drive',
      version: '2.0.0',
      spreadsheet: '1X9rBiIzAo-PHIAPAFcAU3ElpHBSVDga_BftgSeqWdqY',
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// Helper pengembalian response JSON
function jsonResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
