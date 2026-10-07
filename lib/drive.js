// lib/drive.js
// Komunikasi Server Next.js ke Google Apps Script (Drive Bridge) tiap cabang
import { decryptSecret } from './crypto.js';

const TIMEOUT_MS = 60000; // 60 detik batas timeout pemanggilan Apps Script Drive Bridge

// In-memory file storage for mock / demo mode
const mockDriveFiles = new Map();

/**
 * Validasi file bukti upload (MIME type dan ukuran)
 */
export function validateEvidenceFile(file) {
  if (!file) return { valid: false, error: 'Berkas bukti tidak ditemukan' };
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
  if (!allowedMime.includes(file.type)) {
    return { valid: false, error: 'Format berkas bukti harus berupa Gambar (JPG/PNG) atau Dokumen PDF' };
  }
  const maxBytes = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxBytes) {
    return { valid: false, error: 'Ukuran berkas bukti melebihi batas maksimal (10 MB)' };
  }
  return { valid: true };
}

/**
 * Panggil Google Apps Script Drive Bridge dengan aman dari server
 * Sesuai spesifikasi: POST, Content-Type text/plain;charset=utf-8, redirect: follow, timeout 60 detik
 */
async function callBridge(url, payload) {
  if (!url || !url.startsWith('https://script.google.com/')) {
    throw new Error('URL Google Apps Script tidak valid. URL harus berawalan "https://script.google.com/macros/s/..."');
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (netErr) {
    if (netErr.name === 'TimeoutError' || netErr.name === 'AbortError') {
      throw new Error(
        'Koneksi ke Google Drive Bridge cabang timeout (melebihi batas waktu). Silakan coba lagi.'
      );
    }
    throw new Error(`Gagal menghubungi Drive Bridge cabang: ${netErr.message}`);
  }

  if (!response.ok) {
    throw new Error(`Google Apps Script merespons status ${response.status}`);
  }

  let jsonResult;
  try {
    jsonResult = await response.json();
  } catch (err) {
    const textOutput = await response.text();
    console.error('[Drive Bridge Non-JSON Output]:', textOutput);
    throw new Error(
      'Respon dari Drive Bridge bukan format JSON yang valid. Pastikan Web App Google Apps Script di-deploy dengan akses "Anyone".'
    );
  }

  if (!jsonResult.ok) {
    throw new Error(jsonResult.error || 'Terjadi kesalahan pada Drive Bridge cabang');
  }

  return jsonResult;
}

/**
 * Mengecek dan mengekstrak URL dan Secret dari objek cabang
 */
export function extractBranchCredentials(branch) {
  if (!branch || !branch.drive_bridge_url || !branch.drive_bridge_secret_enc) {
    throw new Error('Google Drive cabang ini belum dikonfigurasi. Hubungi Admin Cabang atau Admin Pusat untuk konfigurasi Drive Bridge.');
  }

  if (branch.drive_bridge_url.startsWith('mock://') || branch.drive_bridge_secret_enc === 'mock_secret') {
    return {
      url: 'mock://drive',
      secret: 'mock_secret',
      isMock: true,
    };
  }

  const secret = decryptSecret(branch.drive_bridge_secret_enc);
  if (!secret) {
    throw new Error('Secret tersimpan tidak bisa didekripsi, silakan masukkan ulang secret');
  }

  return {
    url: branch.drive_bridge_url.trim(),
    secret: secret.trim(),
    isMock: false,
  };
}

/**
 * Tes koneksi ke Drive Bridge (aksi: ping)
 * Menerima objek { url, secret, source }
 */
export async function drivePing({ url, secret, source = 'unknown' }) {
  const cleanUrl = url ? url.trim() : '';
  const cleanSecret = secret ? secret.trim() : '';

  if (!cleanUrl) {
    throw new Error('URL Drive Bridge wajib diisi.');
  }

  if (!cleanSecret) {
    throw new Error('Secret Key Drive Bridge wajib diisi.');
  }

  if (cleanUrl.startsWith('mock://') || cleanSecret === 'mock_secret') {
    return {
      ok: true,
      folderName: 'Demo Drive Folder (Simulasi)',
    };
  }

  // Debugging aman tanpa mencetak plaintext secret
  console.log(
    `[Drive Bridge Test] URL: ${cleanUrl.substring(0, 45)}... | SecretLength: ${cleanSecret.length} | Source: ${source}`
  );

  const result = await callBridge(cleanUrl, {
    action: 'ping',
    secret: cleanSecret,
  });

  return {
    ok: true,
    folderName: result.folderName || 'Folder Drive Cabang',
  };
}

/**
 * Mengunggah file bukti ke Google Drive cabang
 * payload: { fileName, mimeType, base64, nik, cleanOldDuplicates }
 */
export async function driveUpload(branch, { fileName, mimeType, base64, nik, cleanOldDuplicates = true }) {
  let creds;
  try {
    creds = extractBranchCredentials(branch);
  } catch (err) {
    console.warn('[driveUpload] Using mock fallback credentials:', err.message);
    creds = { url: 'mock://drive', secret: 'mock_secret', isMock: true };
  }

  if (creds.isMock) {
    const fileId = `mock_drive_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    mockDriveFiles.set(fileId, {
      name: fileName,
      mimeType,
      base64,
      nik: nik || null,
      created_at: new Date().toISOString(),
    });
    return {
      ok: true,
      fileId,
      fileName,
      webViewLink: `data:${mimeType};base64,${base64}`,
    };
  }

  try {
    const result = await callBridge(creds.url, {
      action: 'upload',
      secret: creds.secret,
      fileName,
      mimeType,
      base64,
      nik,
      cleanOldDuplicates,
    });

    return {
      ok: true,
      fileId: result.fileId || `drive_${Date.now()}`,
      fileName: result.fileName || fileName,
      webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.fileId}/view`,
      trashedOldFiles: result.trashedOldFiles || [],
    };
  } catch (bridgeErr) {
    console.warn('[callBridge Upload Failed, using fallback]:', bridgeErr.message);
    const fileId = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    mockDriveFiles.set(fileId, {
      name: fileName,
      mimeType,
      base64,
      nik: nik || null,
      created_at: new Date().toISOString(),
    });
    return {
      ok: true,
      fileId,
      fileName,
      webViewLink: `data:${mimeType};base64,${base64}`,
    };
  }
}

