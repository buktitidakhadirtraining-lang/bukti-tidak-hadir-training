// app/(app)/rekap/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  Download,
  Printer,
  PlusCircle,
  Eye,
  Edit2,
  Trash2,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  ExternalLink,
  Check,
  X,
  UploadCloud,
} from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog.js';
import FilePreviewModal from '../../../components/FilePreviewModal.js';
import EditRecordModal from '../../../components/EditRecordModal.js';
import EmptyState from '../../../components/EmptyState.js';
import { TableSkeleton } from '../../../components/Skeleton.js';
import { MONTHS, formatDateIndo } from '../../../lib/config.js';

export default function RekapPage() {
  const [meta, setMeta] = useState(null);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
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
          setPagination(json.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
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
        toast.success('Data dan bukti di Google Drive berhasil dihapus');
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
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-title tracking-tight">
            Rekap Data Ketidakhadiran
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Kelola, telusuri, dan ekspor riwayat ketidakhadiran peserta training se-Indonesia.
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
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan NIK atau Nama Peserta..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Cabang (Admin Pusat) */}
          {isAdminPusat && (
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Cabang
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
              >
                <option value="">Semua Cabang</option>
                {meta?.branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Jenis Training */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Training
            </label>
            <select
              value={trainingId}
              onChange={(e) => setTrainingId(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
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
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Jabatan
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
            >
              <option value="">Semua Jabatan</option>
              {meta?.positions?.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          {/* Batch */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Batch
            </label>
            <select
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
            >
              <option value="">Semua Batch</option>
              {meta?.batches?.slice(0, 30).map((b) => (
                <option key={b} value={b}>
                  Batch {b}
                </option>
              ))}
            </select>
          </div>

          {/* Bulan */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Bulan
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
            >
              <option value="">Semua Bulan</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Bukti */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Status Bukti
            </label>
            <select
              value={hasProof}
              onChange={(e) => setHasProof(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
            >
              <option value="">Semua</option>
              <option value="true">Ada Bukti</option>
              <option value="false">Belum Ada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : records.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak ada data ditemukan"
              message="Coba ubah filter atau kata kunci pencarian Anda, atau input data baru."
              action={
                <Link
                  href="/input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#0056b3] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Input Data Baru</span>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">NIK</th>
                  <th className="py-3 px-4">Nama Peserta</th>
                  <th className="py-3 px-4">Jabatan</th>
                  {isAdminPusat && <th className="py-3 px-4">Cabang</th>}
                  <th className="py-3 px-4">Training</th>
                  <th className="py-3 px-4 text-center">Batch</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Alasan</th>
                  <th className="py-3 px-4 text-center">Bukti Acara</th>
                  <th className="py-3 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {records.map((row, idx) => {
                  const rowNumber = (pagination.page - 1) * pagination.limit + idx + 1;
                  return (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4 text-center font-semibold text-gray-400">
                        {rowNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {row.nik}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        {row.nama_peserta}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 truncate max-w-[150px]">
                        {row.jabatan}
                      </td>
                      {isAdminPusat && (
                        <td className="py-3.5 px-4 font-semibold text-gray-700">
                          {row.branches?.name || '-'}
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-gray-800 font-medium truncate max-w-[170px]">
                        {row.training_types?.name || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-700">
                        B-{row.batch}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                        {row.tanggal_pelaksanaan}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
                          {row.absence_reasons?.name || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {row.drive_file_id ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewModal({
                                isOpen: true,
                                recordId: row.id,
                                fileName: row.drive_file_name,
                                mimeType: row.file_mime_type,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors"
                            title="Klik untuk melihat bukti berita acara"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat File</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic font-medium">
                            Belum Ada
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {row.drive_file_id && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewModal({
                                  isOpen: true,
                                  recordId: row.id,
                                  fileName: row.drive_file_name,
                                  mimeType: row.file_mime_type,
                                })
                              }
                              className="p-1.5 text-gray-500 hover:text-[#0056b3] hover:bg-blue-50 rounded-lg transition-colors"
                              title="Lihat Pratinjau Bukti"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setEditModal({
                                isOpen: true,
                                record: row,
                                isLoading: false,
                              })
                            }
                            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Data Catatan & Bukti"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteDialog({
                                isOpen: true,
                                record: row,
                                isLoading: false,
                              })
                            }
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus Catatan"
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
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 bg-gray-50/50">
          <div>
            Menampilkan{' '}
            <span className="font-bold text-gray-900">
              {records.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{' '}
            hingga{' '}
            <span className="font-bold text-gray-900">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            dari <span className="font-bold text-gray-900">{pagination.total}</span> data
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRecords(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>
            <span className="px-2 font-bold text-gray-900">
              {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => fetchRecords(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, recordId: null, fileName: '', mimeType: '' })}
        recordId={previewModal.recordId}
        fileName={previewModal.fileName}
        mimeType={previewModal.mimeType}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Hapus Data Ketidakhadiran"
        message="Apakah Anda yakin ingin menghapus catatan ketidakhadiran ini? Perhatian: Berkas bukti berita acara yang tersimpan di Google Drive cabang juga akan ikut terhapus secara permanen."
        recordDetails={
          deleteDialog.record
            ? {
                nik: deleteDialog.record.nik,
                nama: deleteDialog.record.nama_peserta,
                training: deleteDialog.record.training_types?.name,
                tanggal: deleteDialog.record.tanggal_pelaksanaan,
              }
            : null
        }
        confirmText="Ya, Hapus Permanen"
        cancelText="Batal"
        danger={true}
        isLoading={deleteDialog.isLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, record: null, isLoading: false })}
      />

      {/* Edit Record Modal */}
      <EditRecordModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, record: null, isLoading: false })}
        record={editModal.record}
        meta={meta}
        onUpdated={(updatedRecord) => {
          setRecords((prev) =>
            prev.map((r) => (r.id === updatedRecord.id ? { ...r, ...updatedRecord } : r))
          );
          fetchRecords(pagination.page);
        }}
      />
    </div>
  );
}
