# Sistem Data Ketidakhadiran Peserta Training

> Sistem informasi pengelolaan dan pencatatan ketidakhadiran peserta training karyawan berbasis web untuk jaringan cabang nasional, terintegrasi dengan database Supabase dan penyimpanan dokumen Google Drive terdistribusi per cabang.

---

## 📌 Pembuat / Hak Cipta

- **Pengembang / Pemilik:** Bang Ajiib
- **Tahun Pembuatan:** 2026
- **Status Lisensi:** Hak Cipta Dilindungi (All Rights Reserved)
- **Pemberitahuan:** Seluruh hak cipta atas perangkat lunak ini, termasuk kode sumber, desain antarmuka, arsitektur data, dan dokumentasinya dilindungi undang-undang. Dilarang menyalin, mendistribusikan, memodifikasi, atau mengklaim kepemilikan atas aplikasi ini sebagian maupun seluruhnya tanpa izin tertulis dari **Bang Ajiib**.

---

## 🚀 Fitur Utama

1. **Multi-Role & Akses Cabang Mandiri:**
   - **Admin Pusat (Head Office):** Akses komprehensif ke semua cabang di seluruh Indonesia, pengelolaan master data (cabang, pengguna, jenis training, alasan ketidakhadiran), serta tinjauan rekapitulasi nasional.
   - **Admin Cabang:** Akses tersegmentasi aman khusus data cabang masing-masing, pencatatan ketidakhadiran harian, impor/ekspor data cabang, dan pencetakan dokumen resmi.

2. **Penyimpanan Berkas Google Drive Terdistribusi:**
   - Setiap cabang memiliki Google Drive mandiri yang dihubungkan melalui Google Apps Script Web App Bridge.
   - Unggah bukti foto (JPEG/PNG) terkompresi otomatis di browser sebelum dikirim.
   - Dukungan pratinjau langsung untuk file gambar dan PDF secara aman.

3. **Impor & Ekspor Data:**
   - Unduh template Excel/CSV dinamis dengan sheet *Petunjuk* berisi master data aktif terkini.
   - Validasi ketat format NIK, jenis training, alasan ketidakhadiran, tanggal pelaksanaan, dan duplikasi data.
   - Ekspor data hasil filter ke Excel (.xlsx) dan CSV.

4. **Format Cetak PDF Ganda (A4 Landscape):**
   - **Format 1 (Grid Vertikal):** Berita Acara resmi dengan kop surat standar, tabel data, dan kolom tanda tangan basah Trainer & Branch Training Manager.
   - **Format 2 (Grid Horizontal 4 Kolom):** Lampiran bukti tidak hadir dengan tata letak grid 8 kolom (4 peserta per baris) lengkap dengan foto bukti asli, pengelompokan per jenis training, dan pelacak status pemuatan gambar.

5. **Keamanan Sistem & Audit Trail:**
   - Autentikasi sesi berbasis JWT *httpOnly* cookie dengan verifikasi kedaluwarsa.
   - Hashing password menggunakan *bcrypt*.
   - Proteksi brute force login lockout (5 kali percobaan gagal mengunci akun 15 menit).
   - Wajib ganti password pada login pertama kali.
   - Catatan riwayat aktivitas (*Audit Log*) untuk seluruh operasi data krusial.

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

- **Framework:** Next.js 14 (App Router)
- **Bahasa:** JavaScript (ES Module, Node.js runtime)
- **Styling:** Tailwind CSS
- **Ikon:** Lucide React
- **Basis Data:** Supabase (PostgreSQL)
- **Penyimpanan Berkas:** Google Drive API via Google Apps Script Web App Bridge
- **Pemrosesan Excel:** ExcelJS & PapaParse

---

## 📄 Hak Cipta & Lisensi

Copyright (c) 2026 Bang Ajiib. Seluruh hak cipta dilindungi.
Lihat file [LICENSE](./LICENSE) untuk informasi lebih lanjut.
