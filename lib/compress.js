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
 * - Jika ukuran foto <= 2 MB: TIDAK PERLU DIKOMPRES (kualitas dan ukuran 100% asli).
 * - Jika ukuran foto > 2 MB: Kompres secara proporsional dengan target tepat di bawah 2 MB
 *   (berada di kisaran 1.1 MB - 1.8 MB) dan tidak dikompres berlebihan di bawah 1 MB agar kualitas tetap prima.
 */
export async function compressImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar (JPG, PNG, WEBP).');
  }

  // ATURAN 1: Jika file sudah di bawah 2 MB, TIDAK PERLU DIKOMPRES!
  if (file.size <= TWO_MB_BYTES) {
    return {
      file: file,
      blob: file,
      originalSize: file.size,
      compressedSize: file.size,
      isCompressed: false,
      sizeSummary: `${formatBytes(file.size)} (Ukuran < 2 MB, tanpa kompresi)`,
    };
  }

  // ATURAN 2: Jika file di atas 2 MB, kompres moderat agar pas di bawah 2 MB (1.2 MB - 1.8 MB)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat format gambar ke canvas.'));
      img.onload = () => {
        // Resolusi tinggi (2560px) untuk memastikan dokumen/surat tetap sangat tajam
        let maxSide = 2560;
        let width = img.width;
        let height = img.height;

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

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Mulai dengan kualitas tinggi (0.92)
        const attempt = (q) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Gagal mengompres gambar.'));
              }

              // Jika masih di atas 2 MB dan kualitas masih aman (q >= 0.86), turunkan bertahap
              if (blob.size > TWO_MB_BYTES && q >= 0.86) {
                return attempt(q - 0.03);
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

        attempt(0.92);
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