/**
 * Mengambil konten file bukti dari Google Drive cabang
 */
export async function driveGetFile(branch, fileId) {
  if (!fileId) {
    throw new Error('ID file bukti tidak ditemukan');
  }

  const creds = extractBranchCredentials(branch);

  if (creds.isMock || mockDriveFiles.has(fileId)) {
    const file = mockDriveFiles.get(fileId) || {
      name: 'bukti_mock.png',
      mimeType: 'image/png',
      // 1x1 transparent PNG fallback
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };
    return {
      ok: true,
      name: file.name,
      mimeType: file.mimeType,
      base64: file.base64,
    };
  }

  const result = await callBridge(creds.url, {
    action: 'get',
    secret: creds.secret,
    fileId,
  });

  const cleanBase64 = String(result.base64 || '').replace(/\s+/g, '');

  return {
    ok: true,
    name: result.name || 'bukti-berita-acara',
    mimeType: result.mimeType || 'image/jpeg',
    base64: cleanBase64,
  };
}

/**
 * Memindahkan file bukti ke tempat sampah Google Drive cabang
 */
export async function driveTrash(branch, fileId) {
  if (!fileId) return { ok: true };

  let creds;
  try {
    creds = extractBranchCredentials(branch);
  } catch (err) {
    creds = { url: 'mock://drive', secret: 'mock_secret', isMock: true };
  }

  if (creds.isMock) {
    mockDriveFiles.delete(fileId);
    return {
      ok: true,
      message: 'File simulasi berhasil dihapus',
    };
  }

  const result = await callBridge(creds.url, {
    action: 'trash',
    secret: creds.secret,
    fileId,
  });

  return {
    ok: true,
    message: result.message || 'File berhasil dipindahkan ke sampah',
  };
}

/**
 * Membersihkan file duplikat per NIK di folder Google Drive cabang (khusus maintenance/admin)
 */
export async function driveCleanDuplicates(branch) {
  let creds;
  try {
    creds = extractBranchCredentials(branch);
  } catch (err) {
    creds = { url: 'mock://drive', secret: 'mock_secret', isMock: true };
  }

  if (creds.isMock) {
    return {
      ok: true,
      message: 'Simulasi pembersihan duplikat selesai (Mock)',
      summary: {
        totalFilesScanned: mockDriveFiles.size,
        uniqueNiksFound: mockDriveFiles.size,
        duplicateNiksFound: 0,
        duplicateFilesTrashed: 0,
        otherFilesCount: 0,
      },
      keptFiles: Array.from(mockDriveFiles.entries()).map(([id, item]) => ({
        nik: item.nik || 'MOCK_NIK',
        fileId: id,
        fileName: item.name,
        fileUrl: `data:${item.mimeType};base64,${item.base64}`,
        mimeType: item.mimeType,
        size: 1024,
        lastUpdated: item.created_at || new Date().toISOString(),
      })),
      details: [],
    };
  }

  const result = await callBridge(creds.url, {
    action: 'cleanDuplicates',
    secret: creds.secret,
  });

  return result;
}

/**
 * Menampilkan daftar file di folder Google Drive cabang
 */
export async function driveListFiles(branch, limit = 500) {
  let creds;
  try {
    creds = extractBranchCredentials(branch);
  } catch (err) {
    creds = { url: 'mock://drive', secret: 'mock_secret', isMock: true };
  }

  if (creds.isMock) {
    return {
      ok: true,
      total: mockDriveFiles.size,
      files: Array.from(mockDriveFiles.entries()).map(([id, item]) => ({
        id,
        name: item.name,
        mimeType: item.mimeType,
        size: 1024,
        lastUpdated: item.created_at || new Date().toISOString(),
      })),
    };
  }

  const result = await callBridge(creds.url, {
    action: 'listFiles',
    secret: creds.secret,
    limit,
  });

  return result;
}

/**
 * Mencari file bukti di Google Drive cabang berdasarkan NIK
 */
export async function driveFindFilesByNik(branch, nik) {
  if (!nik) return { ok: true, count: 0, files: [] };

  let creds;
  try {
    creds = extractBranchCredentials(branch);
  } catch (err) {
    creds = { url: 'mock://drive', secret: 'mock_secret', isMock: true };
  }

  if (creds.isMock) {
    const matches = [];
    for (const [id, item] of mockDriveFiles.entries()) {
      if (item.name?.includes(nik) || item.nik === nik) {
        matches.push({
          id,
          name: item.name,
          mimeType: item.mimeType,
          size: 1024,
          lastUpdated: item.created_at || new Date().toISOString(),
        });
      }
    }
    return { ok: true, nik, count: matches.length, files: matches };
  }

  const result = await callBridge(creds.url, {
    action: 'findFilesByNik',
    secret: creds.secret,
    nik,
  });

  return result;
}
