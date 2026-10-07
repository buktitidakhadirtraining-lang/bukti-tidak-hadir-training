// components/PanelUploadTtd.js
'use client';

import React, { useState, useRef } from 'react';
import {
  FileCheck2,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Info,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Helper: Memproses file paket tanda tangan di canvas sisi klien
 * - Validasi max 5 MB
 * - Tidak mengubah warna, tidak menghapus latar belakang
 * - Hanya memperkecil proporsional jika lebar > 2000 px
 */
async function processPackageSignatureFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file melebihi batas maksimal 5 MB.');
  }

  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = rawDataUrl;
  });

  let { width, height } = img;
  const maxW = 2000;
  if (width > maxW) {
    height = Math.round((height * maxW) / width);
    width = maxW;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const processedDataUrl = canvas.toDataURL('image/png', 1.0);
  const base64 = processedDataUrl.split(',')[1];

  return {
    dataUrl: processedDataUrl,
    base64,
    mimeType: 'image/png',
    width,
    height,
    originalWidth: img.width,
    originalHeight: img.height,
    fileSizeKb: Math.round(file.size / 1024),
  };
}

export default function PanelUploadTtd({
  ttdRecords = [], // Array dari /api/ttd
  printFormat = 'rekap_dispensasi', // 'rekap_dispensasi' | 'soft_skill'
  modeGambar = 'hanya_ttd', // 'hanya_ttd' | 'lengkap'
  userRole = 'admin_cabang',
  branchName = '',
  branchId = '',
  isDriveReady = true,
  onTtdUpdated, // Callback ketika TTD berhasil diupload/dihapus
}) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    selectedFile: null,
    processedResult: null,
    isProcessing: false,
    isSaving: false,
  });

  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const isSoftSkill = printFormat === 'soft_skill';
  const activePeran = isSoftSkill ? 'paket_ttd_softskill' : 'paket_ttd_rekap';

  // Ambil record paket sesuai format yang SEDANG DIPILIH saja
  const paketRecord = React.useMemo(() => {
    if (isSoftSkill) {
      return (ttdRecords || []).find((rec) => rec.peran === 'paket_ttd_softskill') || null;
    }
    // Format Rekap: utamakan paket_ttd_rekap, fallback ke legacy paket_ttd jika ada
    return (
      (ttdRecords || []).find((rec) => rec.peran === 'paket_ttd_rekap') ||
      (ttdRecords || []).find((rec) => rec.peran === 'paket_ttd') ||
      null
    );
  }, [ttdRecords, isSoftSkill]);

  const hasPaketTtd = Boolean(paketRecord?.drive_file_id);
  const isAdmin = userRole === 'admin_cabang' || userRole === 'admin_pusat';

  function triggerFileInput() {
    if (!isAdmin) {
      toast.error('Hanya Admin Cabang yang memiliki hak akses untuk mengupload tanda tangan.');
      return;
    }

    if (!isDriveReady) {
      toast.error('Google Drive cabang belum terhubung, hubungi Admin Pusat');
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi format file
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Format file harus berupa gambar PNG, JPG, JPEG, atau WEBP.');
      return;
    }

    // Validasi ukuran
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5 MB. Silakan pilih file yang lebih kecil.');
      return;
    }

    setModalState({
      isOpen: true,
      selectedFile: file,
      processedResult: null,
      isProcessing: true,
      isSaving: false,
    });

    try {
      const result = await processPackageSignatureFile(file);
      setModalState((prev) => ({
        ...prev,
        processedResult: result,
        isProcessing: false,
      }));
    } catch (err) {
      toast.error('Gagal memproses gambar: ' + err.message);
      setModalState((prev) => ({ ...prev, isOpen: false, isProcessing: false }));
    }
  }

  async function handleSavePackageSignature() {
    if (!modalState.processedResult) return;

    setModalState((prev) => ({ ...prev, isSaving: true }));
    const formatLabel = isSoftSkill ? 'Soft Skill' : 'Rekap';
    const toastId = toast.loading(`Mengunggah gambar paket TTD ${formatLabel} ke Google Drive cabang...`);

    try {
      const res = await fetch('/api/ttd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peran: activePeran,
          base64: modalState.processedResult.base64,
          mimeType: modalState.processedResult.mimeType,
          branch_id: branchId || undefined,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || `Gagal menyimpan gambar paket tanda tangan ${formatLabel}`);
      }

      toast.success(`Gambar paket tanda tangan ${formatLabel} berhasil disimpan ke Google Drive cabang!`, {
        id: toastId,
      });

      setModalState({
        isOpen: false,
        selectedFile: null,
        processedResult: null,
        isProcessing: false,
        isSaving: false,
      });

      if (onTtdUpdated) onTtdUpdated(json.data, json.dataUrl);
    } catch (err) {
      console.error('[Upload Paket TTD Error]:', err);
      toast.error(err.message || 'Gagal menyimpan gambar paket tanda tangan', { id: toastId });
      setModalState((prev) => ({ ...prev, isSaving: false }));
    }
  }

  async function handleDeletePackageSignature() {
    if (!isAdmin) {
      toast.error('Hanya Admin Cabang yang dapat menghapus tanda tangan.');
      return;
    }

    const formatLabel = isSoftSkill ? 'Berita Acara Soft Skill' : 'Berita Acara Rekap';
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus gambar paket tanda tangan ${formatLabel} ini? File di Google Drive cabang akan dipindahkan ke Sampah.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    const toastId = toast.loading(`Menghapus gambar paket TTD ${formatLabel}...`);

    try {
      const targetPeran = paketRecord?.peran || activePeran;
      const params = new URLSearchParams();
      params.set('peran', targetPeran);
      if (branchId) params.set('branch_id', branchId);

      const res = await fetch(`/api/ttd?${params.toString()}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Gagal menghapus gambar paket tanda tangan');
      }

      toast.success(`Gambar paket tanda tangan ${formatLabel} berhasil dihapus dari Google Drive!`, { id: toastId });
      if (onTtdUpdated) onTtdUpdated(null, null, targetPeran);
    } catch (err) {
      console.error('[Delete Paket TTD Error]:', err);
      toast.error(err.message || 'Gagal menghapus gambar paket tanda tangan', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-soft space-y-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#0056b3]">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900 font-title">
                {isSoftSkill
                  ? 'Upload Gambar Paket TTD - Berita Acara Soft Skill'
                  : 'Upload Gambar Paket TTD - Berita Acara Rekap'}
              </h2>
              {hasPaketTtd ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Tersimpan di Google Drive
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Belum ada gambar
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {isSoftSkill ? (
                modeGambar === 'hanya_ttd' ? (
                  <>
                    Disimpan ke Google Drive cabang {branchName ? `(${branchName})` : ''} &amp; otomatis tampil pada ruang tanda tangan versi &quot;Sudah Ada TTD (Gbr 7)&quot;.
                  </>
                ) : (
                  <>
                    Disimpan ke Google Drive cabang {branchName ? `(${branchName})` : ''} &amp; menggantikan seluruh blok tanda tangan pada versi &quot;Sudah Ada TTD (Gbr 7)&quot;.
                  </>
                )
              ) : (
                <>
                  Disimpan ke Google Drive cabang {branchName ? `(${branchName})` : ''} &amp; menggantikan seluruh blok tanda tangan pada versi &quot;Ada TTD (Gbr 3)&quot;.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Warning Google Drive jika belum terhubung */}
        {!isDriveReady && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Google Drive cabang belum terhubung, hubungi Admin Pusat</span>
          </div>
        )}
      </div>

      {/* Petunjuk Penggunaan */}
      <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-950">
        <Info className="w-4 h-4 text-[#0056b3] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-900">
            {isSoftSkill
              ? modeGambar === 'hanya_ttd'
                ? 'Upload satu gambar berisi 3 tanda tangan berjajar, dibagi tiga sama lebar, tanpa jabatan dan nama.'
                : 'Upload satu gambar berisi seluruh tabel tanda tangan (Mengetahui 2, Mengetahui 1, Membuat, dan 3 TTD).'
              : 'Upload satu gambar berisi seluruh tabel tanda tangan (Mengetahui, Dibuat oleh, 4 TTD, dan nama jabatan).'}
          </p>
          <p className="text-blue-800/80 leading-relaxed text-[11px]">
            {isSoftSkill ? (
              modeGambar === 'hanya_ttd' ? (
                <>
                  Gambar hanya berisi 3 goresan tanda tangan berjajar horizontal. Nama dan jabatan akan otomatis ditulis oleh aplikasi sesuai pengaturan di atas. Disarankan format <strong>PNG transparan</strong> dengan lebar minimal <strong>1200 px</strong> (maksimal file 5 MB).
                </>
              ) : (
                <>
                  Sesuai blok tanda tangan pada <strong>Gambar 7</strong> (Mengetahui 2 Deputy Branch Manager ADM, Mengetahui 1 Human Resource Manager, Membuat Training Center Supervisor). Potong gambar tepat di tepi garis tabel. Disarankan format <strong>PNG</strong> dengan lebar minimal <strong>1200 px</strong> (maksimal file 5 MB). Gambar akan tampil dalam ukuran lebar penuh tanpa crop atau distorsi.
                </>
              )
            ) : (
              <>
                Sesuai blok tanda tangan pada <strong>Gambar 3</strong> (DBM Operasional, DBM Admin, HRD Manager, TC Supervisor). Potong gambar tepat di tepi garis tabel. Disarankan format <strong>PNG</strong> dengan lebar minimal <strong>1200 px</strong> (maksimal file 5 MB). Gambar akan tampil dalam ukuran lebar penuh tanpa crop atau distorsi.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Peringatan jika belum ada gambar paket untuk format ini */}
      {!hasPaketTtd && (
        <div className="flex items-center gap-2 text-xs bg-amber-50/70 text-amber-800 p-2.5 rounded-xl border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">
            Gambar paket TTD untuk format ini belum diupload.
          </span>
        </div>
      )}

      {/* Area Preview Gambar Paket & Tombol Aksi */}
      <div className="border rounded-2xl p-4 bg-gray-50/40 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs text-gray-800">
            Pratinjau Blok Tanda Tangan ({isSoftSkill ? 'Soft Skill' : 'Rekap'}):
          </h3>
          <div className="flex items-center gap-2">
            {!hasPaketTtd ? (
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={!isAdmin || !isDriveReady}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Paket TTD</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={triggerFileInput}
                  disabled={!isAdmin || isDeleting}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Ganti Gambar</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeletePackageSignature}
                  disabled={!isAdmin || isDeleting}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all disabled:opacity-50"
                  title="Hapus gambar paket tanda tangan ini dari Google Drive"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Hapus</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Kotak Tampilan Pratinjau Paket TTD */}
        <div
          className="w-full min-h-[140px] max-h-[300px] rounded-xl border border-gray-200 bg-white flex items-center justify-center p-3 overflow-hidden relative"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
            backgroundSize: '14px 14px',
            backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
          }}
        >
          {hasPaketTtd && paketRecord?.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={paketRecord.dataUrl}
              alt={`Paket Tanda Tangan ${isSoftSkill ? 'Soft Skill' : 'Rekap'}`}
              className="max-h-[280px] max-w-full object-contain mx-auto shadow-xs border border-gray-100 rounded"
            />
          ) : hasPaketTtd ? (
            <div className="text-center p-4 text-emerald-700">
              <FileCheck2 className="w-8 h-8 mx-auto mb-1.5 text-emerald-600" />
              <span className="text-xs font-bold block">Tersimpan di Google Drive</span>
              <span className="text-[10px] text-gray-500 truncate block max-w-xs mx-auto">
                {paketRecord?.file_name || (isSoftSkill ? 'TTD_PAKET_SOFTSKILL.png' : 'TTD_PAKET_REKAP.png')}
              </span>
            </div>
          ) : (
            <div className="text-center p-6 text-gray-400 space-y-1.5">
              <ImageIcon className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-xs font-medium text-gray-500">
                Belum ada gambar paket tanda tangan yang diupload untuk format {isSoftSkill ? 'Soft Skill' : 'Rekap'}
              </p>
              <p className="text-[11px] text-gray-400">
                Klik tombol &quot;Upload Paket TTD&quot; di atas untuk memilih berkas gambar.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Preview Ukuran Sebenarnya Sebelum Simpan */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm text-gray-900 font-title">
                  Pratinjau Gambar Paket Tanda Tangan - {isSoftSkill ? 'Berita Acara Soft Skill' : 'Berita Acara Rekap'}
                </h3>
                <p className="text-xs text-gray-500">
                  Periksa kejelasan seluruh tabel tanda tangan sebelum disimpan ke Google Drive cabang
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informasi Berkas */}
            {modalState.processedResult && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] bg-gray-50 p-2.5 rounded-xl border border-gray-200 shrink-0">
                <span className="text-gray-600">
                  Dimensi:{' '}
                  <strong className="text-gray-900 font-mono">
                    {modalState.processedResult.width} × {modalState.processedResult.height} px
                  </strong>
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-600">
                  Ukuran:{' '}
                  <strong className="text-gray-900 font-mono">
                    {modalState.processedResult.fileSizeKb} KB
                  </strong>
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-600">
                  Format: <strong className="text-gray-900 uppercase">PNG</strong>
                </span>
              </div>
            )}

            {/* Area Tampilan Pratinjau Ukuran Penuh */}
            <div
              className="flex-1 w-full min-h-[220px] rounded-xl border border-gray-200 bg-white flex items-center justify-center p-3 relative overflow-auto"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                backgroundSize: '14px 14px',
                backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
              }}
            >
              {modalState.isProcessing ? (
                <div className="flex flex-col items-center gap-2 text-gray-500 py-10">
                  <Loader2 className="w-7 h-7 animate-spin text-[#0056b3]" />
                  <span className="text-xs font-semibold">Memuat gambar paket TTD...</span>
                </div>
              ) : modalState.processedResult?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={modalState.processedResult.dataUrl}
                  alt="Pratinjau Ukuran Sebenarnya"
                  className="max-w-full h-auto object-contain mx-auto shadow-md border border-gray-200 rounded"
                />
              ) : null}
            </div>

            {/* Tombol Aksi Modal */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t shrink-0">
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                disabled={modalState.isSaving}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-xs font-bold transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePackageSignature}
                disabled={modalState.isSaving || modalState.isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                {modalState.isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Drive...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Simpan ke Google Drive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
