// lib/compress.js
import { MAX_PDF_SIZE_BYTES } from './config.js';

const TWO_MB_BYTES = 2 * 1024 * 1024; // 2 MB (2,097,152 bytes)

/**
 * Format bytes ke string ukuran terbaca (B, KB, MB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Kompres file gambar di browser:
 * - Menjaga rasio dan resolusi agar tulisan/dokumen tetap jelas
 * - Menghormati orientasi EXIF
 * - Mendukung konversi HEIC jika browser mampu, atau pesan error informatif
 */
export async function compressImage(file, options = {}) {
  const { maxSide = 1600, forceCompress = false, maxSizeBytes = TWO_MB_BYTES } = options;

  if (!file) {
    throw new Error('Berkas gambar tidak ditemukan.');
  }

  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name?.toLowerCase().endsWith('.heic') ||
    file.name?.toLowerCase().endsWith('.heif');

  if (!file.type.startsWith('image/') && !isHeic) {
    throw new Error('Berkas harus berupa gambar (JPG, PNG, WEBP).');
  }

  // Jika ukuran foto <= maxSizeBytes dan tidak dipaksa kompres dan bukan HEIC:
  if (!forceCompress && !isHeic && file.size <= maxSizeBytes) {
    return {
      file: file,
      blob: file,
      originalSize: file.size,
      compressedSize: file.size,
      isCompressed: false,
      sizeSummary: `${formatBytes(file.size)} (Ukuran asli < ${formatBytes(maxSizeBytes)})`,
    };
  }

  // Kompres dengan canvas (browser otomatis menyesuaikan EXIF orientation)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        if (isHeic) {
          reject(new Error('Format HEIC tidak didukung oleh browser ini, gunakan format JPG atau PNG.'));
        } else {
          reject(new Error('Gagal memuat format gambar ke canvas.'));
        }
      };
      img.onload = () => {
        const effectiveMaxSide = maxSide || 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > effectiveMaxSide) {
            height = Math.round((height * effectiveMaxSide) / width);
            width = effectiveMaxSide;
          }
        } else {
          if (height > effectiveMaxSide) {
            width = Math.round((width * effectiveMaxSide) / height);
            height = effectiveMaxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Browser tidak mendukung canvas 2D context.'));
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Kualitas awal 0.90
        const attempt = (q) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Gagal mengompres gambar.'));
              }

              // Jika masih di atas 2 MB dan kualitas masih aman (q >= 0.80), turunkan bertahap
              if (blob.size > maxSizeBytes && q >= 0.80) {
                return attempt(q - 0.05);
              }

              const baseName = file.name.replace(/\.[^/.]+$/, '');
              const compressedFileName = `${baseName}.jpg`;

              const compressedFile = new File([blob], compressedFileName, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              const origSize = file.size;
              const newSize = blob.size;
              const pct = origSize > 0 ? Math.round(((origSize - newSize) / origSize) * 100) : 0;
              const sizeSummary = `${formatBytes(origSize)} → ${formatBytes(newSize)} (-${pct}%)`;

              resolve({
                file: compressedFile,
                blob: blob,
                originalSize: origSize,
                compressedSize: newSize,
                isCompressed: true,
                sizeSummary: sizeSummary,
                width: width,
                height: height,
              });
            },
            'image/jpeg',
            q
          );
        };

        attempt(0.90);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validasi dan proses berkas PDF (maksimal 1 MB)
 */
export function processPdfFile(file) {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Berkas harus berformat PDF.');
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error(`Ukuran berkas PDF melebihi batas maksimal ${formatBytes(MAX_PDF_SIZE_BYTES)}.`);
  }
  return file;
}
