// app/(app)/input-tambahan/page.js
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserPlus,
  Save,
  Loader2,
  RefreshCw,
  Search,
  TableProperties,
  Edit2,
  Trash2,
  Trash,
  UploadCloud,
  Download,
  Building2,
  Image as ImageIcon,
  FileCheck,
  X,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { MASTER_TRAININGS_LIST } from '../../../lib/trainings-master.js';
import { compressImage, formatBytes } from '../../../lib/compress.js';
import { validateImageFile } from '../../../lib/image-validator.js';
import FileValidationModal from '../../../components/FileValidationModal.js';
import EditDataTambahanModal from '../../../components/EditDataTambahanModal.js';
import ImportExportModal from '../../../components/ImportExportModal.js';
import ConfirmDialog from '../../../components/ConfirmDialog.js';
import SqlEditorModal from '../../../components/SqlEditorModal.js';
import ProofImageDisplay from '../../../components/ProofImageDisplay.js';
import { Database } from 'lucide-react';

export default function InputTambahanPage() {
  const fileInputRef = useRef(null);

  const [training, setTraining] = useState('YFC');
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [kdToko, setKdToko] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [alasanTidakHadir, setAlasanTidakHadir] = useState('Sakit');

  // Foto State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileStats, setFileStats] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [saving, setSaving] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [meta, setMeta] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Modals
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingPhotoRecord, setViewingPhotoRecord] = useState(null);
  const [deleteSingleDialog, setDeleteSingleDialog] = useState({
    isOpen: false,
    record: null,
    loading: false,
  });
  const [deleteAllDialog, setDeleteAllDialog] = useState({
    isOpen: false,
    loading: false,
  });

  // Ambil user info & meta
  useEffect(() => {
    async function loadMetaAndUser() {
      try {
        const [metaRes, userRes] = await Promise.all([
          fetch('/api/meta'),
          fetch('/api/auth/me'),
        ]);
        const metaJson = await metaRes.json();
        const userJson = await userRes.json();
        if (metaJson.ok) setMeta(metaJson.data);
        if (userJson.ok) setCurrentUser(userJson.data);
      } catch (err) {
        console.error('Failed to load user/meta:', err);
      }
    }
    loadMetaAndUser();
  }, []);

  // Ambil data tambahan cabang yang sedang login
  const fetchRecords = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/data-tambahan');
      const json = await res.json();
      if (json.ok) {
        setRecords(json.data || []);
      } else {
        toast.error(json.error || 'Gagal memuat data');
      }
    } catch (err) {
      console.error('Failed to fetch data tambahan:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  async function handleFileSelect(file) {
    if (!file) return;

    const validation = await validateImageFile(file);
    if (!validation.valid) {
      setValidationErrors([validation.message]);
      setShowValidationModal(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setCompressing(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const res = await compressImage(file, { maxSide: 1600, forceCompress: true });
      setSelectedFile(res.file);
      setFileStats({
        originalSize: res.originalSize,
        compressedSize: res.compressedSize,
        sizeSummary: res.sizeSummary,
      });
      setPreviewUrl(URL.createObjectURL(res.blob));
      toast.success(`Foto berhasil dikompresi (${res.sizeSummary})`);
    } catch (err) {
      console.error('[Compression Error]:', err);
      toast.error(err.message || 'Gagal memproses gambar');
      removeSelectedPhoto();
    } finally {
      setCompressing(false);
    }
  }

  function removeSelectedPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e, skipPhoto = false) {
    if (e?.preventDefault) e.preventDefault();
    if (!nik.trim() || !nama.trim()) {
      toast.error('NIK dan Nama Peserta wajib diisi');
      return;
    }

    setSaving(true);
    const hasPhoto = selectedFile && !skipPhoto;
    setSubmitProgress(hasPhoto ? 'Mengunggah foto...' : 'Menyimpan data...');
    const toastId = toast.loading(hasPhoto ? 'Mengunggah foto ke Google Drive cabang...' : 'Menyimpan data ke database cabang...');

    try {
      let res;
      if (hasPhoto) {
        const formData = new FormData();
        formData.append('training', training.trim());
        formData.append('nik', nik.trim());
        formData.append('nama', nama.trim());
        formData.append('kd_toko', kdToko.trim());
        formData.append('nama_toko', namaToko.trim());
        formData.append('alasan_tidak_hadir', alasanTidakHadir.trim());
        formData.append('foto', selectedFile);

        setSubmitProgress('Mengunggah foto...');
        res = await fetch('/api/data-tambahan', {
          method: 'POST',
          body: formData,
        });
        setSubmitProgress('Menyimpan data...');
      } else {
        res = await fetch('/api/data-tambahan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            training: training.trim(),
            nik: nik.trim(),
            nama: nama.trim(),
            kd_toko: kdToko.trim(),
            nama_toko: namaToko.trim(),
            alasan_tidak_hadir: alasanTidakHadir.trim(),
          }),
        });
      }

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(
          'Data berhasil disimpan di database cabang dan otomatis masuk ke Lembar Cetak Bukti PDF!',
          { id: toastId }
        );
        // Reset form input
        setNik('');
        setNama('');
        setKdToko('');
        setNamaToko('');
        removeSelectedPhoto();
        fetchRecords();
      } else {
        if (json.canSaveWithoutPhoto) {
          toast.error(
            'Google Drive cabang belum terhubung, hubungi Admin Pusat.',
            {
              id: toastId,
              duration: 8000,
              action: {
                label: 'Simpan Tanpa Foto',
                onClick: () => handleSubmit(null, true),
              },
            }
          );
        } else {
          toast.error(json.error || 'Gagal menyimpan data', { id: toastId });
        }
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan: ' + err.message, { id: toastId });
    } finally {
      setSaving(false);
      setSubmitProgress(null);
    }
  }

  // Hapus single data
  async function confirmDeleteSingle() {
    if (!deleteSingleDialog.record) return;
    setDeleteSingleDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/data-tambahan/${deleteSingleDialog.record.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Data berhasil dihapus');
        setDeleteSingleDialog({ isOpen: false, record: null, loading: false });
        fetchRecords();
      } else {
        toast.error(json.error || 'Gagal menghapus data');
        setDeleteSingleDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      toast.error('Terjadi kesalahan: ' + err.message);
      setDeleteSingleDialog((prev) => ({ ...prev, loading: false }));
    }
  }

  // Hapus SEMUA data
  async function confirmDeleteAll() {
    setDeleteAllDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch('/api/data-tambahan', {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Semua data tambahan di cabang Anda berhasil dibersihkan');
        setDeleteAllDialog({ isOpen: false, loading: false });
        fetchRecords();
      } else {
        toast.error(json.error || 'Gagal menghapus semua data');
        setDeleteAllDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      toast.error('Terjadi kesalahan: ' + err.message);
      setDeleteAllDialog((prev) => ({ ...prev, loading: false }));
    }
  }

  // Filter pencarian di tabel
  const filteredRecords = records.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.nik && String(r.nik).toLowerCase().includes(term)) ||
      (r.nama && String(r.nama).toLowerCase().includes(term)) ||
      (r.training && String(r.training).toLowerCase().includes(term)) ||
      (r.nama_toko && String(r.nama_toko).toLowerCase().includes(term)) ||
      (r.alasan_tidak_hadir && String(r.alasan_tidak_hadir).toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <FileValidationModal 
        isOpen={showValidationModal} 
        onClose={() => {setShowValidationModal(false); setValidationErrors([]);}} 
        errors={validationErrors} 
      />
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-[#0056b3] rounded-xl">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-gray-900 font-title">
                  Input Data Tambahan
                </h1>
                {currentUser?.branch_name && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-[#0056b3]">
                    <Building2 className="w-3 h-3" />
                    <span>{currentUser.branch_name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Pencatatan data peserta tambahan khusus cabang Anda. Data tersimpan aman di database cabang dan otomatis terintegrasi ke menu Cetak Bukti PDF.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-300 shadow-xs"
              title="Lihat skrip SQL Supabase"
            >
              <Database className="w-4 h-4 text-[#0056b3]" />
              <span>Skrip SQL Supabase</span>
            </button>

            <button
              type="button"
              onClick={() => setShowImportExportModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-[#0056b3] rounded-xl text-xs font-bold transition-all border border-blue-200 shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Impor / Ekspor Excel/CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Form Input Data Tambahan */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {/* Tricolor Bar */}
        <div className="indomaret-bar">
          <div className="indomaret-bar-blue" />
          <div className="indomaret-bar-yellow" />
          <div className="indomaret-bar-red" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            {/* 1. Jenis Training */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Jenis Training <span className="text-red-500">*</span>
              </label>
              <select
                value={training}
                onChange={(e) => setTraining(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              >
                {MASTER_TRAININGS_LIST.map((tName) => (
                  <option key={tName} value={tName}>
                    {tName}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. NIK */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                NIK Peserta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="Contoh: 2015698709"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-mono font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>

            {/* 3. Nama Peserta */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Nama Lengkap Peserta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: AHMAD FAUZI"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>

            {/* 4. KD Toko */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Kode Toko
              </label>
              <input
                type="text"
                value={kdToko}
                onChange={(e) => setKdToko(e.target.value)}
                placeholder="Contoh: TVYI, TSSD..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-mono font-medium uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>

            {/* 5. Nama Toko */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Nama Toko
              </label>
              <input
                type="text"
                value={namaToko}
                onChange={(e) => setNamaToko(e.target.value)}
                placeholder="Contoh: INDOMARET RAYA DARMO"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>

            {/* 6. Alasan Tidak Hadir */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Alasan Tidak Hadir <span className="text-red-500">*</span>
              </label>
              <select
                value={alasanTidakHadir}
                onChange={(e) => setAlasanTidakHadir(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              >
                {meta?.reasons ? (
                  meta.reasons.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Sakit">Sakit</option>
                    <option value="Cuti">Cuti</option>
                    <option value="Mangkir">Mangkir</option>
                    <option value="Bencana alam">Bencana alam</option>
                    <option value="Musibah/kecelakaan">Musibah/kecelakaan</option>
                    <option value="Menggantikan personil lain">Menggantikan personil lain</option>
                    <option value="Keluarga inti sakit">Keluarga inti sakit</option>
                    <option value="Lain - lain">Lain - lain</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Bukti Foto (Opsional) */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-gray-700 uppercase tracking-wider">
                Bukti Foto <span className="font-normal text-gray-500 text-[11px]">(Opsional &bull; Disarankan melampirkan bukti foto)</span>
              </label>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files?.[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => {
                if (!selectedFile && !compressing) fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                isDragOver
                  ? 'border-[#0056b3] bg-blue-50/50'
                  : selectedFile
                  ? 'border-teal-300 bg-teal-50/30'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50/50 cursor-pointer'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
              />

              {compressing ? (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-[#0056b3]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs font-bold">Mengompresi foto & menyesuaikan orientasi EXIF...</p>
                  <p className="text-[11px] text-gray-500">Maks. sisi 1600px &bull; JPEG kualitas 0.7</p>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Pratinjau"
                        className="w-14 h-14 object-cover rounded-xl border border-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                        <FileCheck className="w-7 h-7" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        {selectedFile.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-100 text-teal-800">
                          {fileStats?.sizeSummary || formatBytes(selectedFile.size)}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          &bull; Siap diunggah ke Google Drive cabang
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSelectedPhoto();
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="Hapus berkas terpilih"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-700">
                    Tarik dan lepas bukti foto di sini, atau <span className="text-[#0056b3]">pilih file (JPG, PNG, WEBP)</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Maksimal 5 MB. Foto otomatis dikompres di browser sebelum diunggah ke Google Drive cabang.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[11px] text-gray-500 italic">
              * Data yang Anda input langsung tersimpan aman di database cabang Anda.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 min-h-[42px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{submitProgress || 'Menyimpan...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Data Tambahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Data Tambahan Terkini */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TableProperties className="w-5 h-5 text-gray-600" />
            <h2 className="text-base font-bold text-gray-900 font-title">
              Daftar Data Tambahan Tersimpan ({filteredRecords.length} Data)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari NIK, Nama, Toko..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={fetchRecords}
              disabled={loadingList}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
              title="Perbarui daftar data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>

            {/* Tombol Hapus Semua Data */}
            {records.length > 0 && (
              <button
                type="button"
                onClick={() => setDeleteAllDialog({ isOpen: true, loading: false })}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold border border-red-200 transition-colors"
                title="Hapus seluruh data tambahan cabang ini"
              >
                <Trash className="w-3.5 h-3.5" />
                <span>Hapus Semua</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                <th className="p-3 text-center w-12">NO</th>
                <th className="p-3 w-28">TRAINING</th>
                <th className="p-3 text-center w-28">NIK</th>
                <th className="p-3">NAMA</th>
                <th className="p-3 text-center w-24">KD TOKO</th>
                <th className="p-3 w-36">NAMA TOKO</th>
                <th className="p-3 w-40">ALASAN TIDAK HADIR</th>
                <th className="p-3 text-center w-28">FOTO</th>
                <th className="p-3 text-center w-24">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 text-center font-bold text-gray-500">{r.no || i + 1}</td>
                    <td className="p-3 font-semibold text-blue-700 uppercase">{r.training}</td>
                    <td className="p-3 text-center font-mono font-bold text-gray-800">{r.nik}</td>
                    <td className="p-3 font-semibold text-gray-900 uppercase">{r.nama}</td>
                    <td className="p-3 text-center font-mono uppercase text-gray-600">{r.kd_toko || '-'}</td>
                    <td className="p-3 uppercase text-gray-700">{r.nama_toko || '-'}</td>
                    <td className="p-3 text-gray-700">{r.alasan_tidak_hadir || '-'}</td>
                    <td className="p-3 text-center">
                      {r.foto_drive_file_id ? (
                        <button
                          type="button"
                          onClick={() => setViewingPhotoRecord(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0056b3] rounded-lg text-[11px] font-bold border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Lihat Foto</span>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[11px] italic">Tanpa foto</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Tombol Edit */}
                        <button
                          type="button"
                          onClick={() => setEditingRecord(r)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit baris data ini"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {/* Tombol Hapus */}
                        <button
                          type="button"
                          onClick={() => setDeleteSingleDialog({ isOpen: true, record: r, loading: false })}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus baris data ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                    {loadingList ? 'Memuat data...' : 'Belum ada data tambahan yang tercatat di cabang Anda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Pratinjau Foto */}
      {viewingPhotoRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-title">
                  Pratinjau Bukti Foto - {viewingPhotoRecord.nama}
                </h3>
                <p className="text-xs text-gray-500 font-mono">NIK: {viewingPhotoRecord.nik} &bull; {viewingPhotoRecord.training}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPhotoRecord(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full h-80 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden relative">
              <ProofImageDisplay
                record={{ id: viewingPhotoRecord.id, drive_file_id: viewingPhotoRecord.foto_drive_file_id }}
                alt={`Bukti ${viewingPhotoRecord.nama}`}
                maxHeight="300px"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setViewingPhotoRecord(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Data Tambahan */}
      <EditDataTambahanModal
        isOpen={Boolean(editingRecord)}
        record={editingRecord}
        meta={meta}
        title="Edit Data Tambahan"
        updateEndpoint={editingRecord ? `/api/data-tambahan/${editingRecord.id}` : null}
        onClose={() => setEditingRecord(null)}
        onUpdated={fetchRecords}
      />

      {/* Modal Impor / Ekspor Excel / CSV */}
      <ImportExportModal
        isOpen={showImportExportModal}
        onClose={() => setShowImportExportModal(false)}
        title="Impor / Ekspor Data Tambahan"
        targetName="Data Tambahan"
        importEndpoint="/api/data-tambahan/import"
        exportEndpoint="/api/data-tambahan/export"
        currentRecords={records}
        onSuccess={fetchRecords}
      />

      {/* Dialog Konfirmasi Hapus 1 Baris */}
      <ConfirmDialog
        isOpen={deleteSingleDialog.isOpen}
        title="Hapus Data Tambahan"
        message={`Apakah Anda yakin ingin menghapus data peserta "${deleteSingleDialog.record?.nama}" (NIK: ${deleteSingleDialog.record?.nik}) beserta fotonya di Google Drive?`}
        confirmText="Hapus Data"
        cancelText="Batal"
        isDanger={true}
        isLoading={deleteSingleDialog.loading}
        onConfirm={confirmDeleteSingle}
        onCancel={() => setDeleteSingleDialog({ isOpen: false, record: null, loading: false })}
      />

      {/* Dialog Konfirmasi Hapus SEMUA Baris */}
      <ConfirmDialog
        isOpen={deleteAllDialog.isOpen}
        title="Hapus Semua Data Tambahan"
        message={`PERINGATAN: Tindakan ini akan menghapus seluruh (${records.length}) data tambahan cabang Anda beserta seluruh foto terkait di Google Drive (dipindah ke Sampah). Apakah Anda yakin?`}
        confirmText="Hapus Semua Data"
        cancelText="Batal"
        isDanger={true}
        isLoading={deleteAllDialog.loading}
        onConfirm={confirmDeleteAll}
        onCancel={() => setDeleteAllDialog({ isOpen: false, loading: false })}
      />

      {/* Modal Skrip SQL Supabase */}
      <SqlEditorModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
      />
    </div>
  );
}
