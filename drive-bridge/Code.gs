/**
 * ============================================================================
 * GOOGLE APPS SCRIPT: DRIVE BRIDGE CABANG (Code.gs)
 * SISTEM DATA KETIDAKHADIRAN PESERTA TRAINING INDOMARET
 * ============================================================================
 *
 * Petunjuk Pemasangan di Akun Google Cabang:
 * 1. Buat Folder Baru di Google Drive cabang Anda (misal: "BUKTI_TRAINING_SBY").
 * 2. Salin ID Folder tersebut ke variabel ROOT_FOLDER_ID di bawah ini.
 * 3. Tentukan kata sandi rahasia cabang Anda pada variabel SHARED_SECRET.
 * 4. Klik "Deploy" (Penerapan) > "New deployment" (Penerapan baru) > Pilih jenis "Web app".
 *    - Description: Google Drive Bridge Cabang
 *    - Execute as: "Me" (email akun cabang)
 *    - Who has access: "Anyone" (Siapa saja)  <-- WAJIB PILIH ANYONE
 * 5. Klik "Deploy" lalu Salin URL Web App (berakhiran /exec).
 * 6. Masukkan URL Web App & Secret Key tersebut pada menu Admin > Master Cabang di aplikasi web.
 * ============================================================================
 */

// 1. ID Folder Google Drive khusus penyimpanan bukti pelatihan cabang Anda.
//    Dapatkan dari tautan URL folder Google Drive: drive.google.com/drive/folders/[ID_FOLDER]
var ROOT_FOLDER_ID = 'MASUKKAN_ID_FOLDER_GOOGLE_DRIVE_DISINI';

// 2. Kata sandi rahasia penghubung (Secret Key).
//    Pastikan sama persis dengan yang dimasukkan pada menu Admin > Master Cabang.
var SHARED_SECRET = 'MASUKKAN_SECRET_KEY_DISINI';

/**
 * Handler HTTP GET untuk pengujian cepat status Web App
 */
function doGet(e) {
  return createJsonResponse({
    ok: true,
    message: 'Google Drive Bridge Cabang Aktif! Gunakan metode POST dari aplikasi web.',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handler HTTP POST utama untuk melayani pengunggahan, pemanggilan, dan penghapusan file
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ ok: false, error: 'Bad Request: Data POST kosong' }, 400);
    }

    var payload = JSON.parse(e.postData.contents);
    var secret = payload.secret;
    var action = payload.action;

    // 1. Verifikasi Secret Key Keamanan
    if (!secret || secret !== getEffectiveSecret()) {
      return createJsonResponse(
        { ok: false, error: 'Akses Ditolak: Secret Key Drive Bridge tidak cocok dengan Code.gs cabang' },
        401
      );
    }

    // 2. Verifikasi ID Folder Google Drive
    var folderId = getEffectiveFolderId();
    if (!folderId || folderId.indexOf('MASUKKAN_') === 0) {
      return createJsonResponse(
        { ok: false, error: 'Konfigurasi Error: ROOT_FOLDER_ID belum diisi di file Code.gs cabang' },
        500
      );
    }

    var rootFolder;
    try {
      rootFolder = DriveApp.getFolderById(folderId);
    } catch (fErr) {
      return createJsonResponse(
        { ok: false, error: 'Folder Google Drive cabang tidak ditemukan atau tidak diberi akses' },
        404
      );
    }

    // 3. Eksekusi Aksi Sesuai Permintaan Aplikasi Web
    switch (action) {
      case 'ping':
        return handlePing(rootFolder);

      case 'upload':
        return handleUpload(rootFolder, payload);

      case 'get':
        return handleGet(rootFolder, payload);

      case 'trash':
        return handleTrash(rootFolder, payload);

      default:
        return createJsonResponse({ ok: false, error: 'Aksi "' + action + '" tidak dikenali' }, 400);
    }
  } catch (err) {
    return createJsonResponse(
      { ok: false, error: 'Terjadi kesalahan sistem pada Google Apps Script: ' + err.toString() },
      500
    );
  }
}

