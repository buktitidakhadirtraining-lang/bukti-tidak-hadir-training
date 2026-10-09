// components/EditDataTambahanModal.js
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Edit3, Image as ImageIcon, Trash2, Upload, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MASTER_TRAININGS_LIST } from '../lib/trainings-master.js';
import { compressImage, formatBytes } from '../lib/compress.js';

export default function EditDataTambahanModal({
  isOpen,
  onClose,
  record,
  onUpdated,
  meta,
  title = 'Edit Data Peserta',
  updateEndpoint,
}) {
  const fileInputRef = useRef(null);

  const [training, setTraining] = useState('');
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [kdToko, setKdToko] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [alasanTidakHadir, setAlasanTidakHadir] = useState('');
  const [saving, setSaving] = useState(false);

  // Foto State
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(null);
  const [loadingCurrentPhoto, setLoadingCurrentPhoto] = useState(false);
  const [markedDeletePhoto, setMarkedDeletePhoto] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState(null);
  const [newPhotoStats, setNewPhotoStats] = useState(null);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    if (record) {
      setTraining(record.training || 'YFC');
      setNik(record.nik || '');
      setNama(record.nama || '');
      setKdToko(record.kd_toko || '');
      setNamaToko(record.nama_toko || '');
      setAlasanTidakHadir(record.alasan_tidak_hadir || 'Sakit');
      setMarkedDeletePhoto(false);
      setNewPhotoFile(null);
      if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview);
      setNewPhotoPreview(null);
      setNewPhotoStats(null);

      // Load foto saat ini jika ada
      if (record.foto_drive_file_id) {
        setLoadingCurrentPhoto(true);
        fetch(`/api/records/${record.id}/file?json=true`)
          .then((res) => res.json())
          .then((json) => {
            if (json.ok && json.dataUrl) {
              setCurrentPhotoUrl(json.dataUrl);
            } else {
              setCurrentPhotoUrl(null);
            }
          })
          .catch(() => setCurrentPhotoUrl(null))
          .finally(() => setLoadingCurrentPhoto(false));
      } else {
        setCurrentPhotoUrl(null);
        setLoadingCurrentPhoto(false);
      }
    }
  }, [record]);

  if (!isOpen || !record) return null;

  async function handleSelectNewFile(file) {
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error(`Ukuran file melebihi batas maksimal 5 MB (${formatBytes(file.size)})`);
      return;
    }

    setCompressing(true);
    try {
      const res = await compressImage(file, { maxSide: 1600, forceCompress: true });
      setNewPhotoFile(res.file);
      setNewPhotoStats({
        originalSize: res.originalSize,
        compressedSize: res.compressedSize,
        sizeSummary: res.sizeSummary,
      });
      if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview);
      setNewPhotoPreview(URL.createObjectURL(res.blob));
      setMarkedDeletePhoto(false);
      toast.success(`Foto baru siap diunggah (${res.sizeSummary})`);
    } catch (err) {
      console.error('[Compression Edit Error]:', err);
      toast.error(err.message || 'Gagal memproses gambar');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleCancelNewPhoto() {
    if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview);
    setNewPhotoFile(null);
    setNewPhotoPreview(null);
    setNewPhotoStats(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nik.trim() || !nama.trim()) {
      toast.error('NIK dan Nama wajib diisi');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Memperbarui data dan foto...');

    const url = updateEndpoint || `/api/data-tambahan/${record.id}`;

    try {
      const formData = new FormData();
      formData.append('no', record.no || '1');
      formData.append('training', training.trim());
      formData.append('nik', nik.trim());
      formData.append('nama', nama.trim());
      formData.append('kd_toko', kdToko.trim());
      formData.append('nama_toko', namaToko.trim());
      formData.append('alasan_tidak_hadir', alasanTidakHadir.trim());

      if (markedDeletePhoto) {
        formData.append('delete_photo', 'true');
      } else if (newPhotoFile) {
        formData.append('foto', newPhotoFile);
      }

      const res = await fetch(url, {
        method: 'PUT',
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(json.message || 'Data berhasil diperbarui!', { id: toastId });
        if (onUpdated) onUpdated();
        onClose();
      } else {
        toast.error(json.error || 'Gagal memperbarui data', { id: toastId });
      }
    } catch (err) {
      toast.error('Terjadi kesalahan: ' + err.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  const hasExistingPhoto = Boolean(record.foto_drive_file_id) && !markedDeletePhoto;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-[#0056b3] rounded-xl">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-title">
                {title}
              </h2>
              <p className="text-xs text-gray-500">
                No. Urut #{record.no || '-'} &bull; NIK: {record.nik}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Jenis Training <span className="text-red-500">*</span>
            </label>
            <select
              value={training}
              onChange={(e) => setTraining(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
            >
              {MASTER_TRAININGS_LIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                NIK Peserta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-medium uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Kode Toko</label>
              <input
                type="text"
                value={kdToko}
                onChange={(e) => setKdToko(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Nama Toko</label>
              <input
                type="text"
                value={namaToko}
                onChange={(e) => setNamaToko(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Alasan Tidak Hadir <span className="text-red-500">*</span>
            </label>
            <select
              value={alasanTidakHadir}
              onChange={(e) => setAlasanTidakHadir(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
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

          {/* Bagian Bukti Foto */}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <label className="block font-bold text-gray-700">
              Bukti Foto Peserta
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleSelectNewFile(e.target.files[0]);
              }}
            />

            {/* A. Foto Baru yang Dipilih */}
            {newPhotoFile ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {newPhotoPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={newPhotoPreview}
                      alt="Pratinjau Baru"
                      className="w-12 h-12 object-cover rounded-lg border border-blue-300 shrink-0"
                    />
                  )}
                  <div className="min-w-0 text-[11px]">
                    <p className="font-bold text-blue-900 truncate">{newPhotoFile.name}</p>
                    <p className="text-blue-700">{newPhotoStats?.sizeSummary || formatBytes(newPhotoFile.size)}</p>
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-blue-200 text-blue-800 rounded text-[10px] font-bold">
                      Akan menggantikan foto lama
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelNewPhoto}
                  className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:text-red-600 bg-white hover:bg-red-50 border border-gray-300 rounded-lg transition-colors shrink-0"
                >
                  Batal
                </button>
              </div>
            ) : markedDeletePhoto ? (
              /* B. Foto Diberi Tanda Hapus */
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-red-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-[11px] font-medium">
                    Foto lama akan dihapus dari Google Drive saat Anda menyimpan perubahan.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMarkedDeletePhoto(false)}
                  className="px-2.5 py-1 text-xs font-bold bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg shrink-0"
                >
                  Batal Hapus
                </button>
              </div>
            ) : hasExistingPhoto ? (
              /* C. Foto Tersimpan Saat Ini */
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {loadingCurrentPhoto ? (
                    <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    </div>
                  ) : currentPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPhotoUrl}
                      alt="Foto Saat Ini"
                      className="w-12 h-12 object-cover rounded-lg border border-gray-300 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0 text-[11px]">
                    <p className="font-bold text-gray-900 truncate">
                      {record.foto_file_name || 'Foto Tersimpan di Google Drive'}
                    </p>
                    <p className="text-gray-500 text-[10px]">Tersimpan di Google Drive cabang</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={compressing}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
                    title="Ganti dengan foto baru"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Ganti Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkedDeletePhoto(true)}
                    className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 bg-white rounded-lg transition-colors"
                    title="Hapus foto ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* D. Belum Ada Foto */
              <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                  <span>Belum ada bukti foto untuk peserta ini</span>
                </div>
                <button
                  type="button"
                  disabled={compressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-[#0056b3] border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tambah Foto</span>
                </button>
              </div>
            )}

            {compressing && (
              <div className="flex items-center gap-2 text-[11px] text-[#0056b3] p-2 bg-blue-50 rounded-lg">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mengompresi foto & menyesuaikan orientasi...</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || compressing}
              className="px-5 py-2 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
