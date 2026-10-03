# Panduan Setup Google Drive Bridge Cabang
**Sistem Data Ketidakhadiran Peserta Training Indomaret**

---

## Mengapa Memakai "Drive Bridge"?
Google Service Account (akun robot) **tidak memiliki kuota penyimpanan** pada akun Google Drive pribadi biasa (*"Service Accounts do not have storage quota"*). 

Oleh karena itu, sistem menggunakan **Google Apps Script Drive Bridge** yang berjalan langsung di akun Google Drive cabang Anda. Berkas bukti berita acara akan tersimpan rapi dan aman di Google Drive cabang sendiri, menggunakan kuota penyimpanan Google Drive cabang yang bersangkutan.

---

## Langkah 1: Siapkan Folder di Google Drive Cabang
1. Masuk ke akun Google Drive cabang Anda: [https://drive.google.com](https://drive.google.com).
2. Buat folder baru khusus untuk berkas bukti, misalnya beri nama:
   `BUKTI_KETIDAKHADIRAN_TRAINING_[KODE_CABANG]` (contoh: `BUKTI_KETIDAKHADIRAN_TRAINING_SBY`).
3. Buka folder tersebut, lalu perhatikan tautan (URL) di address bar browser Anda:
   ```
   https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9iJ0kLmNoPqRsTuVw
   ```
4. Salin kode setelah `/folders/` (pada contoh di atas: `1a2B3c4D5e6F7g8H9iJ0kLmNoPqRsTuVw`). Ini adalah **ID Folder Google Drive** Anda. Simpan di catatan sementara.

---

## Langkah 2: Buat Proyek Google Apps Script
1. Buka [https://script.google.com](https://script.google.com) menggunakan akun Google cabang yang sama.
2. Klik tombol **+ Proyek Baru** (*New Project*) di kiri atas.
3. Beri nama proyek di bagian kiri atas, misalnya: `Drive Bridge Training Surabaya`.

---

## Langkah 3: Tempelkan Kode Script
1. Pada editor kode file `Code.gs`, hapus kode bawaan `function myFunction() { ... }`.
2. Salin seluruh isi file `drive-bridge/Code.gs` dari sistem ini, lalu tempelkan ke editor.
3. Ubah 2 baris konfigurasi di bagian paling atas:
   ```javascript
   // Ganti dengan ID Folder yang Anda salin pada Langkah 1
   var ROOT_FOLDER_ID = '1a2B3c4D5e6F7g8H9iJ0kLmNoPqRsTuVw';

   // Buat kata sandi rahasia cabang (kombinasi huruf & angka bebas, misal: CabangSbyAman2026!)
   var SHARED_SECRET = 'CabangSbyAman2026!';
   ```
4. Klik ikon **Simpan** (ikon disket) atau tekan `Ctrl + S`.

---

## Langkah 4: Terapkan Sebagai Web App (Deploy)
1. Di pojok kanan atas, klik tombol biru **Deploy** > pilih **Penerapan baru** (*New deployment*).
2. Klik ikon gerigi (Pilih jenis penerapan) di samping kiri > pilih **Aplikasi web** (*Web app*).
3. Isi kolom pengaturan dengan ketentuan berikut (**SANGAT PENTING**):
   - **Deskripsi**: `Drive Bridge v1`
   - **Jalankan sebagai** (*Execute as*): **Saya (email cabang Anda)**
   - **Siapa yang memiliki akses** (*Who has access*): **Siapa saja** (*Anyone*)
4. Klik tombol **Terapkan** (*Deploy*).

---

## Langkah 5: Berikan Izin Akses Google (*Authorization*)
1. Jika muncul jendela pop-up **Otorisasi diperlukan** (*Authorization required*), klik **Tinjau izin** (*Review permissions*).
2. Pilih akun Google cabang Anda.
3. Jika muncul peringatan *"Google belum memverifikasi aplikasi ini"*:
   - Klik tulisan kecil **Lanjutan** (*Advanced*) di kiri bawah.
   - Klik **Buka Drive Bridge Training (tidak aman)** (*Go to Drive Bridge (unsafe)*).
4. Klik tombol **Izinkan** (*Allow*).
5. Google Apps Script akan menampilkan **URL Aplikasi Web** (*Web App URL*), dengan format:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
6. Klik **Salin** (*Copy*) pada URL Aplikasi Web tersebut.

---

## Langkah 6: Hubungkan ke Aplikasi Web
1. Masuk ke aplikasi web **Sistem Data Ketidakhadiran Peserta Training** sebagai **Admin Pusat**.
2. Buka menu **Admin > Cabang** pada bilah navigasi.
3. Klik tombol **Edit** (ikon pensil) pada baris cabang yang bersangkutan (atau klik **Tambah Cabang Baru**).
4. Masukkan konfigurasi yang telah dibuat:
   - **URL Drive Bridge**: Tempelkan URL Web App dari Langkah 5.
   - **Secret Drive Bridge**: Masukkan kata sandi rahasia yang sama persis dengan `SHARED_SECRET` di Langkah 3.
5. Klik tombol **Tes Koneksi**:
   - Jika berhasil, akan muncul notifikasi hijau: *"Koneksi Berhasil! Folder 'BUKTI_KETIDAKHADIRAN_...' dapat diakses."*
6. Klik tombol **Simpan Cabang**.
7. Lencana status cabang kini akan berubah menjadi hijau: **Drive Terhubung**.

---

## Keamanan Data & Batasan Folder
- **Privasi Terjaga**: Aplikasi web hanya dapat mengunggah dan membaca file di dalam `ROOT_FOLDER_ID` yang telah ditentukan. File di folder lain pada Google Drive cabang Anda **tidak dapat diakses** oleh skrip.
- **Terenkripsi AES-256-GCM**: Kata sandi rahasia (`SHARED_SECRET`) disimpan dalam database Supabase menggunakan enkripsi standar militer AES-256-GCM dan tidak pernah ditampilkan kembali di antarmuka web.
- **Kapasitas**: Bukti berkas foto/PDF otomatis dikompresi di peramban pengguna sebelum diunggah, sehingga sangat hemat kuota Google Drive cabang.
