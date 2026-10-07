// components/PanelUploadTtd.js
'use client';

import React, { useState, useRef } from 'react';
import {
  PenTool,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  X,
  Loader2,
  Eye,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export const PERAN_LIST = [
  { key: 'dbm_operasional', label: 'DBM Operasional' },
  { key: 'dbm_admin', label: 'DBM Admin' },
  { key: 'hrd_manager', label: 'HRD Manager' },
  { key: 'tc_supervisor', label: 'TC Supervisor' },
];

/**
 * Helper: Memproses file gambar tanda tangan di canvas sisi klien
 * - Resize max width 800px (rasio dijaga)
 * - Kompresi hingga di bawah ~300 KB
 * - Opsi hapus latar putih / mendekati putih menjadi transparan
 */
async function processSignatureFile(file, removeWhiteBg = true) {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file tanda tangan melebihi batas maksimal 5 MB.');
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
  const maxW = 800;
  if (width > maxW) {
    height = Math.round((height * maxW) / width);
    width = maxW;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  if (removeWhiteBg) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      // Jika piksel putih atau hampir putih
      if (r > 215 && g > 215 && b > 215) {
        d[i + 3] = 0; // Transparan penuh
      } else if (r > 190 && g > 190 && b > 190) {
        // Transisi halus
        const factor = (255 - Math.max(r, g, b)) / (255 - 190);
        d[i + 3] = Math.round(d[i + 3] * factor);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const processedDataUrl = canvas.toDataURL('image/png', 0.9);
  const base64 = processedDataUrl.split(',')[1];

  return {
    dataUrl: processedDataUrl,
    base64,
    mimeType: 'image/png',
    width,
    height,
  };
}

export default function PanelUploadTtd({
  ttdRecords = [], // Array dari /api/ttd
  userRole = 'admin_cabang',
  branchName = '',
  branchId = '',
  isDriveReady = true,
  onTtdUpdated, // Callback ketika TTD berhasil diupload/dihapus
}) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    peran: null,
    peranLabel: '',
    selectedFile: null,
    processedResult: null,
    removeWhiteBg: true,
    isProcessing: false,
    isSaving: false,
  });

  const [deletingKey, setDeletingKey] = useState(null);
  const fileInputRef = useRef(null);
  const targetPeranRef = useRef(null);

  // Map peran key ke objek TTD
  const ttdMap = React.useMemo(() => {
    const map = {};
    for (const rec of ttdRecords || []) {
      if (rec.peran) map[rec.peran] = rec;
    }
    return map;
  }, [ttdRecords]);

  // Cek peran yang belum ada TTD
  const missingRoles = PERAN_LIST.filter((p) => !ttdMap[p.key]?.drive_file_id);
  const isAdmin = userRole === 'admin_cabang' || userRole === 'admin_pusat';

  function triggerFileInput(peran, peranLabel) {
    if (!isAdmin) {
      toast.error('Hanya Admin Cabang yang memiliki hak akses untuk mengupload tanda tangan.');
      return;
    }

    if (!isDriveReady) {
      toast.error('Google Drive cabang belum terhubung, hubungi Admin Pusat');
      return;
    }

    targetPeranRef.current = { peran, peranLabel };
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file || !targetPeranRef.current) return;

    const { peran, peranLabel } = targetPeranRef.current;

    // Validasi tipe
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
      peran,
      peranLabel,
      selectedFile: file,
      processedResult: null,
      removeWhiteBg: true,
      isProcessing: true,
      isSaving: false,
    });

    try {
      const result = await processSignatureFile(file, true);
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

  async function handleToggleRemoveWhite(e) {
    const checked = e.target.checked;
    if (!modalState.selectedFile) return;

    setModalState((prev) => ({ ...prev, removeWhiteBg: checked, isProcessing: true }));
    try {
      const result = await processSignatureFile(modalState.selectedFile, checked);
      setModalState((prev) => ({
        ...prev,
        processedResult: result,
        isProcessing: false,
      }));
    } catch (err) {
      toast.error('Gagal memproses ulang: ' + err.message);
      setModalState((prev) => ({ ...prev, isProcessing: false }));
    }
  }

  async function handleSaveSignature() {
    if (!modalState.processedResult || !modalState.peran) return;

    setModalState((prev) => ({ ...prev, isSaving: true }));
    const toastId = toast.loading(`Mengunggah TTD ${modalState.peranLabel} ke Google Drive cabang...`);

    try {
      const res = await fetch('/api/ttd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peran: modalState.peran,
          base64: modalState.processedResult.base64,
          mimeType: modalState.processedResult.mimeType,
          branch_id: branchId || undefined,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Gagal menyimpan tanda tangan');
      }

      toast.success(`Tanda tangan ${modalState.peranLabel} berhasil disimpan ke Google Drive cabang!`, {
        id: toastId,
      });

      setModalState({
        isOpen: false,
        peran: null,
        peranLabel: '',
        selectedFile: null,
        processedResult: null,
        removeWhiteBg: true,
        isProcessing: false,
        isSaving: false,
      });

      if (onTtdUpdated) onTtdUpdated();
    } catch (err) {
      console.error('[Upload TTD Error]:', err);
      toast.error(err.message || 'Gagal menyimpan tanda tangan', { id: toastId });
      setModalState((prev) => ({ ...prev, isSaving: false }));
    }
  }

  async function handleDeleteSignature(peran, peranLabel) {
    if (!isAdmin) {
      toast.error('Hanya Admin Cabang yang dapat menghapus tanda tangan.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus tanda tangan ${peranLabel}? File di Google Drive cabang akan dipindahkan ke Sampah.`)) {
      return;
    }

    setDeletingKey(peran);
    const toastId = toast.loading(`Menghapus TTD ${peranLabel}...`);

    try {
      const params = new URLSearchParams();
      params.set('peran', peran);
      if (branchId) params.set('branch_id', branchId);

      const res = await fetch(`/api/ttd?${params.toString()}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Gagal menghapus tanda tangan');
      }

      toast.success(`Tanda tangan ${peranLabel} berhasil dihapus dari Google Drive!`, { id: toastId });
      if (onTtdUpdated) onTtdUpdated();
    } catch (err) {
      console.error('[Delete TTD Error]:', err);
      toast.error(err.message || 'Gagal menghapus tanda tangan', { id: toastId });
    } finally {
      setDeletingKey(null);
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
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#0056b3]">
            <PenTool className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 font-title">
              Upload Gambar Tanda Tangan (TTD) Cabang
            </h2>
            <p className="text-xs text-gray-500">
              Disimpan ke Google Drive cabang {branchName ? `(${branchName})` : ''} &amp; otomatis tampil pada versi &quot;Ada TTD (Gbr 3)&quot;.
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

      {/* Peringatan kecil peran yang belum diupload */}
      {missingRoles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs bg-amber-50/70 text-amber-800 p-2.5 rounded-xl border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-semibold">Perhatian:</span>
          {missingRoles.map((p, idx) => (
            <span key={p.key} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-amber-200 text-[11px] font-medium text-amber-900">
              TTD {p.label} belum diupload
              {idx < missingRoles.length - 1 ? ',' : ''}
            </span>
          ))}
          <span className="text-[11px] text-gray-500 italic">
            (Kolom yang belum memiliki TTD akan dibiarkan kosong tanpa tanda tangan)
          </span>
        </div>
      )}

      {/* 4 Slot Tanda Tangan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PERAN_LIST.map((slot) => {
          const rec = ttdMap[slot.key];
          const hasTtd = Boolean(rec?.drive_file_id);
          const isDeleting = deletingKey === slot.key;

          return (
            <div
              key={slot.key}
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                hasTtd
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : 'border-dashed border-gray-300 bg-gray-50/50'
              }`}
            >
              {/* Header Slot */}
              <div className="space-y-1 mb-2">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-bold text-xs text-gray-900">{slot.label}</h3>
                  {hasTtd ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Tersimpan di Google Drive
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Belum ada TTD
                    </span>
                  )}
                </div>
              </div>

              {/* Area Preview TTD */}
              <div
                className="w-full h-24 rounded-lg border border-gray-200 bg-white flex items-center justify-center p-2 mb-3 overflow-hidden relative"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                }}
              >
                {hasTtd && rec?.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rec.dataUrl}
                    alt={`TTD ${slot.label}`}
                    className="max-h-full max-w-full object-contain mx-auto"
                  />
                ) : hasTtd ? (
                  <div className="text-center p-2 text-emerald-700">
                    <FileCheck2 className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                    <span className="text-[10px] font-bold block">Tersimpan di Drive</span>
                    <span className="text-[9px] text-gray-500 truncate block max-w-[140px]">
                      {rec?.file_name || 'TTD File'}
                    </span>
                  </div>
                ) : (
                  <div className="text-center p-2 text-gray-400">
                    <PenTool className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                    <span className="text-[11px] italic">Belum ada TTD</span>
                  </div>
                )}
              </div>

              {/* Tombol Aksi */}
              <div className="flex items-center gap-1.5">
                {!hasTtd ? (
                  <button
                    type="button"
                    onClick={() => triggerFileInput(slot.key, slot.label)}
                    disabled={!isAdmin || !isDriveReady}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload TTD</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => triggerFileInput(slot.key, slot.label)}
                      disabled={!isAdmin || isDeleting}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Ganti</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSignature(slot.key, slot.label)}
                      disabled={!isAdmin || isDeleting}
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all disabled:opacity-50"
                      title="Hapus tanda tangan ini dari Google Drive"
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
          );
        })}
      </div>

      {/* Modal Preview & Konfirmasi Upload */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-gray-900 font-title">
                  Upload Tanda Tangan: {modalState.peranLabel}
                </h3>
                <p className="text-xs text-gray-500">
                  Pratinjau sebelum disimpan ke Google Drive cabang
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

            {/* Area Preview Hasil Olahan */}
            <div
              className="w-full h-44 rounded-xl border border-gray-200 bg-white flex items-center justify-center p-3 relative overflow-hidden"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                backgroundSize: '12px 12px',
                backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
              }}
            >
              {modalState.isProcessing ? (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0056b3]" />
                  <span className="text-xs font-semibold">Mengolah gambar tanda tangan...</span>
                </div>
              ) : modalState.processedResult?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={modalState.processedResult.dataUrl}
                  alt="Preview TTD"
                  className="max-h-full max-w-full object-contain mx-auto"
                />
              ) : null}
            </div>

            {/* Opsi Hapus Latar Putih Otomatis */}
            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-1.5">
              <label className="flex items-start gap-2.5 text-xs text-gray-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={modalState.removeWhiteBg}
                  onChange={handleToggleRemoveWhite}
                  className="mt-0.5 rounded text-[#0056b3] focus:ring-[#0056b3]"
                />
                <div>
                  <span className="font-bold block text-gray-900">
                    Hapus latar putih otomatis (Rekomendasi)
                  </span>
                  <span className="text-gray-500 text-[11px] block leading-tight">
                    Mengubah kertas/latar putih menjadi transparan agar coretan tanda tangan tidak menutupi garis tabel berita acara.
                  </span>
                </div>
              </label>
            </div>

            {/* Tombol Aksi Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
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
                onClick={handleSaveSignature}
                disabled={modalState.isSaving || modalState.isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
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
