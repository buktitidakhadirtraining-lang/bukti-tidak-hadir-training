// app/(app)/list-tidak-hadir/page.js
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Loader2,
  RefreshCw,
  Search,
  TableProperties,
  Trash2,
  Trash,
  UploadCloud,
  Building2,
  Database,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import ImportExportModal from '../../../components/ImportExportModal.js';
import ConfirmDialog from '../../../components/ConfirmDialog.js';
import SqlEditorModal from '../../../components/SqlEditorModal.js';

export default function ListTidakHadirPage() {
  const [loadingList, setLoadingList] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [meta, setMeta] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Modals
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
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

  // Ambil data list tidak hadir cabang yang sedang login
  const fetchRecords = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/list-tidak-hadir');
      const json = await res.json();
      if (json.ok) {
        setRecords(json.data || []);
      } else {
        toast.error(json.error || 'Gagal memuat data');
      }
    } catch (err) {
      console.error('Failed to fetch list tidak hadir:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Hapus single data
  async function confirmDeleteSingle() {
    if (!deleteSingleDialog.record) return;
    setDeleteSingleDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/list-tidak-hadir/${deleteSingleDialog.record.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Data peserta berhasil dihapus');
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
      const res = await fetch('/api/list-tidak-hadir', {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Semua data peserta tidak hadir di cabang Anda berhasil dibersihkan');
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
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-gray-900 font-title">
                  List Tidak Hadir Training
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056b3] text-[11px] font-bold border border-blue-200">
                  Impor & Ekspor (Read-Only)
                </span>
                {currentUser?.branch_name && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    <Building2 className="w-3 h-3" />
                    <span>{currentUser.branch_name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Pengelolaan daftar peserta tidak hadir khusus cabang Anda (Read-Only). Data tersimpan aman dan terisolasi dari cabang lain.
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Impor / Ekspor Excel/CSV</span>
            </button>

            <Link
              href="/cetak"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all border border-gray-200"
            >
              <Printer className="w-4 h-4 text-gray-600" />
              <span>Cetak PDF</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabel Data List Tidak Hadir */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TableProperties className="w-5 h-5 text-gray-600" />
            <h2 className="text-base font-bold text-gray-900 font-title">
              Daftar List Tidak Hadir Tersimpan ({filteredRecords.length} Data)
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
                title="Hapus seluruh data peserta tidak hadir di cabang ini"
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
                <th className="p-3 text-center w-12 border-r border-gray-200">NO</th>
                <th className="p-3 w-28 border-r border-gray-200">TRAINING</th>
                <th className="p-3 text-center w-28 border-r border-gray-200">NIK</th>
                <th className="p-3 border-r border-gray-200">NAMA</th>
                <th className="p-3 text-center w-24 border-r border-gray-200">KD TOKO</th>
                <th className="p-3 w-36 border-r border-gray-200">NAMA TOKO</th>
                <th className="p-3 w-40 border-r border-gray-200">ALASAN TIDAK HADIR</th>
                <th className="p-3 text-center w-20">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 text-center font-bold text-gray-500 border-r border-gray-100">{r.no || i + 1}</td>
                    <td className="p-3 font-semibold text-blue-700 uppercase border-r border-gray-100">{r.training}</td>
                    <td className="p-3 text-center font-mono font-bold text-gray-800 border-r border-gray-100">{r.nik}</td>
                    <td className="p-3 font-semibold text-gray-900 uppercase border-r border-gray-100">{r.nama}</td>
                    <td className="p-3 text-center font-mono uppercase text-gray-600 border-r border-gray-100">{r.kd_toko || '-'}</td>
                    <td className="p-3 uppercase text-gray-700 border-r border-gray-100">{r.nama_toko || '-'}</td>
                    <td className="p-3 text-gray-700 border-r border-gray-100">{r.alasan_tidak_hadir || '-'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center">
                        {/* Tombol Hapus Baris */}
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
                    {loadingList ? 'Memuat data...' : 'Belum ada data peserta tidak hadir yang tercatat di cabang Anda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Impor / Ekspor Excel / CSV */}
      <ImportExportModal
        isOpen={showImportExportModal}
        onClose={() => setShowImportExportModal(false)}
        title="Impor / Ekspor List Tidak Hadir Training"
        targetName="List Tidak Hadir"
        importEndpoint="/api/list-tidak-hadir/import"
        exportEndpoint="/api/list-tidak-hadir/export"
        currentRecords={records}
        onSuccess={fetchRecords}
      />

      {/* Dialog Konfirmasi Hapus 1 Baris */}
      <ConfirmDialog
        isOpen={deleteSingleDialog.isOpen}
        title="Hapus Data Peserta Tidak Hadir"
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
        title="Hapus Semua Data Peserta Tidak Hadir"
        message={`PERINGATAN: Tindakan ini akan menghapus seluruh (${records.length}) data peserta tidak hadir di cabang Anda. Apakah Anda yakin?`}
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
