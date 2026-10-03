# Google Apps Script Drive Bridge (Akun Google Drive Cabang)
**Sistem Data Ketidakhadiran Peserta Training Indomaret**  
Pengembang: **Bang Ajiib (2026)**

---

## 📁 Berkas di Folder Ini
- **`Code.gs`**: Skrip Google Apps Script lengkap yang disalin dan ditempelkan ke proyek Apps Script cabang di [https://script.google.com](https://script.google.com).

---

## ⚡ Langkah Cepat Pemasangan:
1. **Buat Folder di Google Drive Cabang**:
   - Beri nama folder misalnya: `BUKTI_TRAINING_SBY`.
   - Buka folder dan salin ID Folder dari address bar browser (kode setelah `/folders/...`).
2. **Buka Google Apps Script**:
   - Kunjungi [https://script.google.com](https://script.google.com) dengan akun Google cabang.
   - Klik **New Project** (+ Proyek Baru).
3. **Salin Kode `Code.gs`**:
   - Salin seluruh isi berkas `Code.gs`.
   - Tempel ke editor kode Apps Script.
   - Ubah `ROOT_FOLDER_ID` dengan ID Folder dari langkah 1.
   - Ubah `SHARED_SECRET` dengan kata sandi rahasia cabang (misal: `SbyAman2026!`).
4. **Deploy Sebagai Web App**:
   - Klik **Deploy** > **New Deployment**.
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
