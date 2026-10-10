// app/(app)/input/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  UploadCloud,
  FileCheck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  GraduationCap,
  HelpCircle,
  Briefcase,
  User,
  Hash,
  AlertTriangle,
} from 'lucide-react';
import { MAX_FILE_SIZE_BYTES, POSITIONS } from '../../../lib/config.js';
import { compressImage, formatBytes } from '../../../lib/compress.js';
import { validateImageFile } from '../../../lib/image-validator.js';
import FileValidationModal from '../../../components/FileValidationModal.js';

export default function InputPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [meta, setMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Form State
  const [nik, setNik] = useState('');
  const [namaPeserta, setNamaPeserta] = useState('');
  const [jabatan, setJabatan] = useState(POSITIONS[0] || 'Chief Of Store');
  const [branchId, setBranchId] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [batch, setBatch] = useState('1');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [alasanId, setAlasanId] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileStats, setFileStats] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/meta');
        const json = await res.json();
        if (json.ok) {
          setMeta(json.data);
          if (json.data.userRole !== 'admin_pusat' && json.data.userBranchId) {
            setBranchId(json.data.userBranchId);
          } else if (json.data.branches?.length > 0) {
            setBranchId(json.data.branches[0].id);
          }
          if (json.data.positions?.length > 0) {
            setJabatan(json.data.positions[0]);
          }
          if (json.data.trainings?.length > 0) {
            setTrainingId(json.data.trainings[0].id);
          }
          if (json.data.reasons?.length > 0) {
            setAlasanId(json.data.reasons[0].id);
          }
        }
      } catch (err) {
        toast.error('Gagal memuat metadata form');
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, []);

  // Handle file selection & automatic compression
  async function handleFileChange(file) {
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
      const res = await compressImage(file);
      setSelectedFile(res.file);
      setFileStats({
        originalSize: res.originalSize,
        compressedSize: res.compressedSize,
        sizeSummary: res.sizeSummary,
        isPdf: false,
      });
      setPreviewUrl(URL.createObjectURL(res.blob));
      toast.success(`Foto berhasil dikompresi (${res.sizeSummary})`);
    } catch (err) {
      console.error('[Compression Error]:', err);
      toast.error('Gagal mengompresi foto: ' + err.message);
      removeSelectedFile();
    } finally {
      setCompressing(false);
    }
  }

  function removeSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <FileValidationModal 
        isOpen={showValidationModal} 
        onClose={() => {setShowValidationModal(false); setValidationErrors([]);}} 
        errors={validationErrors} 
      />
      {/* Header */}
      {/* ... rest of the page ... */}
    </div>
  );

  async function handleSubmit(e) {
    e.preventDefault();

    const selectedBranch = meta?.branches?.find((b) => b.id === branchId);
    if (selectedBranch && !selectedBranch.driveReady) {
      toast.error(
        `Input data diblokir: Google Drive cabang "${selectedBranch.name}" belum terhubung. Hubungi Admin untuk setup Drive Bridge.`
      );
      return;
    }

    if (!/^\d{8,16}$/.test(nik)) {
      toast.error('NIK harus berupa 8 sampai 16 digit angka');
      return;
    }

    if (!namaPeserta.trim()) {
      toast.error('Nama peserta wajib diisi');
      return;
    }

    // Bukti wajib: file bukti (evidence_file) WAJIB untuk input manual
    if (!selectedFile) {
      toast.error('File bukti Berita Acara wajib diunggah.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('nik', nik.trim());
      formData.append('nama_peserta', namaPeserta.trim());
      formData.append('jabatan', jabatan);
      formData.append('branch_id', branchId);
      formData.append('training_id', trainingId);
      formData.append('batch', batch);
      formData.append('tanggal_pelaksanaan', tanggal);
      formData.append('alasan_id', alasanId);
      if (keterangan.trim()) {
        formData.append('keterangan', keterangan.trim());
      }
      // Pastikan file yang dikirim ke server adalah hasil kompresi (selectedFile)
      formData.append('evidence_file', selectedFile);

      const res = await fetch('/api/records', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'Gagal menyimpan data');
        return;
      }

      toast.success('Data ketidakhadiran berhasil disimpan ke sistem');

      // Reset form
      setNik('');
      setNamaPeserta('');
      setKeterangan('');
      removeSelectedFile();
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan saat mengirim data');
    } finally {
      setSubmitting(false);
    }
  }

  const isAdminPusat = meta?.userRole === 'admin_pusat';
  const selectedBranch = meta?.branches?.find((b) => b.id === branchId);
  const isDriveReady = selectedBranch ? Boolean(selectedBranch.driveReady) : true;

  if (loadingMeta) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#0056b3]" />
        <p className="text-xs text-gray-500 mt-2">Memuat formulir...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <FileValidationModal 
        isOpen={showValidationModal} 
        onClose={() => {setShowValidationModal(false); setValidationErrors([]);}} 
        errors={validationErrors} 
      />
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-title tracking-tight">
            Input Data Ketidakhadiran
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Catat ketidakhadiran peserta dan unggah berkas bukti berita acara langsung ke Google Drive cabang.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {/* Indomaret Bar */}
        <div className="indomaret-bar">
          <div className="indomaret-bar-blue" />
          <div className="indomaret-bar-yellow" />
          <div className="indomaret-bar-red" />
        </div>

        <div className="p-5 sm:p-8 space-y-6">
          {/* Section: Identitas Peserta */}
          <div>
            <h3 className="text-xs font-bold text-[#0056b3] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <User className="w-4 h-4" />
              1. Identitas Peserta Training
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* NIK */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  NIK Peserta <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={nik}
                    onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 2024100123 (8-16 digit)"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
                  />
                </div>
                {nik && !/^\d{8,16}$/.test(nik) && (
                  <p className="text-[11px] text-red-500 mt-1">NIK harus berupa 8-16 angka</p>
                )}
              </div>

              {/* Nama Peserta */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nama Lengkap Peserta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={namaPeserta}
                  onChange={(e) => setNamaPeserta(e.target.value)}
                  placeholder="Nama sesuai KTP/identitas"
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
                />
              </div>

              {/* Jabatan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Jabatan / Posisi <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <select
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
                  >
                    {(meta?.positions?.length ? meta.positions : POSITIONS).map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cabang */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Cabang Pelaksana <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  {isAdminPusat ? (
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
                    >
                      {meta?.branches?.filter((b) => b.is_active !== false)?.length === 0 ? (
                        <option value="">Belum ada cabang terdaftar (Tambahkan di Master Cabang)</option>
                      ) : (
                        meta?.branches?.filter((b) => b.is_active !== false)?.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} - {b.name} {!b.driveReady ? '⚠️ [Drive Belum Terhubung]' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={selectedBranch?.name || 'Cabang Saya'}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-100 border border-gray-200 rounded-xl text-gray-600 font-semibold cursor-not-allowed min-h-[44px]"
                    />
                  )}
                </div>
                {!isDriveReady && (
                  <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Google Drive cabang ini belum terhubung.</span>
                      <p className="mt-0.5 text-amber-700">
                        Input data untuk cabang <strong>{selectedBranch?.name}</strong> diblokir hingga konfigurasi Drive Bridge diselesaikan di menu Admin &gt; Cabang.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Rincian Training */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold text-[#0056b3] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              2. Jadwal & Pelaksanaan Training
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Jenis Training */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Jenis Training <span className="text-red-500">*</span>
                </label>
                <select
                  value={trainingId}
                  onChange={(e) => setTrainingId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
                >
                  {meta?.trainings?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Batch Ke- <span className="text-red-500">*</span>
                </label>
                <select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
                >
                  {meta?.batches?.map((b) => (
                    <option key={b} value={b}>
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal Pelaksanaan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tanggal Pelaksanaan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
                  />
                </div>
              </div>

              {/* Alasan Ketidakhadiran */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Alasan Tidak Hadir <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <select
                    value={alasanId}
                    onChange={(e) => setAlasanId(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
                  >
                    {meta?.reasons?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Keterangan */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Tambahkan catatan khusus, nomor surat dokter, atau informasi lainnya..."
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3]"
                />
              </div>
            </div>
          </div>

          {/* Section: Upload Bukti Berita Acara */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[#0056b3] uppercase tracking-wider flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4" />
                3. Bukti Berita Acara (Google Drive) <span className="text-red-500">*</span>
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Wajib diunggah • Hanya JPG, JPEG, PNG • Foto dikompres otomatis
              </p>
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
                  handleFileChange(e.dataTransfer.files[0]);
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
                    handleFileChange(e.target.files[0]);
                  }
                }}
                accept="image/jpeg,image/png"
                className="hidden"
              />

              {compressing ? (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-[#0056b3]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs font-bold">Mengompresi foto & menyesuaikan orientasi EXIF...</p>
                  <p className="text-[11px] text-gray-500">Maks. sisi 1280px • JPEG kualitas 0.7</p>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    {previewUrl ? (
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
                          &bull; {fileStats?.isPdf ? 'PDF siap diunggah' : 'Hasil kompresi siap diunggah ke Drive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSelectedFile();
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                    title="Hapus berkas terpilih"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="py-4">
                  <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-700">
                    Tarik dan lepas berkas berita acara di sini, atau <span className="text-[#0056b3]">pilih berkas</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Foto otomatis dikompres di browser sebelum diunggah ke Google Drive cabang
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            {!isDriveReady ? (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 px-3.5 py-2.5 rounded-xl border border-amber-200 w-full sm:w-auto">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Form terkunci: Drive cabang {selectedBranch?.name} belum terhubung</span>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => router.push('/rekap')}
                className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !isDriveReady}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#0056b3] hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-2 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengunggah & Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isDriveReady ? 'Simpan Data Ketidakhadiran' : 'Drive Cabang Belum Terhubung'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
