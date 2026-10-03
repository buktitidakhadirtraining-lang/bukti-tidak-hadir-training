// app/(app)/cetak/page.js
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Printer,
  Download,
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  LayoutGrid,
  ListOrdered,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { LOGO_URL, formatDateIndo } from '../../../lib/config.js';

// Komponen gambar bukti yang tajam dan aman
function ProofImage({ recordId, src, alt, onLoaded }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      crossOrigin="anonymous"
      className="max-h-[175px] max-w-full w-auto h-auto object-contain mx-auto"
      style={{
        imageRendering: 'auto',
        WebkitPrintColorAdjust: 'exact',
      }}
      onLoad={() => onLoaded && onLoaded(recordId)}
      onError={() => onLoaded && onLoaded(recordId)}
    />
  );
}

export default function CetakPage() {
  const [meta, setMeta] = useState(null);
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Format Cetak: 'lama' (Grid Vertikal) atau 'horizontal' (Grid Horizontal 4 Kolom)
  const [printFormat, setPrintFormat] = useState('horizontal');

  // Filters
  const [branchId, setBranchId] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [batch, setBatch] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [trainerName, setTrainerName] = useState('Budi Setiawan');
  const [managerName, setManagerName] = useState('Hendra Wijaya');

  // Tracking loaded images for Format Horizontal
  const [loadedImageIds, setLoadedImageIds] = useState(new Set());

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/meta');
        const json = await res.json();
        if (json.ok) {
          setMeta(json.data);
          if (json.data.userRole !== 'admin_pusat' && json.data.userBranchId) {
            setBranchId(json.data.userBranchId);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadMeta();
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Batasi maksimal 400 data per cetak
      params.set('limit', '400');
      if (branchId) params.set('branch_id', branchId);
      if (trainingId) params.set('training_id', trainingId);
      if (batch) params.set('batch', batch);
      if (month) params.set('month', month);
      if (year) params.set('year', year);

      const res = await fetch(`/api/records?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setRecords(json.data || []);
        setTotalCount(json.pagination?.total || (json.data || []).length);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [branchId, trainingId, batch, month, year]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Total foto bukti yang harus dimuat (bukan PDF dan ada drive_file_id)
  const imageProofRecords = useMemo(() => {
    return records.filter(
      (r) =>
        r.drive_file_id &&
        (!r.file_mime_type || r.file_mime_type.startsWith('image/'))
    );
  }, [records]);

  const totalImagesToLoad = imageProofRecords.length;
  const loadedImagesCount = useMemo(() => {
    return records.filter((r) => loadedImageIds.has(r.id)).length;
  }, [records, loadedImageIds]);

  const isAllImagesLoaded =
    printFormat === 'lama' ||
    totalImagesToLoad === 0 ||
    loadedImagesCount >= totalImagesToLoad;

  const handleImageLoaded = useCallback((recordId) => {
    setLoadedImageIds((prev) => {
      if (prev.has(recordId)) return prev;
      const next = new Set(prev);
      next.add(recordId);
      return next;
    });
  }, []);

  function handlePrint() {
    window.print();
  }

  // Fungsi mengunduh berkas fisik berupa PDF langsung ke komputer/perangkat
  async function handleDownloadPdf() {
    if (downloadingPdf) return;
    if (records.length === 0) {
      toast.error('Tidak ada data ketidakhadiran untuk diunduh');
      return;
    }

    setDownloadingPdf(true);
    const toastId = toast.loading('Sedang memproses dan membuat berkas PDF...');

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const element = document.getElementById('printable-content');
      if (!element) {
        throw new Error('Elemen konten dokumen cetak tidak ditemukan');
      }

      const branchName = selectedBranchObj?.name ? `_${selectedBranchObj.name.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const period = year ? `_${year}` : '';
      const docType = printFormat === 'lama' ? 'Berita_Acara_Ketidakhadiran_Training' : 'Lampiran_Bukti_Tidak_Hadir_Training';
      const filename = `${docType}${branchName}${period}.pdf`;

      const opt = {
        margin: [5, 5, 5, 5],
        filename: filename,
        image: { type: 'png' }, // Lossless PNG untuk ketajaman tulisan 100% tanpa noise kompresi
        html2canvas: {
          scale: 4, // Super Ultra-HD 4K (4x High-Density Pixel Mapping)
          dpi: 300,
          letterRendering: true,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollY: 0,
          scrollX: 0,
          windowWidth: 1600,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'landscape',
          compress: true,
          precision: 16,
        },
        pagebreak: { mode: ['css', 'legacy'] },
      };

      await html2pdf().set(opt).from(element).save();
      toast.success('Berkas PDF berhasil diunduh ke folder Downloads!', { id: toastId });
    } catch (err) {
      console.error('[Download PDF Error]:', err);
      toast.error('Gagal mengunduh file PDF: ' + (err.message || 'Kesalahan sistem'), { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  }

  const selectedBranchObj = meta?.branches?.find((b) => b.id === branchId);
  const selectedTrainingObj = meta?.trainings?.find((t) => t.id === trainingId);

  // Helper url ekspor Excel sesuai filter aktif
  function getExcelExportUrl() {
    const params = new URLSearchParams();
    params.set('format', 'xlsx');
    if (branchId) params.set('branch_id', branchId);
    if (trainingId) params.set('training_id', trainingId);
    if (batch) params.set('batch', batch);
    if (month) params.set('month', month);
    if (year) params.set('year', year);
    return `/api/records/export?${params.toString()}`;
  }

  // Pengelompokan data per jenis training untuk Format Horizontal (Baru)
  const trainingGroups = useMemo(() => {
    const groups = records.reduce((acc, r) => {
      const tId = r.training_id || 'unassigned';
      const tName = r.training_types?.name || 'Tanpa Jenis Training';
      if (!acc[tId]) {
        acc[tId] = { id: tId, name: tName, records: [] };
      }
      acc[tId].records.push(r);
      return acc;
    }, {});
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  // Helper chunk array menjadi kelompok 4 item
  function chunkArray(array, size = 4) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden saat cetak) */}
      <div className="no-print bg-white p-5 rounded-2xl border border-gray-100 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/rekap"
              className="p-2 text-gray-500 hover:text-[#0056b3] hover:bg-blue-50 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-gray-900 font-title">
                Cetak Bukti Ketidakhadiran
              </h1>
              <p className="text-xs text-gray-500">
                Pilih format cetak dan filter data ketidakhadiran (A4 Landscape).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Progress status pemuatan gambar jika format horizontal */}
            {printFormat === 'horizontal' && totalImagesToLoad > 0 && !isAllImagesLoaded && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>
                  Memuat gambar {loadedImagesCount}/{totalImagesToLoad}
                </span>
              </div>
            )}

            {/* Tombol Unduh Excel */}
            <a
              href={getExcelExportUrl()}
              download
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[42px]"
              title="Unduh data sesuai filter aktif ke berkas Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel</span>
            </a>

            {/* Tombol Unduh PDF (Mengunduh file fisik .pdf) */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loading || records.length === 0 || downloadingPdf}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[42px] ${
                loading || records.length === 0 || downloadingPdf
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                  : 'bg-[#0056b3] hover:bg-blue-700 text-white'
              }`}
              title="Unduh langsung dokumen ini sebagai file berkas PDF (.pdf)"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengunduh PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Tombol Cetak (Membuka dialog cetak browser) */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || records.length === 0 || downloadingPdf}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all min-h-[42px] ${
                loading || records.length === 0 || downloadingPdf
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed shadow-none'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-xs'
              }`}
              title="Buka dialog cetak browser (Cetak ke printer fisik)"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {/* Pemilihan Format Cetak (Radio / Tab Selector) */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-700 mr-2">Format Cetak:</span>
            <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setPrintFormat('lama')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printFormat === 'lama'
                    ? 'bg-white text-[#0056b3] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Grid Vertikal (Lama)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('horizontal')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printFormat === 'horizontal'
                    ? 'bg-white text-[#0056b3] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid Horizontal 4 Kolom (Baru)</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Menampilkan: <strong className="text-gray-800">{records.length}</strong> dari{' '}
            <strong className="text-gray-800">{totalCount}</strong> data
          </div>
        </div>

        {/* Peringatan jika data melebihi batas 400 */}
        {totalCount > 400 && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Batas Maksimal 400 Data Tercapai:</span> Ditemukan {totalCount} data sesuai filter saat ini. Hanya 400 data pertama yang ditampilkan untuk dicetak. Harap persempit filter (pilih jenis training, cabang, bulan, atau tahun tertentu) agar cetakan optimal.
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {meta?.userRole === 'admin_pusat' && (
            <div>
              <label className="block font-bold text-gray-600 mb-1">Cabang</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium"
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

          <div>
            <label className="block font-bold text-gray-600 mb-1">Jenis Training</label>
            <select
              value={trainingId}
              onChange={(e) => setTrainingId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium"
            >
              <option value="">Semua Training</option>
              {meta?.trainings?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-600 mb-1">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium"
            >
              <option value="">Semua Bulan</option>
              {meta?.months?.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-600 mb-1">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium"
            >
              <option value="">Semua Tahun</option>
              {meta?.years?.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-600 mb-1">Nama Trainer</label>
            <input
              type="text"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-600 mb-1">Pimpinan / Manager</label>
            <input
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORMAT 1: GRID VERTIKAL (LAMA) - Tetap ada sebagai pilihan default        */}
      {/* ========================================================================= */}
      {printFormat === 'lama' && (
        <div id="printable-content" className="bg-white p-8 sm:p-12 rounded-2xl border border-gray-200 shadow-md max-w-5xl mx-auto print:p-0 print:border-0 print:shadow-none">
          {/* Kop Surat Berita Acara */}
          <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt="Logo Indomaret" crossOrigin="anonymous" className="h-14 w-auto object-contain" />
              <div>
                <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-wide font-title uppercase">
                  PT INDOMARCO PRISMATAMA
                </h2>
                <p className="text-xs font-bold text-gray-600 uppercase">
                  TRAINING CENTER SURABAYA
                </p>
                <p className="text-[11px] text-gray-500">
                  Cabang: {selectedBranchObj?.name || 'Nasional'} &bull; Kode: {selectedBranchObj?.code || 'PST'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono text-gray-500 block">FORM-TRN-ABS-01</span>
              <span className="text-xs font-bold text-gray-800 mt-1 block">
                Tanggal: {formatDateIndo(new Date())}
              </span>
            </div>
          </div>

          {/* Judul Dokumen */}
          <div className="text-center my-6">
            <h1 className="text-base sm:text-lg font-black uppercase text-gray-900 tracking-wider underline font-title">
              BERITA ACARA KETIDAKHADIRAN PESERTA TRAINING
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Modul: {selectedTrainingObj?.name || 'Semua Jenis Training'} &bull; Periode Tahun {year || new Date().getFullYear()}
            </p>
          </div>

          {/* Tabel Data Ketidakhadiran */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-gray-800 text-[11px]">
              <thead>
                <tr className="bg-gray-100 text-gray-900 font-bold uppercase text-center border-b border-gray-800">
                  <th className="border border-gray-800 p-2 w-8">No</th>
                  <th className="border border-gray-800 p-2 w-28">NIK</th>
                  <th className="border border-gray-800 p-2">Nama Peserta</th>
                  <th className="border border-gray-800 p-2 w-32">Jabatan</th>
                  <th className="border border-gray-800 p-2 w-28">Batch & Tgl</th>
                  <th className="border border-gray-800 p-2 w-36">Alasan</th>
                  <th className="border border-gray-800 p-2 w-28 text-center">Status Bukti</th>
                  <th className="border border-gray-800 p-2 w-32">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((r, i) => (
                    <tr key={r.id} className="border-b border-gray-400">
                      <td className="border border-gray-800 p-2 text-center font-bold">{i + 1}</td>
                      <td className="border border-gray-800 p-2 font-mono font-bold text-center">
                        {r.nik}
                      </td>
                      <td className="border border-gray-800 p-2 font-semibold text-gray-900">
                        {r.nama_peserta}
                      </td>
                      <td className="border border-gray-800 p-2">{r.jabatan}</td>
                      <td className="border border-gray-800 p-2 text-center">
                        B-{r.batch} ({r.tanggal_pelaksanaan})
                      </td>
                      <td className="border border-gray-800 p-2 font-medium">
                        {r.absence_reasons?.name || '-'}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {r.drive_file_id ? (
                          <span className="font-bold text-teal-800">Ada (Google Drive)</span>
                        ) : (
                          <span className="text-gray-400 italic">Belum Ada</span>
                        )}
                      </td>
                      <td className="border border-gray-800 p-2 text-gray-600">{r.keterangan || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500 italic">
                      Tidak ada catatan ketidakhadiran untuk kriteria ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Kolom Tanda Tangan Resmi */}
          <div className="mt-12 pt-4 grid grid-cols-2 gap-8 text-center text-xs print-break-avoid">
            <div className="space-y-16">
              <p className="font-bold text-gray-800 uppercase">Dibuat & Diverifikasi Oleh,</p>
              <div>
                <p className="font-bold text-gray-900 underline">{trainerName}</p>
                <p className="text-[11px] text-gray-500">Instructor / Trainer Pelaksana</p>
              </div>
            </div>

            <div className="space-y-16">
              <p className="font-bold text-gray-800 uppercase">Mengetahui & Menyetujui,</p>
              <div>
                <p className="font-bold text-gray-900 underline">{managerName}</p>
                <p className="text-[11px] text-gray-500">Branch Training Manager</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORMAT 2: GRID HORIZONTAL 4 KOLOM (BARU) - Lampiran Bukti 8 Kolom       */}
      {/* ========================================================================= */}
      {printFormat === 'horizontal' && (
        <div id="printable-content" className="space-y-8 print:space-y-0">
          {trainingGroups.length > 0 ? (
            trainingGroups.map((group, groupIdx) => {
              const chunks = chunkArray(group.records, 4);

              return (
                <div
                  key={group.id}
                  className={`bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-md max-w-6xl mx-auto print:p-0 print:border-0 print:shadow-none ${
                    groupIdx > 0 ? 'print-page-break' : ''
                  }`}
                >
                  <div className="overflow-x-auto">
                    {/* Tabel format Excel: border-collapse, garis 1px hitam solid pada semua sel */}
                    <table
                      className="w-full text-left text-xs"
                      style={{
                        borderCollapse: 'collapse',
                        border: '1px solid #000000',
                      }}
                    >
                      <thead>
                        {/* Baris 1 (judul): "LAMPIRAN BUKTI TIDAK HADIR", tebal, rata tengah, colspan 8 */}
                        <tr>
                          <th
                            colSpan={8}
                            className="text-center font-black uppercase text-sm sm:text-base p-2 font-title tracking-wider text-black"
                            style={{ border: '1px solid #000000', backgroundColor: '#F3F4F6' }}
                          >
                            LAMPIRAN BUKTI TIDAK HADIR
                          </th>
                        </tr>
                        {/* Baris 2 (sub-judul): nama jenis training, tebal, rata tengah, colspan 8 */}
                        <tr>
                          <th
                            colSpan={8}
                            className="text-center font-bold uppercase text-xs sm:text-sm p-1.5 font-title tracking-wide text-black"
                            style={{ border: '1px solid #000000', backgroundColor: '#F9FAFB' }}
                          >
                            {group.name}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunks.map((chunk, chunkIdx) => {
                          // Pastikan selalu ada 4 slot; jika sisa kurang dari 4, sisa kolom tetap ada & kosong
                          const padded = [...chunk];
                          while (padded.length < 4) {
                            padded.push(null);
                          }

                          return (
                            <React.Fragment key={chunkIdx}>
                              {/* Baris data (identitas): 4 pasang sel per baris (1 sel NIK tebal, 1 sel Nama Lengkap) = total 8 kolom */}
                              <tr className="print-break-avoid" style={{ backgroundColor: '#ffffff' }}>
                                {padded.map((item, idx) => (
                                  <React.Fragment key={`id-${chunkIdx}-${idx}`}>
                                    {/* Sel NIK (tebal, rata tengah) */}
                                    <td
                                      className="p-1 text-center font-mono font-bold text-[10px] sm:text-[11px] text-black"
                                      style={{
                                        border: '1px solid #000000',
                                        width: '11%',
                                      }}
                                    >
                                      {item ? item.nik : ''}
                                    </td>
                                    {/* Sel Nama Lengkap */}
                                    <td
                                      className="p-1 font-semibold text-[10px] sm:text-[11px] text-gray-900 truncate"
                                      style={{
                                        border: '1px solid #000000',
                                        width: '14%',
                                      }}
                                      title={item ? item.nama_peserta : ''}
                                    >
                                      {item ? item.nama_peserta : ''}
                                    </td>
                                  </React.Fragment>
                                ))}
                              </tr>

                              {/* Baris gambar (tepat di bawah baris identitas): 4 sel, masing-masing colspan 2 */}
                              <tr className="print-break-avoid" style={{ backgroundColor: '#ffffff' }}>
                                {padded.map((item, idx) => (
                                  <td
                                    key={`img-${chunkIdx}-${idx}`}
                                    colSpan={2}
                                    className="p-1 text-center align-middle"
                                    style={{
                                      border: '1px solid #000000',
                                      width: '25%',
                                      height: '175px',
                                      minHeight: '175px',
                                      maxHeight: '185px',
                                    }}
                                  >
                                    {!item ? (
                                      // Slot kosong (jika sisa data < 4), garis sel tetap ada
                                      <div className="h-[168px] w-full" />
                                    ) : !item.drive_file_id ? (
                                      // Jika data tidak punya bukti sama sekali
                                      <div className="h-[168px] w-full flex flex-col items-center justify-center text-gray-400 italic text-[11px]">
                                        Tidak ada bukti
                                      </div>
                                    ) : item.file_mime_type === 'application/pdf' ? (
                                      // Jika mime type adalah application/pdf
                                      <div className="h-[168px] w-full flex flex-col items-center justify-center p-2 text-gray-700 bg-gray-50/60 rounded">
                                        <FileText className="w-8 h-8 text-red-500 mb-1" />
                                        <span className="text-[10px] font-bold text-center leading-tight">
                                          Dokumen PDF
                                          <br />
                                          <span className="font-normal text-gray-500">(lihat di sistem)</span>
                                        </span>
                                      </div>
                                    ) : (
                                      // Jika mime type adalah gambar
                                      <div className="h-[168px] w-full flex items-center justify-center overflow-hidden">
                                        <ProofImage
                                          recordId={item.id}
                                          src={`/api/records/${item.id}/file`}
                                          alt={`Bukti ${item.nama_peserta}`}
                                          onLoaded={handleImageLoaded}
                                        />
                                      </div>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-500 italic max-w-6xl mx-auto">
              Tidak ada catatan ketidakhadiran untuk kriteria filter yang dipilih.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
