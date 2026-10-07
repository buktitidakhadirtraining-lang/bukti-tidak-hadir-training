// app/(app)/list-soft-skill/page.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Download,
  Printer,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  FileDown,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Eye,
  GraduationCap,
} from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog.js';

export default function ListSoftSkillPage() {
  const [meta, setMeta] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // Import File Ref & Preview Modal
  const fileInputRef = useRef(null);
  const [importing, setSavingImport] = useState(false);
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    rows: [],
    totalRows: 0,
  });

  // Delete All Confirm Dialog
  const [deleteAllDialog, setDeleteAllDialog] = useState({
    isOpen: false,
    loading: false,
  });

  // Load Meta
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/meta');
        const json = await res.json();
        if (json.ok) setMeta(json.data);
      } catch (err) {
        console.error('Error loading meta:', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch Records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/list-soft-skill');
      const json = await res.json();
      if (json.ok) {
        setRecords(json.data || []);
      } else {
        toast.error(json.error || 'Gagal memuat data list soft skill');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Handle File Selection for Import (Preview First)
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const toastId = toast.loading('Memeriksa dan membaca berkas...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preview', 'true');

      const res = await fetch('/api/list-soft-skill/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.ok && json.preview) {
        toast.dismiss(toastId);
        setPreviewModal({
          isOpen: true,
          rows: json.rows || [],
          totalRows: json.totalRows || (json.rows || []).length,
        });
      } else {
        toast.error(json.error || 'Gagal membaca berkas impor', { id: toastId, duration: 6000 });
      }
    } catch (err) {
      toast.error('Terjadi kesalahan: ' + err.message, { id: toastId });
    }
  }

  // Handle Confirm Save Import Data
  async function handleConfirmSaveImport() {
    if (!previewModal.rows || previewModal.rows.length === 0) return;

    setSavingImport(true);
    const toastId = toast.loading('Menyimpan data List Soft Skill ke Supabase...');

    try {
      const res = await fetch('/api/list-soft-skill/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          rows: previewModal.rows,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(json.message || 'Data List Soft Skill berhasil disimpan!', { id: toastId });
        setPreviewModal({ isOpen: false, rows: [], totalRows: 0 });
        fetchRecords();
      } else {
        toast.error(json.error || 'Gagal menyimpan data ke database', { id: toastId });
      }
    } catch (err) {
      toast.error('Terjadi kesalahan: ' + err.message, { id: toastId });
    } finally {
      setSavingImport(false);
    }
  }

  // Handle Clear All Data
  async function handleClearAllConfirm() {
    setDeleteAllDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/list-soft-skill', { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Semua data List Soft Skill cabang berhasil dihapus');
        setDeleteAllDialog({ isOpen: false, loading: false });
        fetchRecords();
      } else {
        toast.error(json.error || 'Gagal menghapus data');
        setDeleteAllDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      toast.error('Kesalahan koneksi saat menghapus data');
      setDeleteAllDialog((prev) => ({ ...prev, loading: false }));
    }
  }

  // Filtered & Paginated Data
  const filteredRecords = records.filter((r) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      String(r.nik || '').toLowerCase().includes(query) ||
      String(r.nama || '').toLowerCase().includes(query) ||
      String(r.jabatan || '').toLowerCase().includes(query) ||
      String(r.kategory || r.kategori || '').toLowerCase().includes(query) ||
      String(r.detail_alasan || '').toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredRecords.length / limit) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * limit, currentPage * limit);

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Header Halaman */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-title tracking-tight flex items-center gap-2">
              <GraduationCap className="w-7 h-7 text-[#0056b3]" />
              List Soft Skill
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056b3] text-[11px] font-bold border border-blue-200">
              Impor & Ekspor (Read-Only)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Menu khusus impor/ekspor data peserta Soft Skill per cabang.
          </p>
        </div>

        {/* Tombol Aksi Utama */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tombol Impor Data */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer min-h-[40px]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Impor Data (.xlsx/.csv)</span>
          </button>

          {/* Tombol Unduh Template */}
          <a
            href="/api/list-soft-skill/export?template=true"
            download
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[40px]"
            title="Unduh format template Excel kosong"
          >
            <FileDown className="w-4 h-4 text-amber-600" />
            <span>Unduh Template</span>
          </a>

          {/* Tombol Ekspor Excel */}
          <a
            href="/api/list-soft-skill/export?format=xlsx"
            download
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[40px]"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Excel</span>
          </a>

          {/* Tombol Ekspor CSV */}
          <a
            href="/api/list-soft-skill/export?format=csv"
            download
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[40px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-gray-500" />
            <span>CSV</span>
          </a>

          {/* Cetak PDF */}
          <Link
            href="/cetak"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs sm:text-sm font-bold transition-all min-h-[40px]"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            <span>Cetak PDF</span>
          </Link>
        </div>
      </div>

      {/* Baris Filter & Cari */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Box Pencarian */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari NIK, Nama, Jabatan..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#0056b3] focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            {/* Tombol Hapus Semua Data Cabang */}
            {records.length > 0 && (
              <button
                type="button"
                onClick={() => setDeleteAllDialog({ isOpen: true, loading: false })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua Data</span>
              </button>
            )}

            {/* Total Data Badge */}
            <div className="text-xs text-gray-500 font-semibold bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
              Total Data: <span className="font-bold text-[#0056b3]">{filteredRecords.length}</span>
            </div>
          </div>
        </div>

        {/* Tabel Data Read-Only (Exact 5 Header Columns: NIK | Nama | Jabatan | Kategory | Detail Alasan) */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-800 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <th className="px-4 py-3 text-center border-r border-gray-200 w-36">NIK</th>
                <th className="px-4 py-3 border-r border-gray-200">Nama</th>
                <th className="px-4 py-3 border-r border-gray-200">Jabatan</th>
                <th className="px-4 py-3 text-center border-r border-gray-200 w-32">Kategory</th>
                <th className="px-4 py-3">Detail Alasan</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-[#0056b3]" />
                      <span>Memuat data List Soft Skill...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <GraduationCap className="w-10 h-10 text-gray-300 mx-auto" />
                      <p className="font-bold text-gray-700">Belum ada data List Soft Skill</p>
                      <p className="text-xs text-gray-400">
                        Gunakan tombol <strong>&quot;Impor Data&quot;</strong> di atas untuk mengunggah berkas Excel/CSV.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 text-center font-mono font-bold text-gray-800 border-r border-gray-100">
                      {String(row.nik || '-')}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 uppercase border-r border-gray-100">
                      {row.nama || '-'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700 border-r border-gray-100">
                      {row.jabatan || '-'}
                    </td>
                    <td className="px-4 py-3 text-center border-r border-gray-100">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-100 text-[#0056b3] text-[11px] font-bold uppercase">
                        {row.kategory || row.kategori || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {row.detail_alasan || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-gray-500 font-medium">
              Menampilkan {Math.min((currentPage - 1) * limit + 1, filteredRecords.length)} -{' '}
              {Math.min(currentPage * limit, filteredRecords.length)} dari {filteredRecords.length} data
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs font-bold text-gray-800">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Preview Impor Sebelum Simpan */}
      {previewModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 bg-blue-50/70 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900 font-title flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#0056b3]" />
                  Preview Data List Soft Skill
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Ditemukan <strong className="text-[#0056b3]">{previewModal.totalRows} baris</strong> data valid.
                  Silakan periksa sebelum disimpan.
                </p>
              </div>
              <button
                onClick={() => setPreviewModal({ isOpen: false, rows: [], totalRows: 0 })}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Table */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Data ini akan disimpan ke tabel <strong>list_soft_skill</strong> untuk cabang Anda (
                  <strong>{meta?.userBranchName || 'Cabang Aktif'}</strong>).
                </span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 font-bold uppercase text-[10px] text-gray-700 sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-center border-r border-gray-200 w-32">NIK</th>
                      <th className="px-3 py-2 border-r border-gray-200">Nama</th>
                      <th className="px-3 py-2 border-r border-gray-200">Jabatan</th>
                      <th className="px-3 py-2 text-center border-r border-gray-200">Kategory</th>
                      <th className="px-3 py-2">Detail Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewModal.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center font-mono font-bold border-r border-gray-100">{row.nik}</td>
                        <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-100">{row.nama}</td>
                        <td className="px-3 py-2 border-r border-gray-100">{row.jabatan}</td>
                        <td className="px-3 py-2 text-center border-r border-gray-100">{row.kategory || row.kategori}</td>
                        <td className="px-3 py-2">{row.detail_alasan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewModal({ isOpen: false, rows: [], totalRows: 0 })}
                disabled={importing}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveImport}
                disabled={importing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi & Simpan ({previewModal.totalRows} Baris)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog Hapus Semua Data */}
      <ConfirmDialog
        isOpen={deleteAllDialog.isOpen}
        title="Hapus Semua Data List Soft Skill?"
        message="Tindakan ini akan menghapus seluruh data List Soft Skill milik cabang Anda. Data yang dihapus tidak dapat dikembalikan."
        confirmLabel="Ya, Hapus Semua"
        cancelLabel="Batal"
        isLoading={deleteAllDialog.loading}
        onConfirm={handleClearAllConfirm}
        onCancel={() => setDeleteAllDialog({ isOpen: false, loading: false })}
      />
    </div>
  );
}
