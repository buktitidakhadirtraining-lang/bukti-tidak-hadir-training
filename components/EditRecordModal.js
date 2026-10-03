// components/EditRecordModal.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  X,
  Loader2,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  FileText,
  User,
  Hash,
  Briefcase,
  Building2,
  GraduationCap,
  Calendar,
  HelpCircle,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import { POSITIONS } from '../lib/config.js';
import { compressImage, formatBytes } from '../lib/compress.js';

export default function EditRecordModal({ isOpen, onClose, record, meta, onUpdated }) {
  const fileInputRef = useRef(null);

  const [nik, setNik] = useState('');
  const [namaPeserta, setNamaPeserta] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [branchId, setBranchId] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [batch, setBatch] = useState('1');
  const [tanggal, setTanggal] = useState('');
  const [alasanId, setAlasanId] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileStats, setFileStats] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Sync form state with record when opened
  useEffect(() => {
    if (record && isOpen) {
      setNik(record.nik || '');
      setNamaPeserta(record.nama_peserta || '');
      setJabatan(record.jabatan || POSITIONS[0]);
      setBranchId(record.branch_id || '');
      setTrainingId(record.training_id || '');
      setBatch(String(record.batch || '1'));
      setTanggal(record.tanggal_pelaksanaan || '');
      setAlasanId(record.alasan_id || '');
      setKeterangan(record.keterangan || '');
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileStats(null);
    }
  }, [record, isOpen]);

  // Clean up object URL when modal closes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen || !record) return null;

  const isAdminPusat = meta?.userRole === 'admin_pusat';
  const isOldPosition = jabatan && !POSITIONS.includes(jabatan);
  const hasExistingProof = Boolean(record.drive_file_id);

  // Handle file selection & automatic browser compression
  async function handleFileChange(file) {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format berkas tidak didukung. Harap pilih gambar (JPG/PNG/WebP) atau PDF.');
      return;
    }

    // Dokumen PDF: batas 1 MB
    if (file.type === 'application/pdf') {
      const ONE_MB = 1 * 1024 * 1024;
      if (file.size > ONE_MB) {
        toast.error(
          `Ukuran dokumen PDF melebihi 1 MB (${formatBytes(file.size)}). Silakan perkecil dokumen terlebih dahulu.`
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(file);
      setFileStats({
        originalSize: file.size,
        compressedSize: file.size,
        sizeSummary: formatBytes(file.size),
        isPdf: true,
      });
      setPreviewUrl(null);
      toast.success(`Dokumen PDF siap diunggah (${formatBytes(file.size)})`);
      return;
    }

    // Foto: kompres otomatis di browser
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!nik || !namaPeserta || !jabatan || !trainingId || !batch || !tanggal || !branchId || !alasanId) {
      toast.error('Semua kolom bertanda bintang (*) wajib diisi');
      return;
    }

    if (!/^\d{8,16}$/.test(nik)) {
      toast.error('NIK harus berupa 8 hingga 16 digit angka');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('nik', nik.trim());
      formData.append('nama_peserta', namaPeserta.trim());
      formData.append('jabatan', jabatan.trim());
      formData.append('branch_id', branchId);
      formData.append('training_id', trainingId);
      formData.append('batch', batch);
      formData.append('tanggal_pelaksanaan', tanggal);
      formData.append('alasan_id', alasanId);
      formData.append('keterangan', keterangan.trim());

      if (selectedFile) {
        formData.append('evidence_file', selectedFile);
      }

      const res = await fetch(`/api/records/${record.id}`, {
        method: 'PUT',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Gagal memperbarui catatan');
      }

      toast.success(
        selectedFile
          ? 'Data ketidakhadiran dan berkas bukti berhasil diperbarui'
          : 'Data ketidakhadiran berhasil diperbarui'
      );

      if (onUpdated) {
        onUpdated(json.data);
      }
      onClose();
    } catch (err) {
      console.error('[Edit Submit Error]:', err);
      toast.error(err.message || 'Terjadi kesalahan sistem saat memperbarui data');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Indomaret Bar */}
        <div className="indomaret-bar shrink-0">
          <div className="indomaret-bar-blue" />
          <div className="indomaret-bar-yellow" />
          <div className="indomaret-bar-red" />
        </div>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-base sm:text-lg font-black text-gray-900 font-title tracking-tight">
              Edit Data Ketidakhadiran Training
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              ID: {record.id.slice(0, 8)} &bull; {record.branches?.name || 'Cabang'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-5 text-xs flex-1">
          {/* Section: Identitas Peserta */}
          <div>
            <h4 className="text-xs font-bold text-[#0056b3] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4" />
              1. Identitas Peserta Training
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                    placeholder="Contoh: 2024100123"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[40px]"
                  />
                </div>
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
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[40px]"
                />
              </div>

              {/* Jabatan / Posisi */}
              <div className="sm:col-span-2">
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
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[40px]"
                  >
                    {/* Jika nilai lama tidak ada dalam 5 opsi resmi, tampilkan sebagai opsi terpilih sementara */}
                    {isOldPosition && (
                      <option value={jabatan}>
                        {jabatan} (Jabatan Lama / Tidak Berlaku)
                      </option>
                    )}
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                {isOldPosition && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Jabatan lama terdeteksi:</span>
                      <p className="mt-0.5 text-amber-700">
                        Nilai <strong>&quot;{jabatan}&quot;</strong> sudah tidak berlaku dalam standar 5 jabatan resmi.
                        Sebaiknya pilih ulang salah satu dari 5 jabatan baru yang sesuai di atas.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Cabang */}
              <div className="sm:col-span-2">
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
                      className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[40px]"
                    >
                      {meta?.branches?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name} {!b.driveReady ? '⚠️ [Drive Belum Terhubung]' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={record.branches?.name || 'Cabang'}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-gray-100 border border-gray-200 rounded-xl text-gray-600 font-semibold cursor-not-allowed min-h-[40px]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Rincian Training */}
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-xs font-bold text-[#0056b3] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              2. Jadwal & Pelaksanaan Training
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Jenis Training */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Jenis Training <span className="text-red-500">*</span>
                </label>
                <select
                  value={trainingId}
                  onChange={(e) => setTrainingId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[40px]"
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
                <input
                  type="number"
                  min="1"
                  max="999"
                  required
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[40px]"
                />
              </div>

              {/* Tanggal Pelaksanaan */}
              <div className="sm:col-span-3">
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
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[40px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Alasan Ketidakhadiran */}
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-xs font-bold text-[#0056b3] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              3. Alasan Ketidakhadiran
            </h4>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Alasan Ketidakhadiran <span className="text-red-500">*</span>
                </label>
                <select
                  value={alasanId}
                  onChange={(e) => setAlasanId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[40px]"
                >
                  {meta?.reasons?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Catatan tambahan bila diperlukan..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3]"
                />
              </div>
            </div>
          </div>

          {/* Section: Berkas Bukti (Foto/PDF) */}
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-xs font-bold text-[#0056b3] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4" />
              4. Berkas Bukti Berita Acara (Foto / PDF)
            </h4>

            {/* Status Bukti Saat Ini */}
            <div className="mb-3 p-3 rounded-xl border bg-gray-50/70 border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-700">Status Bukti Saat Ini:</span>
                {hasExistingProof ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Tersedia di Google Drive Cabang
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    Belum Ada Bukti Foto/PDF
                  </span>
                )}
              </div>

              {hasExistingProof && (
                <p className="text-[11px] text-gray-600 mt-1.5 truncate">
                  Berkas: <span className="font-semibold text-gray-800">{record.drive_file_name || 'Bukti Berita Acara'}</span>
                </p>
              )}

              {!hasExistingProof && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Data ini belum memiliki berkas bukti (misal: hasil impor Excel/CSV). Anda dapat menambahkan foto surat keterangan/berita acara sekarang.
                </p>
              )}
            </div>

            {/* Area Upload File Baru */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                {hasExistingProof ? 'Ganti Berkas Bukti (Opsional)' : 'Unggah Berkas Bukti Baru *'}
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
              />

              {!selectedFile && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-[#0056b3] bg-blue-50/50 scale-[0.99]'
                      : 'border-gray-200 hover:border-[#0056b3] hover:bg-blue-50/30'
                  }`}
                >
                  <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 text-[#0056b3] flex items-center justify-center mb-2">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">
                    Klik untuk memilih atau seret berkas ke sini
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Mendukung Foto (JPG, PNG, WebP) dikompres otomatis & Dokumen PDF (Maks. 1 MB)
                  </p>
                </div>
              )}

              {compressing && (
                <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-[#0056b3]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengompresi foto di browser...</span>
                </div>
              )}

              {/* Berkas Baru Terpilih */}
              {selectedFile && !compressing && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Preview baru"
                        className="w-10 h-10 object-cover rounded-lg border border-emerald-300 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        {fileStats?.isPdf
                          ? `Dokumen PDF (${fileStats?.sizeSummary})`
                          : `Foto Terkompresi (${fileStats?.sizeSummary})`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={removeSelectedFile}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                    title="Batal pilih berkas baru"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || compressing}
              className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 bg-white hover:bg-gray-50 min-h-[38px] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || compressing}
              className="px-5 py-2 rounded-xl bg-[#0056b3] hover:bg-blue-700 font-bold text-white shadow-xs flex items-center gap-2 min-h-[38px] transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Drive Cabang...</span>
                </>
              ) : (
                <span>Simpan Perubahan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
