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
    version: '2.1.0',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handler HTTP POST utama untuk melayani pengunggahan, pemanggilan, penghapusan, dan pembersihan duplikat file
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

      case 'update':
        return handleUpdate(rootFolder, payload);

      case 'get':
        return handleGet(rootFolder, payload);

      case 'trash':
        return handleTrash(rootFolder, payload);

      case 'cleanDuplicates':
        return handleCleanDuplicates(rootFolder, payload);

      case 'listFiles':
        return handleListFiles(rootFolder, payload);

      case 'findFilesByNik':
        return handleFindFilesByNik(rootFolder, payload);

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
 * Opsi: jika replaceNik disertakan atau cleanOldDuplicates=true, bersihkan duplikat lama untuk NIK tersebut
 */
function handleUpload(folder, payload) {
  var fileName = payload.fileName || 'bukti_' + new Date().getTime() + '.jpg';
  var mimeType = payload.mimeType || 'application/octet-stream';
  var base64Data = payload.base64;
  var targetNik = payload.nik || extractNikFromFileName(fileName);
  var cleanOldDuplicates = payload.cleanOldDuplicates !== false;

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

  var newFileId = file.getId();
  var trashedOldFiles = [];

  // Jika diminta membersihkan file lama dengan NIK yang sama di folder ini
  if (targetNik && cleanOldDuplicates) {
    try {
      var files = folder.getFiles();
      while (files.hasNext()) {
        var existingFile = files.next();
        var existingId = existingFile.getId();
        if (existingId !== newFileId) {
          var existingName = existingFile.getName();
          var existingNik = extractNikFromFileName(existingName);
          if (existingNik === targetNik) {
            existingFile.setTrashed(true);
            trashedOldFiles.push({ id: existingId, name: existingName });
          }
        }
      }
    } catch (cleanErr) {
      // Jangan gagalkan upload jika cleanup duplikat gagal
    }
  }

  return createJsonResponse({
    ok: true,
    fileId: newFileId,
    fileName: file.getName(),
    webViewLink: file.getUrl(),
    mimeType: file.getMimeType(),
    size: file.getSize(),
    trashedOldFiles: trashedOldFiles,
  });
}

/**
 * Aksi: UPDATE (Menimpa file lama jika fileId ada atau upload baru sebagai pengganti)
 */