/**
 * Aksi: PING (Tes Koneksi & Ambil Info Folder)
 */
function handlePing(folder) {
  return createJsonResponse({
    ok: true,
    folderName: folder.getName(),
    folderId: folder.getId(),
    message: 'Koneksi ke Google Drive Cabang Berhasil Terhubung!',
  });
}

/**
 * Aksi: UPLOAD (Unggah berkas bukti baru ke folder Google Drive cabang)
 */
function handleUpload(folder, payload) {
  var fileName = payload.fileName || 'bukti_' + new Date().getTime() + '.jpg';
  var mimeType = payload.mimeType || 'application/octet-stream';
  var base64Data = payload.base64;

  if (!base64Data) {
    return createJsonResponse({ ok: false, error: 'Konten file base64 wajib diisi' }, 400);
  }

  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var file = folder.createFile(blob);

  // Atur file menjadi bisa diakses melalui URL link
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sErr) {
    // Abaikan jika kebijakan domain membatasi publikasi langsung
  }

  return createJsonResponse({
    ok: true,
    fileId: file.getId(),
    fileName: file.getName(),
    webViewLink: file.getUrl(),
    mimeType: file.getMimeType(),
    size: file.getSize(),
  });
}

/**
 * Aksi: GET (Mengambil file dengan validasi keamanan folder)
 */
function handleGet(rootFolder, payload) {
  var fileId = payload.fileId;
  if (!fileId) {
    return createJsonResponse({ ok: false, error: 'fileId wajib diisi' }, 400);
  }

  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (err) {
    return createJsonResponse({ ok: false, error: 'Berkas bukti tidak ditemukan di Google Drive' }, 404);
  }

  // Validasi Keamanan: Pastikan berkas benar berada di dalam ROOT_FOLDER_ID cabang ini
  if (!isFileInsideFolder(file, rootFolder.getId())) {
    return createJsonResponse(
      { ok: false, error: 'Akses Ditolak: Berkas berada di luar folder yang diizinkan' },
      403
    );
  }

  var blob = file.getBlob();
  var base64 = Utilities.base64Encode(blob.getBytes());

  return createJsonResponse({
    ok: true,
    name: file.getName(),
    mimeType: file.getMimeType(),
    size: file.getSize(),
    base64: base64,
  });
}

/**
 * Aksi: TRASH (Pindahkan file ke sampah Google Drive)
 */
function handleTrash(rootFolder, payload) {
  var fileId = payload.fileId;
  if (!fileId) {
    return createJsonResponse({ ok: false, error: 'fileId wajib diisi' }, 400);
  }

  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (err) {
    return createJsonResponse({ ok: true, message: 'Berkas sudah tidak ada atau telah dihapus' });
  }

  // Validasi Keamanan: Pastikan berkas berada di dalam folder cabang ini
  if (!isFileInsideFolder(file, rootFolder.getId())) {
    return createJsonResponse(
      { ok: false, error: 'Akses Ditolak: Berkas berada di luar folder yang diizinkan' },
      403
    );
  }

  file.setTrashed(true);

  return createJsonResponse({
    ok: true,
    message: 'Berkas berhasil dipindahkan ke tempat sampah Google Drive cabang',
  });
}

/**
 * Helper Keamanan: Memeriksa apakah file berada di dalam folder yang diizinkan
 */
function isFileInsideFolder(file, allowedFolderId) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    var parent = parents.next();
    if (parent.getId() === allowedFolderId) {
      return true;
    }
  }
  return false;
}

/**
 * Ambil Secret Key (mendukung Script Properties atau konstanta SHARED_SECRET)
 */
function getEffectiveSecret() {
  var prop = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  return prop || SHARED_SECRET;
}

/**
 * Ambil ID Folder (mendukung Script Properties atau konstanta ROOT_FOLDER_ID)
 */
function getEffectiveFolderId() {
  var prop = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  return prop || ROOT_FOLDER_ID;
}

/**
 * Helper menghasilkan HTTP Response format JSON
 */
function createJsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
