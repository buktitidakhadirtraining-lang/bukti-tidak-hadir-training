// app/(app)/input-tambahan/page.js
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Save,
  Loader2,
  RefreshCw,
  Search,
  TableProperties,
  Sparkles,
  Code2,
  Edit2,
  Trash2,
  Trash,
} from 'lucide-react';
import { toast } from 'sonner';
import { MASTER_TRAININGS_LIST } from '../../../lib/trainings-master.js';
import AppsScriptModal from '../../../components/AppsScriptModal.js';
import EditDataTambahanModal from '../../../components/EditDataTambahanModal.js';
import ConfirmDialog from '../../../components/ConfirmDialog.js';

export default function InputTambahanPage() {
  const [training, setTraining] = useState('YFC');
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [kdToko, setKdToko] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [alasanTidakHadir, setAlasanTidakHadir] = useState('Sakit');

  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [meta, setMeta] = useState(null);

  // Modals
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteSingleDialog, setDeleteSingleDialog] = useState({
    isOpen: false,
    record: null,
    loading: false,
  });
  const [deleteAllDialog, setDeleteAllDialog] = useState({
    isOpen: false,
    loading: false,
  });

  // Ambil meta alasan & training
  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch('/api/meta');
        const json = await res.json();
        if (json.ok) setMeta(json.data);
      } catch (err) {
        console.error('Failed to load meta:', err);
      }
    }
    fetchMeta();
  }, []);

  // Ambil data tambahan yang sudah tersimpan
  const fetchRecords = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/data-tambahan');
      const json = await res.json();
      if (json.ok) {
        setRecords(json.data || []);
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nik.trim() || !nama.trim()) {
      toast.error('NIK dan Nama Peserta wajib diisi');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Menyimpan ke Supabase & Google Spreadsheet...');

    try {
      const res = await fetch('/api/data-tambahan', {
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

      const json = await res.json();
      if (res.ok && json.ok) {
        const isGasSynced = json.data?.gasSyncStatus?.success;
        if (isGasSynced) {
          toast.success(
            'Data berhasil tersimpan di Supabase & otomatis masuk ke sheet Data_tambahan!',
            { id: toastId }
          );
        } else {
          toast.success(
            'Data tersimpan di Supabase! (Untuk masuk ke Spreadsheet, pastikan URL Apps Script sudah disimpan).',
            { id: toastId }
          );
        }
        // Reset form input
        setNik('');
        setNama('');
        setKdToko('');
        setNamaToko('');
        fetchRecords();
      } else {
        toast.error(json.error || 'Gagal menyimpan data tambahan', { id: toastId });
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan: ' + err.message, { id: toastId });
    } finally {
      setSaving(false);
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
        toast.success('Data tambahan berhasil dihapus');
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
        toast.success('Semua data tambahan berhasil dibersihkan');
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
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-[#0056b3] rounded-xl">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 font-title">
                Input Data Tambahan
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Penginputan peserta tambahan yang otomatis tersimpan ke database Supabase dan tercatat di Google Spreadsheet sheet <strong>Data_tambahan</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScriptModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-[#0056b3] rounded-xl text-xs font-bold transition-all border border-blue-200 shadow-xs"
            >
              <Code2 className="w-4 h-4" />
              <span>Kode Apps Script (Code.gs) & Set URL</span>
            </button>
          </div>
        </div>

        {/* Petunjuk Sinkronisasi Otomatis Spreadsheet */}
        <div className="mt-4 p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Kenapa data belum muncul di Spreadsheet?</span> Diperlukan URL Web App Google Apps Script untuk menghubungkan website ke Spreadsheet. Klik tombol <strong>&quot;Kode Apps Script (Code.gs) &amp; Set URL&quot;</strong> di atas untuk memasang skrip dan menempelkan URL Web App Anda.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowScriptModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 self-start sm:self-auto transition-colors"
          >
            Buka Pengaturan Apps Script
          </button>
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
                placeholder="Contoh: TVYI, TSSD, TCJ2..."
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
                Alasan Tidak Hadir
              </label>
              {meta?.reasons && meta.reasons.length > 0 ? (
                <select
                  value={alasanTidakHadir}
                  onChange={(e) => setAlasanTidakHadir(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
                >
                  {meta.reasons.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={alasanTidakHadir}
                  onChange={(e) => setAlasanTidakHadir(e.target.value)}
                  placeholder="Contoh: Sakit, Cuti, Resign..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-[11px] text-gray-500 italic">
              Data yang Anda input akan langsung tersimpan di Supabase dan dikirim ke Spreadsheet (sheet Data_tambahan).
            </span>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 min-h-[42px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
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
                title="Hapus seluruh data tambahan dari sistem"
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
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Tombol Edit */}
                        <button
                          type="button"
                          onClick={() => setEditingRecord(r)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit baris data ini"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {/* Tombol Hapus */}
                        <button
                          type="button"
                          onClick={() => setDeleteSingleDialog({ isOpen: true, record: r, loading: false })}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
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
                  <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                    {loadingList ? 'Memuat data...' : 'Belum ada data tambahan yang tercatat.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Data Tambahan */}
      <EditDataTambahanModal
        isOpen={Boolean(editingRecord)}
        record={editingRecord}
        meta={meta}
        onClose={() => setEditingRecord(null)}
        onUpdated={fetchRecords}
      />

      {/* Dialog Konfirmasi Hapus 1 Baris */}
      <ConfirmDialog
        isOpen={deleteSingleDialog.isOpen}
        title="Hapus Data Tambahan"
        message={`Apakah Anda yakin ingin menghapus data peserta "${deleteSingleDialog.record?.nama}" (NIK: ${deleteSingleDialog.record?.nik})?`}
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
        message={`PERINGATAN: Tindakan ini akan menghapus seluruh (${records.length}) data tambahan yang ada di tabel. Apakah Anda yakin?`}
        confirmText="Hapus Semua Data"
        cancelText="Batal"
        isDanger={true}
        isLoading={deleteAllDialog.loading}
        onConfirm={confirmDeleteAll}
        onCancel={() => setDeleteAllDialog({ isOpen: false, loading: false })}
      />

      {/* Modal Kode & Panduan Google Apps Script */}
      <AppsScriptModal
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
      />
    </div>
  );
}
