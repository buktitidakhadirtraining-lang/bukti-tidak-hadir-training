# Google Apps Script Drive Bridge (Akun Google Drive Cabang)
**Sistem Data Ketidakhadiran Peserta Training Indomaret**  
Versi: **2.1.0 (Fitur Anti-Duplikasi & Pembersihan File Ganda)**

---

## 📁 Berkas di Folder Ini
- **`Code.gs`**: Skrip Google Apps Script lengkap yang disalin dan ditempelkan ke proyek Apps Script cabang di [https://script.google.com](https://script.google.com).

---

## 🚀 Fitur Baru pada Versi 2.1.0:
1. **Safe Replace Workflow**: Alur penggantian file yang aman (Upload berkas baru -> Simpan ke Database -> Pindahkan berkas lama ke Sampah Drive). Jika simpan DB gagal, berkas baru di-rollback sehingga tidak meninggalkan berkas yatim.
2. **Pencegahan Duplikat Sejak Awal**: Saat mengunggah foto baru untuk NIK yang sama, skrip mendeteksi dan membersihkan file duplikat lama untuk NIK tersebut di folder cabang.
3. **Pembersihan Otomatis (Maintenance Clean Duplicates)**: Endpoint pembersihan yang memindai folder cabang, mengelompokkan berkas per NIK, mempertahankan 1 berkas yang paling baru (*most recent* berdasarkan waktu modifikasi), dan memindahkan sisanya ke tempat sampah.
4. **Pencarian Cepat Berdasarkan NIK**: Aksi `findFilesByNik` untuk menemukan semua riwayat berkas bukti peserta tertentu.

---

## ⚡ Langkah Cepat Pemasangan / Pembaruan:
1. **Buat / Gunakan Folder di Google Drive Cabang**:
   - Beri nama folder misalnya: `BUKTI_TRAINING_SBY`.
   - Buka folder dan salin ID Folder dari address bar browser (kode setelah `/folders/...`).
2. **Buka Google Apps Script**:
   - Kunjungi [https://script.google.com](https://script.google.com) dengan akun Google cabang.
   - Buka proyek yang sudah ada atau klik **New Project** (+ Proyek Baru).
3. **Salin Kode `Code.gs`**:
   - Salin seluruh isi berkas `Code.gs` terbaru.
   - Tempel ke editor kode Apps Script.
   - Ubah `ROOT_FOLDER_ID` dengan ID Folder dari langkah 1.
   - Ubah `SHARED_SECRET` dengan kata sandi rahasia cabang (misal: `SbyAman2026!`).
4. **Deploy Sebagai Web App**:
   - Klik **Deploy** > **New Deployment** (atau **Manage Deployments** > Edit > Version: New).
   - Pilih jenis **Web app**.
   - **Execute as**: *Me (email akun cabang)*.
   - **Who has access**: *Anyone (Siapa saja)*.
   - Klik **Deploy** dan berikan izin (*Authorize*).
5. **Salin URL Web App**:
   - Salin URL Web App (format: `https://script.google.com/macros/s/.../exec`).
6. **Hubungkan di Menu Master Cabang**:
   - Buka aplikasi web > menu **Master Cabang** (sebagai Admin Pusat).
   - Masukkan Kode Cabang, Nama Cabang, URL Web App, dan Secret Key.
   - Klik **Tes Koneksi** > **Simpan Cabang**.
