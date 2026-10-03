/**
 * GOOGLE APPS SCRIPT DRIVE BRIDGE
 * Sistem Data Ketidakhadiran Peserta Training Indomaret
 * Dibuat oleh Bang Ajiib (2026)
 *
 * INSTRUKSI KONFIGURASI:
 * 1. Ganti ROOT_FOLDER_ID dengan ID folder Google Drive cabang Anda
 *    (Contoh: buka folder di browser, salin kode setelah /folders/...)
 * 2. Ganti SHARED_SECRET dengan kata sandi rahasia cabang yang kuat
 * 3. Deploy > New Deployment > Web App > Execute as: Me > Who has access: Anyone
 */

// ==============================================================================
// KONFIGURASI CABANG (SESUAIKAN 2 BARIS INI)
// ==============================================================================
var ROOT_FOLDER_ID = 'MASUKKAN_ID_FOLDER_GOOGLE_DRIVE_CABANG_DISINI';
var SHARED_SECRET = 'MASUKKAN_SHARED_SECRET_CABANG_DISINI';

// ==============================================================================
// ENTRY POINT WEB APP (HTTP POST)
// ==============================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Tidak ada data payload yang dikirim' }, 400);
    }

    var requestData;
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ ok: false, error: 'Format payload harus berupa JSON yang valid' }, 400);
    }

    // 1. Verifikasi Kata Sandi Rahasia (SHARED_SECRET)
    if (!requestData.secret || requestData.secret !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: 'Secret Key Drive Bridge salah atau tidak sesuai' }, 403);
    }

    var action = requestData.action;

    // 2. Routing Aksi
    switch (action) {
      case 'ping':
        return handlePing();

      case 'upload':
        return handleUpload(requestData);

      case 'get':
        return handleGet(requestData);

      case 'trash':
        return handleTrash(requestData);

      default:
        return jsonResponse({ ok: false, error: 'Aksi "' + action + '" tidak dikenali' }, 400);
    }
  } catch (globalErr) {
    return jsonResponse({
      ok: false,
      error: 'Terjadi kesalahan internal pada Google Apps Script: ' + globalErr.toString()
    }, 500);
  }
}

// ==============================================================================
// HANDLER: PING (TEST KONEKSI & VERIFIKASI FOLDER)
// ==============================================================================
function handlePing() {
  try {
    var folder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    return jsonResponse({
      ok: true,
      folderName: folder.getName(),
      message: 'Koneksi ke Google Drive Cabang berhasil terverifikasi'
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'Gagal mengakses folder Google Drive: ' + err.toString() + '. Periksa kembali ROOT_FOLDER_ID.'
    });
  }
}

// ==============================================================================
// HANDLER: UPLOAD (UNGGAH FILE BUKTI KE FOLDER CABANG)
// ==============================================================================
function handleUpload(data) {
  try {
    var fileName = data.fileName || ('bukti_' + new Date().getTime() + '.jpg');
    var mimeType = data.mimeType || 'image/jpeg';
    var base64 = data.base64;

    if (!base64) {
      return jsonResponse({ ok: false, error: 'Konten base64 file wajib disertakan' });
    }

    var decodedBytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    var targetFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var createdFile = targetFolder.createFile(blob);

    return jsonResponse({
      ok: true,
      fileId: createdFile.getId(),
      fileName: createdFile.getName(),
      webViewLink: createdFile.getUrl()
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'Gagal mengunggah file ke Google Drive: ' + err.toString()
    });
  }
}

// ==============================================================================
// HANDLER: GET (BACA KONTEN FILE UNTUK PRATINJAU)
// ==============================================================================
function handleGet(data) {
  try {
    var fileId = data.fileId;
    if (!fileId) {
      return jsonResponse({ ok: false, error: 'Parameter fileId wajib disertakan' });
    }

    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var base64String = Utilities.base64Encode(blob.getBytes());

    return jsonResponse({
      ok: true,
      name: file.getName(),
      mimeType: file.getMimeType(),
      base64: base64String
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'Gagal mengambil file dari Google Drive: ' + err.toString()
    });
  }
}

// ==============================================================================
// HANDLER: TRASH (HAPUS / PINDAHKAN FILE KE TEMPAT SAMPAH)
// ==============================================================================
function handleTrash(data) {
  try {
    var fileId = data.fileId;
    if (!fileId) {
      return jsonResponse({ ok: true, message: 'Tidak ada fileId untuk dihapus' });
    }

    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);

    return jsonResponse({
      ok: true,
      message: 'File berhasil dipindahkan ke tempat sampah Google Drive'
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'Gagal memindahkan file ke sampah: ' + err.toString()
    });
  }
}

// ==============================================================================
// HELPER: FORMAT OUTPUT JSON
// ==============================================================================
function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ==============================================================================
// HANDLER GET (INFO CEK STATUS)
// ==============================================================================
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'active',
      service: 'Google Apps Script Drive Bridge - Training Attendance System',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
