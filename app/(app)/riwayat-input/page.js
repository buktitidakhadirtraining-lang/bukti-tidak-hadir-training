// app/(app)/riwayat-input/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  Edit2,
  Trash2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  ExternalLink,
  Check,
  X,
  Database,
  Building2,
  Calendar,
  Image as ImageIcon,
} from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog.js';
import FilePreviewModal from '../../../components/FilePreviewModal.js';
import EditRecordModal from '../../../components/EditRecordModal.js';
import EmptyState from '../../../components/EmptyState.js';
import { TableSkeleton } from '../../../components/Skeleton.js';
import { MONTHS, formatDateIndo } from '../../../lib/config.js';

export default function RiwayatInputPage() {
  const [meta, setMeta] = useState(null);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [position, setPosition] = useState('');
  const [batch, setBatch] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [hasProof, setHasProof] = useState('');

  // Dialog & Modal States
  const [previewModal, setPreviewModal] = useState({ isOpen: false, recordId: null, fileName: '', mimeType: '' });
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, record: null, isLoading: false });
  const [editModal, setEditModal] = useState({ isOpen: false, record: null, isLoading: false });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Load Metadata
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/meta');
        const json = await res.json();
        if (json.ok) {
          setMeta(json.data);
        }
      } catch (err) {
        console.error('Error loading meta:', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch Records
  const fetchRecords = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(pagination.limit));
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (branchId) params.set('branch_id', branchId);
        if (trainingId) params.set('training_id', trainingId);
        if (position) params.set('position', position);
        if (batch) params.set('batch', batch);
        if (month) params.set('month', month);
        if (year) params.set('year', year);
        if (hasProof) params.set('has_proof', hasProof);

        const res = await fetch(`/api/records?${params.toString()}`);
        const json = await res.json();
        if (json.ok) {
          setRecords(json.data || []);
          setPagination(json.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
        } else {
          toast.error(json.error || 'Gagal mengambil data');
        }
      } catch (err) {
        toast.error('Terjadi kesalahan saat memuat data');
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, debouncedSearch, branchId, trainingId, position, batch, month, year, hasProof]
  );

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);

  // Delete Record Handler
  async function handleDeleteConfirm() {
    const record = deleteDialog.record;
    if (!record) return;

    setDeleteDialog((prev) => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch(`/api/records/${record.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Data dan bukti berhasil dihapus');
        setDeleteDialog({ isOpen: false, record: null, isLoading: false });
        fetchRecords(pagination.page);
      } else {
        toast.error(json.error || 'Gagal menghapus data');
        setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      toast.error('Kesalahan jaringan saat menghapus data');
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }));
    }
  }

  // Export URLs
  function getExportUrl(format) {
    const params = new URLSearchParams();
    params.set('format', format);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (branchId) params.set('branch_id', branchId);
    if (trainingId) params.set('training_id', trainingId);
    if (position) params.set('position', position);
    if (batch) params.set('batch', batch);
    if (month) params.set('month', month);
    if (year) params.set('year', year);
    if (hasProof) params.set('has_proof', hasProof);
    return `/api/records/export?${params.toString()}`;
  }

  const isAdminPusat = meta?.userRole === 'admin_pusat';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-title tracking-tight flex items-center gap-2">
              <Database className="w-7 h-7 text-[#0056b3]" />
              Riwayat Data Hasil Input
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056b3] text-[11px] font-bold border border-blue-200">
              Input Data & Bukti Foto
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Daftar seluruh riwayat data ketidakhadiran & foto bukti yang diinput melalui menu Input Data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={getExportUrl('xlsx')}
            download
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[40px]"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Excel</span>
          </a>
          <a
            href={getExportUrl('csv')}
            download
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[40px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-gray-500" />
            <span>CSV</span>
          </a>
          <Link
            href="/cetak"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[40px]"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak PDF</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Box */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-soft space-y-4">
        {/* Search Bar & Refresh */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari NIK atau nama peserta..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#0056b3] focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchRecords(pagination.page)}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-bold transition-all disabled:opacity-50 min-h-[42px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-gray-100">
          {/* Filter Cabang (Khusus Admin Pusat) */}
          {isAdminPusat && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Cabang
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-[#0056b3]"
              >
                <option value="">Semua Cabang</option>
                {meta?.branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Jenis Training */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Jenis Training
            </label>
            <select
              value={trainingId}
              onChange={(e) => setTrainingId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-[#0056b3]"
            >
              <option value="">Semua Training</option>
              {meta?.trainings?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Jabatan */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Jabatan
            </label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Filter jabatan..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-[#0056b3]"
            />
          </div>

          {/* Batch */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Batch
            </label>
            <input
              type="number"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="Contoh: 1"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-[#0056b3]"
            />
          </div>

          {/* Bulan */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Bulan Pelaksanaan
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-[#0056b3]"
            >
              <option value="">Semua Bulan</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bukti Foto */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Bukti Foto
            </label>
            <select
              value={hasProof}
              onChange={(e) => setHasProof(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-[#0056b3]"
            >
              <option value="">Semua</option>
              <option value="true">Ada Bukti Foto</option>
              <option value="false">Tanpa Bukti Foto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : records.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak Ada Data Input"
              description="Belum ada data ketidakhadiran yang cocok dengan kriteria pencarian/filter Anda."
              actionLabel="Input Data Baru"
              actionHref="/input"
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                    <th className="p-3.5 text-center border-r border-gray-200 w-12">NO</th>
                    {isAdminPusat && <th className="p-3.5 border-r border-gray-200">Cabang</th>}
                    <th className="p-3.5 border-r border-gray-200">NIK & Peserta</th>
                    <th className="p-3.5 border-r border-gray-200">Jenis Training</th>
                    <th className="p-3.5 border-r border-gray-200">Jabatan & Toko</th>
                    <th className="p-3.5 border-r border-gray-200">Tanggal / Alasan</th>
                    <th className="p-3.5 text-center border-r border-gray-200">Bukti Foto</th>
                    <th className="p-3.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r, i) => {
                    const rowNumber = (pagination.page - 1) * pagination.limit + i + 1;
                    const hasFile = Boolean(r.drive_file_id);

                    return (
                      <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                        {/* NO */}
                        <td className="p-3.5 text-center font-bold text-gray-500 border-r border-gray-100">
                          {rowNumber}
                        </td>

                        {/* Cabang (jika admin pusat) */}
                        {isAdminPusat && (
                          <td className="p-3.5 border-r border-gray-100 font-semibold text-gray-700">
                            {r.branches?.name || '-'}
                          </td>
                        )}

                        {/* NIK & Nama Peserta */}
                        <td className="p-3.5 border-r border-gray-100">
                          <p className="font-bold text-gray-900 uppercase">{r.nama_peserta}</p>
                          <p className="text-[11px] font-mono font-semibold text-gray-500 mt-0.5">
                            NIK: {r.nik}
                          </p>
                        </td>

                        {/* Jenis Training */}
                        <td className="p-3.5 border-r border-gray-100">
                          <p className="font-bold text-[#0056b3] uppercase">
                            {r.training_types?.name || '-'}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Batch {r.batch || 1}
                          </p>
                        </td>

                        {/* Jabatan & Toko */}
                        <td className="p-3.5 border-r border-gray-100">
                          <p className="font-semibold text-gray-800">{r.jabatan || '-'}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 uppercase truncate max-w-[180px]">
                            {r.keterangan || '-'}
                          </p>
                        </td>

                        {/* Tanggal & Alasan */}
                        <td className="p-3.5 border-r border-gray-100">
                          <p className="font-semibold text-gray-900">
                            {formatDateIndo(r.tanggal_pelaksanaan)}
                          </p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold">
                            {r.absence_reasons?.name || 'Sakit'}
                          </span>
                        </td>

                        {/* Bukti Foto */}
                        <td className="p-3.5 text-center border-r border-gray-100">
                          {hasFile ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewModal({
                                  isOpen: true,
                                  recordId: r.id,
                                  fileName: r.drive_file_name || 'Bukti_Foto.jpg',
                                  mimeType: r.file_mime_type || 'image/jpeg',
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0056b3] rounded-lg text-xs font-bold transition-all border border-blue-200"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Lihat Foto</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">Tidak ada foto</span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditModal({ isOpen: true, record: r, isLoading: false })}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Data"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteDialog({ isOpen: true, record: r, isLoading: false })}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus Data"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 font-medium">
              <div>
                Menampilkan {(pagination.page - 1) * pagination.limit + 1} -{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} dari{' '}
                <span className="font-bold text-gray-900">{pagination.total}</span> data
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fetchRecords(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-bold text-gray-800">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => fetchRecords(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Preview Bukti Foto */}
      {previewModal.isOpen && (
        <FilePreviewModal
          isOpen={previewModal.isOpen}
          recordId={previewModal.recordId}
          fileName={previewModal.fileName}
          mimeType={previewModal.mimeType}
          onClose={() => setPreviewModal({ isOpen: false, recordId: null, fileName: '', mimeType: '' })}
        />
      )}

      {/* Modal Edit Record */}
      {editModal.isOpen && (
        <EditRecordModal
          isOpen={editModal.isOpen}
          record={editModal.record}
          meta={meta}
          onClose={() => setEditModal({ isOpen: false, record: null, isLoading: false })}
          onSuccess={() => fetchRecords(pagination.page)}
        />
      )}

      {/* Confirm Dialog Delete Record */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Hapus Data Input Peserta"
        message={`Apakah Anda yakin ingin menghapus data peserta "${deleteDialog.record?.nama_peserta}" (NIK: ${deleteDialog.record?.nik}) beserta file bukti fotonya?`}
        confirmLabel="Ya, Hapus Data"
        cancelLabel="Batal"
        isLoading={deleteDialog.isLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, record: null, isLoading: false })}
      />
    </div>
  );
}
