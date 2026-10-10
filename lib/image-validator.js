/**
 * Validasi mendalam untuk file gambar (JPG, PNG)
 * Memeriksa magic bytes untuk memastikan integritas format.
 */
export async function validateImageFile(file) {
  // 1. Validasi Ekstensi dan MIME di sisi klien
  const allowedMimeTypes = ['image/jpeg', 'image/png'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  const isMimeValid = allowedMimeTypes.includes(file.type);
  const isExtValid = allowedExtensions.includes(ext);

  if (!isMimeValid || !isExtValid) {
    return { 
        valid: false, 
        message: `File "${file.name}" berformat ${file.type || 'tidak dikenal'} tidak dapat diunggah. Format yang diperbolehkan hanya JPG, JPEG, dan PNG.` 
    };
  }

  // 2. Validasi Magic Bytes (Magic Numbers)
  const buffer = await file.slice(0, 8).arrayBuffer();
  const uint = new Uint8Array(buffer);
  let bytes = [];
  uint.forEach((byte) => {
    bytes.push(byte.toString(16));
  });
  const hex = bytes.join('').toUpperCase();

  // JPEG: FF D8 FF
  const isJpeg = hex.startsWith('FFD8FF');
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng = hex.startsWith('89504E470D0A1A0A');

  if ((file.type === 'image/jpeg' && !isJpeg) || (file.type === 'image/png' && !isPng)) {
    return { 
        valid: false, 
        message: `Isi file "${file.name}" tidak sesuai dengan ekstensinya. Gunakan file JPG atau PNG yang asli.` 
    };
  }

  return { valid: true };
}
