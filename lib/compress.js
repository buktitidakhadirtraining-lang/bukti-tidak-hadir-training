// lib/compress.js
import { MAX_IMAGE_SIDE, JPEG_QUALITY, MAX_PDF_SIZE_BYTES } from './config.js';

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
 * Kompres file gambar di browser menggunakan HTML5 Canvas
 * Mempertahankan ketajaman teks/dokumen dan otomatis mereduksi ukuran file hingga 70-85%
 */
export async function compressImage(file, maxSide = MAX_IMAGE_SIDE, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Berkas harus berupa gambar (JPG, PNG, WEBP).'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat format gambar ke canvas.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Skala dimensi dengan mempertahankan aspect ratio
        if (width > height) {
          if (width > maxSide) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          }
        } else {
          if (height > maxSide) {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Browser tidak mendukung canvas 2D context.'));
        }

        // Pengaturan render kualitas tinggi
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Gagal mengompres gambar.'));
            }

            // Nama file baru dengan format .jpg
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const compressedFileName = `${baseName}.jpg`;

            const compressedFile = new File([blob], compressedFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            const origSize = file.size;
            const newSize = blob.size;
            const pct = origSize > 0 ? Math.round(((origSize - newSize) / origSize) * 100) : 0;
            const sizeSummary = pct > 0
              ? `${formatBytes(origSize)} → ${formatBytes(newSize)} (Hemat ${pct}%)`
              : `${formatBytes(newSize)}`;

            resolve({
              file: compressedFile,
              blob: blob,
              originalSize: origSize,
              compressedSize: newSize,
              sizeSummary: sizeSummary,
              width: width,
              height: height,
            });
          },
          'image/jpeg',
          quality
        );
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
