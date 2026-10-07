// app/(app)/list-soft-skill/page.js
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
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
  X,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import ImportExportModal from '../../../components/ImportExportModal.js';
import ConfirmDialog from '../../../components/ConfirmDialog.js';

export default function ListSoftSkillPage() {
  const [loadingList, setLoadingList] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [meta, setMeta] = useState(null);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
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

  // Edit form state
  const [editForm, setEditForm] = useState({
    no: '',
    nik: '',
    nama: '',
    jabatan: '-',
    kategori: '-',
    detail_alasan: '-',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Load meta
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/meta');
        const json = await res.json();
        if (json.ok) setMeta(json.data);
      } catch (err) {
        console.error('Failed to load meta:', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/list-soft-skill');
      const json = await res.json();
      if (json.ok) {
        setRecords(json.data || []);
      } else {
        toast.error(json.error || 'Gagal memuat data soft skill');
      }
    } catch (err) {
      console.error('Failed to fetch list soft skill:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Open Edit Modal
  function openEdit(rec) {
    setEditingRecord(rec);
    setEditForm({
      no: rec.no || '',
      nik: rec.nik || '',
      nama: rec.nama || '',
      jabatan: rec.jabatan || '-',
      kategori: rec.kategori || rec.kategory || '-',
      detail_alasan: rec.detail_alasan || '-',
    });
  }

  // Save Edit
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingRecord) return;

    if (!editForm.nik.trim() || !editForm.nama.trim()) {
      toast.error('NIK dan Nama Peserta wajib diisi');
      return;
    }

    setSavingEdit(true);
    const toastId = toast.loading('Memperbarui data soft skill...');

    try {
      const res = await fetch(`/api/list-soft-skill/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Data soft skill berhasil diperbarui!', { id: toastId });
        setEditingRecord(null);
        fetchRecords();
      } else {
        toast.error(json.error || 'Gagal memperbarui data', { id: toastId });
      }
    } catch (err) {
      toast.error('Terjadi kesalahan: ' + err.message, { id: toastId });
    } finally {
      setSavingEdit(false);
    }
  }

  // Delete Single
  async function confirmDeleteSingle() {
    if (!deleteSingleDialog.record) return;
    setDeleteSingleDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/list-soft-skill/${deleteSingleDialog.record.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Data soft skill berhasil dihapus');
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

  // Delete All
  async function confirmDeleteAll() {
    setDeleteAllDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch('/api/list-soft-skill', {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Semua data list soft skill di cabang Anda berhasil dibersihkan');
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

  // Filter records
  const filteredRecords = records.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.nik && String(r.nik).toLowerCase().includes(term)) ||
      (r.nama && String(r.nama).toLowerCase().includes(term)) ||
      (r.jabatan && String(r.jabatan).toLowerCase().includes(term)) ||
      (r.detail_alasan && String(r.detail_alasan).toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-gray-900 font-title">
                  List Soft Skill
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-indigo-100 text-indigo-800">
                  Sheet: list_soft_skill
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Kelola data peserta gagal/tidak hadir training soft skill cabang yang langsung terintegrasi dengan Berita Acara Soft Skill di menu Cetak Bukti PDF.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tombol Impor Excel/CSV */}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200/80"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Impor Excel/CSV</span>
            </button>

            {/* Tombol Ekspor XLSX */}
            <a
              href="/api/list-soft-skill/export?format=xlsx"
              download
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all border border-emerald-200/80"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Excel</span>
            </a>

            {/* Tombol Ekspor CSV */}
            <a
              href="/api/list-soft-skill/export?format=csv"
              download
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-all border border-teal-200/80"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </a>

            {/* Tombol Refresh */}
            <button
              type="button"
              onClick={fetchRecords}
              disabled={loadingList}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Data Soft Skill */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <TableProperties className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900 font-title">
              Daftar Peserta Soft Skill ({filteredRecords.length} Baris)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Input Pencarian */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari NIK, nama, atau alasan..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* Tombol Hapus Semua Data */}
            {records.length > 0 && (
              <button
                type="button"
                onClick={() => setDeleteAllDialog({ isOpen: true, loading: false })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all shrink-0 border border-red-200/80"
              >
                <Trash className="w-3.5 h-3.5" />
                <span>Hapus Semua</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-100/80 text-gray-700 uppercase font-bold tracking-wider border-b border-gray-200">
                <th className="p-3 text-center w-12">No</th>
                <th className="p-3 text-center w-28">NIK</th>
                <th className="p-3">Nama Peserta</th>
                <th className="p-3">Jabatan</th>
                <th className="p-3 text-center">Kategori</th>
                <th className="p-3">Detail Alasan</th>
                <th className="p-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingList ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      <span>Memuat data soft skill...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="p-3 text-center font-bold text-gray-700">{r.no || i + 1}</td>
                    <td className="p-3 text-center font-mono font-bold text-gray-900">{r.nik}</td>
                    <td className="p-3 font-semibold text-gray-900 uppercase">{r.nama}</td>
                    <td className="p-3 font-medium text-gray-700">{r.jabatan || '-'}</td>
                    <td className="p-3 text-center font-medium text-gray-700">{r.kategori || r.kategory || '-'}</td>
                    <td className="p-3 font-medium text-gray-600">{r.detail_alasan || '-'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit baris ini"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteSingleDialog({ isOpen: true, record: r, loading: false })}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus baris ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                    Belum ada data soft skill. Silakan impor dari file Excel/CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Record */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-title">
                    Edit Data Soft Skill
                  </h2>
                  <p className="text-xs text-gray-500">
                    Baris No. #{editForm.no || '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    NIK Peserta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.nik}
                    onChange={(e) => setEditForm({ ...editForm, nik: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Nama Peserta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.nama}
                    onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-medium uppercase focus:bg-white focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Jabatan</label>
                  <input
                    type="text"
                    value={editForm.jabatan}
                    onChange={(e) => setEditForm({ ...editForm, jabatan: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={editForm.kategori}
                    onChange={(e) => setEditForm({ ...editForm, kategori: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Detail Alasan</label>
                <textarea
                  rows={3}
                  value={editForm.detail_alasan}
                  onChange={(e) => setEditForm({ ...editForm, detail_alasan: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Impor File Excel/CSV */}
      <ImportExportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => fetchRecords()}
        importEndpoint="/api/list-soft-skill/import"
        title="Impor List Soft Skill (list_soft_skill)"
      />

      {/* Dialog Konfirmasi Hapus Single */}
      <ConfirmDialog
        isOpen={deleteSingleDialog.isOpen}
        title="Hapus Data Soft Skill"
        message={`Apakah Anda yakin ingin menghapus data peserta "${deleteSingleDialog.record?.nama}" (${deleteSingleDialog.record?.nik})?`}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteSingleDialog.loading}
        onConfirm={confirmDeleteSingle}
        onCancel={() => setDeleteSingleDialog({ isOpen: false, record: null, loading: false })}
      />

      {/* Dialog Konfirmasi Hapus Semua */}
      <ConfirmDialog
        isOpen={deleteAllDialog.isOpen}
        title="Bersihkan Semua Data Soft Skill"
        message="PERINGATAN: Seluruh data list soft skill di cabang Anda akan dihapus permanen. Tindakan ini tidak dapat dibatalkan!"
        confirmLabel="Ya, Hapus Semua"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteAllDialog.loading}
        onConfirm={confirmDeleteAll}
        onCancel={() => setDeleteAllDialog({ isOpen: false, loading: false })}
      />
    </div>
  );
}