function handleUpdate(folder, payload) {
  var oldFileId = payload.oldFileId || payload.fileId;
  var fileName = payload.fileName || 'bukti_' + new Date().getTime() + '.jpg';
  var mimeType = payload.mimeType || 'application/octet-stream';
  var base64Data = payload.base64;

  if (!base64Data) {
    return createJsonResponse({ ok: false, error: 'Konten file base64 wajib diisi' }, 400);
  }

  // Coba cari dan validasi file lama
  var oldFile = null;
  if (oldFileId) {
    try {
      var candidate = DriveApp.getFileById(oldFileId);
      if (isFileInsideFolder(candidate, folder.getId())) {
        oldFile = candidate;
      }
    } catch (e) {
      oldFile = null;
    }
  }

  // Buat file baru terlebih dahulu (Safe Replace)
  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var newFile = folder.createFile(blob);

  try {
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sErr) {}

  // Jika file lama ditemukan dan berbeda dari file baru, buang ke sampah
  var oldTrashed = false;
  if (oldFile && oldFile.getId() !== newFile.getId()) {
    try {
      oldFile.setTrashed(true);
      oldTrashed = true;
    } catch (tErr) {}
  }

  return createJsonResponse({
    ok: true,
    fileId: newFile.getId(),
    fileName: newFile.getName(),
    webViewLink: newFile.getUrl(),
    mimeType: newFile.getMimeType(),
    size: newFile.getSize(),
    oldFileTrashed: oldTrashed,
    oldFileId: oldFile ? oldFile.getId() : null,
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
 * Aksi: CLEAN DUPLICATES (Pembersihan File Ganda di Folder Cabang)
 * Untuk setiap NIK yang memiliki lebih dari satu berkas bukti, pertahankan yang paling baru (berdasarkan waktu modifikasi/pembuatan)
 * dan pindahkan sisanya ke sampah (trash).
 */
function handleCleanDuplicates(folder, payload) {
  var files = folder.getFiles();
  var nikMap = {}; // nik -> array of { file, id, name, lastUpdated, dateCreated, size, mimeType }
  var totalScanned = 0;
  var otherFilesCount = 0;

  while (files.hasNext()) {
    var file = files.next();
    totalScanned++;
    var name = file.getName();
    var nik = extractNikFromFileName(name);

    if (nik) {
      if (!nikMap[nik]) {
        nikMap[nik] = [];
      }
      nikMap[nik].push({
        file: file,
        id: file.getId(),
        name: name,
        lastUpdated: file.getLastUpdated().getTime(),
        dateCreated: file.getDateCreated().getTime(),
        size: file.getSize(),
        mimeType: file.getMimeType(),
        url: file.getUrl(),
      });
    } else {
      otherFilesCount++;
    }
  }

  var trashedCount = 0;
  var duplicateNiksCount = 0;
  var details = [];
  var keptFiles = []; // list of files kept for database sync: { nik, fileId, fileName, fileUrl, mimeType, size }

  var nikKeys = Object.keys(nikMap);
  for (var i = 0; i < nikKeys.length; i++) {
    var currentNik = nikKeys[i];
    var list = nikMap[currentNik];

    // Urutkan: yang paling baru (lastUpdated terbesar) di index 0
    list.sort(function (a, b) {
      if (b.lastUpdated !== a.lastUpdated) {
        return b.lastUpdated - a.lastUpdated;
      }
      return b.dateCreated - a.dateCreated;
    });

    var newest = list[0];
    keptFiles.push({
      nik: currentNik,
      fileId: newest.id,
      fileName: newest.name,
      fileUrl: newest.url,
      mimeType: newest.mimeType,
      size: newest.size,
      lastUpdated: new Date(newest.lastUpdated).toISOString(),
    });

    if (list.length > 1) {
      duplicateNiksCount++;
      var trashedForNik = [];

      // Pindahkan file ke-1 sampai ke-(n-1) ke tempat sampah
      for (var j = 1; j < list.length; j++) {
        var oldItem = list[j];
        try {
          oldItem.file.setTrashed(true);
          trashedCount++;
          trashedForNik.push({
            id: oldItem.id,
            name: oldItem.name,
            lastUpdated: new Date(oldItem.lastUpdated).toISOString(),
          });
        } catch (tErr) {
          // Abaikan jika gagal membuang satu file
        }
      }

      details.push({
        nik: currentNik,
        kept: {
          id: newest.id,
          name: newest.name,
          lastUpdated: new Date(newest.lastUpdated).toISOString(),
        },
        trashed: trashedForNik,
      });
    }
  }

  return createJsonResponse({
    ok: true,
    message: 'Pembersihan file duplikat selesai. ' + trashedCount + ' file lama dipindahkan ke sampah.',
    summary: {
      totalFilesScanned: totalScanned,
      uniqueNiksFound: nikKeys.length,
      duplicateNiksFound: duplicateNiksCount,
      duplicateFilesTrashed: trashedCount,
      otherFilesCount: otherFilesCount,
    },
    keptFiles: keptFiles,
    details: details,
  });
}

/**
 * Aksi: LIST FILES (Daftar semua file di folder)
 */
function handleListFiles(folder, payload) {
  var files = folder.getFiles();
  var list = [];
  var limit = payload.limit || 500;
  var count = 0;

  while (files.hasNext() && count < limit) {
    var file = files.next();
    count++;
    list.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      lastUpdated: file.getLastUpdated().toISOString(),
      dateCreated: file.getDateCreated().toISOString(),
      url: file.getUrl(),
    });
  }

  return createJsonResponse({
    ok: true,
    total: count,
    files: list,
  });
}

/**
 * Aksi: FIND FILES BY NIK (Cari file bukti berdasarkan NIK)
 */
function handleFindFilesByNik(folder, payload) {
  var targetNik = (payload.nik || '').trim();
  if (!targetNik) {
    return createJsonResponse({ ok: false, error: 'NIK wajib diisi' }, 400);
  }

  var files = folder.getFiles();
  var matches = [];

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    var nik = extractNikFromFileName(name);
    if (nik === targetNik) {
      matches.push({
        id: file.getId(),
        name: name,
        mimeType: file.getMimeType(),
        size: file.getSize(),
        lastUpdated: file.getLastUpdated().toISOString(),
        url: file.getUrl(),
      });
    }
  }

  // Urutkan yang terbaru di awal
  matches.sort(function (a, b) {
    return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
  });

  return createJsonResponse({
    ok: true,
    nik: targetNik,
    count: matches.length,
    files: matches,
  });
}

/**
 * Helper: Ekstrak NIK dari nama file
 * Pola format: NIK_BA_NAMA_PESERTA_TANGGAL.ext atau NIK_...
 */
function extractNikFromFileName(fileName) {
  if (!fileName) return null;
  var clean = fileName.trim();
  // Cocokkan NIK 8-16 digit di awal nama file (misal: 2015556678_BA_...)
  var match = clean.match(/^(\d{8,16})_/);
  if (match) {
    return match[1];
  }
  return null;
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
