// components/EditDataTambahanModal.js
'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { MASTER_TRAININGS_LIST } from '../lib/trainings-master.js';

export default function EditDataTambahanModal({
  isOpen,
  onClose,
  record,
  onUpdated,
  meta,
  title = 'Edit Data Peserta',
  updateEndpoint,
}) {
  const [training, setTraining] = useState('');
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [kdToko, setKdToko] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [alasanTidakHadir, setAlasanTidakHadir] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setTraining(record.training || 'YFC');
      setNik(record.nik || '');
      setNama(record.nama || '');
      setKdToko(record.kd_toko || '');
      setNamaToko(record.nama_toko || '');
      setAlasanTidakHadir(record.alasan_tidak_hadir || 'Sakit');
    }
  }, [record]);

  if (!isOpen || !record) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nik.trim() || !nama.trim()) {
      toast.error('NIK dan Nama wajib diisi');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Memperbarui data...');

    const url = updateEndpoint || `/api/data-tambahan/${record.id}`;

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no: record.no,
          training: training.trim(),
          nik: nik.trim(),
          nama: nama.trim(),
          kd_toko: kdToko.trim(),
          nama_toko: namaToko.trim(),
          alasan_tidak_hadir: alasanTidakHadir.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Data berhasil diperbarui!', { id: toastId });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-[#0056b3] rounded-xl">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-title">
                {title}
              </h2>
              <p className="text-xs text-gray-500">
                No. Urut #{record.no || '-'}
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
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

          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
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
