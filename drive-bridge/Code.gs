/**
 * GOOGLE APPS SCRIPT WEBHOOK BRIDGE (Code.gs)
 * Untuk Google Spreadsheet Rekap & Data Tambahan:
 * https://docs.google.com/spreadsheets/d/1X9rBiIzAo-PHIAPAFcAU3ElpHBSVDga_BftgSeqWdqY
 *
 * FUNGSI UTAMA:
 * 1. Otomatis menerima data baru dari form "Input Data Tambahan" website
 *    dan mencatatnya langsung ke sheet "Data_tambahan".
 * 2. Mendukung Update (Edit) dan Hapus (Delete / Clear) data tambahan.
 * 3. Menyediakan fungsi upload bukti ke Google Drive cabang.
 * 4. Menangani ping/tes koneksi dari sistem website.
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
 * 11. Masukkan URL tersebut ke aplikasi website (Tombol Kode Apps Script atau Menu Cabang).
 */

var SHEET_DATA_TAMBAHAN_NAME = 'Data_tambahan';
var ROOT_FOLDER_ID = 'MASUKKAN_ID_FOLDER_GOOGLE_DRIVE_DISINI'; 

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

    // Aksi 6: GOOGLE DRIVE UPLOAD / GET / TRASH
    if (action === 'upload') return handleUploadDrive(payload);
    if (action === 'get') return handleGetDrive(payload);
    if (action === 'trash') return handleTrashDrive(payload);

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

function handleUploadDrive(payload) {
  try {
    var fileName = payload.fileName || ('bukti_' + new Date().getTime() + '.jpg');
    var mimeType = payload.mimeType || 'image/jpeg';
    var base64 = payload.base64;
    if (!base64) return jsonResponse({ ok: false, error: 'Konten file base64 wajib ada' });
    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    var folder;
    try { folder = DriveApp.getFolderById(ROOT_FOLDER_ID); } catch (e) { folder = DriveApp.getRootFolder(); }
    var file = folder.createFile(blob);
    return jsonResponse({ ok: true, fileId: file.getId(), fileName: file.getName(), webViewLink: file.getUrl() });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Gagal upload ke Drive: ' + err.toString() });
  }
}

function handleGetDrive(payload) {
  try {
    var file = DriveApp.getFileById(payload.fileId);
    var blob = file.getBlob();
    return jsonResponse({ ok: true, name: file.getName(), mimeType: file.getMimeType(), base64: Utilities.base64Encode(blob.getBytes()) });
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

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'active',
      service: 'Google Apps Script Webhook Bridge - Data Tambahan Indomaret',
      version: '2.5.0',
      spreadsheet: '1X9rBiIzAo-PHIAPAFcAU3ElpHBSVDga_BftgSeqWdqY',
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
