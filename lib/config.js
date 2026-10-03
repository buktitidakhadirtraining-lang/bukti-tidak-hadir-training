// lib/config.js
// Konfigurasi konstan aplikasi

export const LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/4/44/Indomaret.svg';

export const APP_NAME = 'Sistem Data Ketidakhadiran Peserta Training';
export const APP_DESCRIPTION = 'Sistem pencatatan ketidakhadiran peserta training multi-cabang dengan bukti Google Drive per cabang dan database Supabase';
export const FOOTER_TEXT = 'Sistem Data Ketidakhadiran Peserta Training • Bang Ajiib © 2026';

// Batasan kompresi gambar di browser
export const MAX_IMAGE_SIDE = 1600; // Sisi terpanjang foto maksimal 1600px (sangat tajam untuk teks surat)
export const JPEG_QUALITY = 0.82;   // Kualitas kompresi optimal tinggi tanpa degradasi teks

// Batasan berkas
export const MAX_PDF_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB untuk file PDF
export const MAX_IMPORT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB untuk file Excel/CSV
export const MAX_IMPORT_ROWS = 1000;
export const MAX_EXPORT_ROWS = 20000;
export const MAX_PRINT_ITEMS = 400; // Maksimal lembar cetak sekaligus

// Pagination
export const ITEMS_PER_PAGE = 20;

// Durasi sesi JWT
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 Jam

// Durasi penguncian akun saat gagal login 5 kali berturut-turut
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

// Ukuran maksimal file upload bukti
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Daftar Bulan untuk filter dan laporan
export const MONTHS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

// Master Jabatan Peserta Training (5 Jabatan Resmi)
export const POSITIONS = [
  'Chief Of Store',
  'Store Sr. Leader',
  'Store Jr. Leader',
  'Store Crew Boy',
  'Store Crew Girl',
];

/**
 * Format tanggal menjadi format teks Indonesia (contoh: 21 September 2026)
 */
export function formatDateIndo(dateInput) {
  if (!dateInput) return '-';
  try {
    let d;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, day] = dateInput.split('-').map(Number);
      d = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}
