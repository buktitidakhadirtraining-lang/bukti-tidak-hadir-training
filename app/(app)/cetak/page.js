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
  FileCheck2,
  Users2,
  RefreshCw,
  Code2,
  CheckCircle2,
  Calendar,
  PenTool,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { LOGO_URL, formatDateIndo } from '../../../lib/config.js';
import BeritaAcaraRekap from '../../../components/BeritaAcaraRekap.js';
import BeritaAcaraSoftSkill from '../../../components/BeritaAcaraSoftSkill.js';
import LampiranListTidakHadir from '../../../components/LampiranListTidakHadir.js';
import SqlEditorModal from '../../../components/SqlEditorModal.js';

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

  // Format Cetak:
  // - 'rekap_dispensasi': Berita Acara Rekapitulasi (Gambar 2 & Gambar 3) dari sheet 'cetak_rekap'
  // - 'soft_skill': Berita Acara Soft Skill (Gambar 6 & 7) dari sheet 'list_soft_skill'
  // - 'list_tidak_hadir': Lampiran Detail Peserta Tidak Hadir (Gambar 4 & 5) dari sheet 'list_tidak_hadir'
  // - 'horizontal': Grid Horizontal 4 Kolom Foto Bukti
  // - 'lama': Grid Vertikal Lama
  const [printFormat, setPrintFormat] = useState('rekap_dispensasi');

  // Pengaturan Berita Acara Rekap (Gambar 2 & Gambar 3)
  const [rekapData, setRekapData] = useState([]);
  const [listTidakHadirData, setListTidakHadirData] = useState([]);
  const [softSkillData, setSoftSkillData] = useState([]);

  // Pengaturan Tanda Tangan & Tinta
  const [ttdMode, setTtdMode] = useState('ada'); // 'kosong' (Gambar 2) | 'ada' (Gambar 3)
  const [inkColor, setInkColor] = useState('#122b52'); // Biru Bolpoin (#122b52) atau Hitam (#111827)
  const [tanggalCetak, setTanggalCetak] = useState('Surabaya, 5 Oktober 2026');
  const [cabangCetak, setCabangCetak] = useState('Training Center Cabang Surabaya');
  const [bulanCetak, setBulanCetak] = useState('Oktober');
  const [tahunCetak, setTahunCetak] = useState('2026');

  // Pengaturan Khusus Berita Acara Soft Skill (Gambar 6 & 7)
  const [softSkillTtdMode, setSoftSkillTtdMode] = useState('ada'); // 'ada' | 'kosong'
  const [softSkillCabang, setSoftSkillCabang] = useState('Surabaya');
  const [softSkillPeriode, setSoftSkillPeriode] = useState('September 2026');
  const [softSkillTanggalDibuat, setSoftSkillTanggalDibuat] = useState('30 September 2026');

  // Pengaturan Lampiran List Tidak Hadir (Gambar 4 & 5)
  const [selectedTrainingListFilter, setSelectedTrainingListFilter] = useState('');

  // Status Sinkronisasi Live Time 10 Detik
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Filters Format Bukti Foto
  const [branchId, setBranchId] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [batch, setBatch] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [trainerName, setTrainerName] = useState('Budi Setiawan');
  const [managerName, setManagerName] = useState('Hendra Wijaya');

  // Tracking loaded images for Format Horizontal
  const [loadedImageIds, setLoadedImageIds] = useState(new Set());

  // 1. Muat Meta
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

  // 2. Fetch Records Bukti Foto
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
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

  // 3. Fetch & Live Sync Data Spreadsheet (10 Detik Sekali)
  const syncSpreadsheet = useCallback(async (manual = false) => {
    if (manual) setIsSyncing(true);
    try {
      const res = await fetch(`/api/sync-sheets${manual ? '?force=true' : ''}`);
      const json = await res.json();
      if (json.ok) {
        if (Array.isArray(json.rekap) && json.rekap.length > 0) {
          setRekapData(json.rekap);
        }
        if (Array.isArray(json.listTidakHadir) && json.listTidakHadir.length > 0) {
          setListTidakHadirData(json.listTidakHadir);
        }
        if (Array.isArray(json.softSkill) && json.softSkill.length > 0) {
          setSoftSkillData(json.softSkill);
        }
        setLastSyncTime(new Date());
        if (manual) {
          toast.success(
            `Data tersinkronisasi: ${json.rekap?.length || 0} rekap, ${json.softSkill?.length || 0} soft skill, ${json.listTidakHadir?.length || 0} list peserta.`
          );
        }
      }
    } catch (err) {
      console.error('[Live Sync Error]:', err);
      if (manual) toast.error('Gagal sinkronisasi data dari spreadsheet');
    } finally {
      if (manual) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    // Inisialisasi awal
    syncSpreadsheet(false);

    // Live polling setiap 10 detik sesuai permintaan user
    const interval = setInterval(() => {
      syncSpreadsheet(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [syncSpreadsheet]);

  // Tracking loaded images
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
    printFormat !== 'horizontal' ||
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

  // Fungsi mengunduh berkas fisik PDF berbasis Teks & Vector (jsPDF + jspdf-autotable)
  async function handleDownloadPdf() {
    if (downloadingPdf) return;

    setDownloadingPdf(true);
    const toastId = toast.loading('Sedang memproses dan membuat berkas PDF...');

    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;

      // =========================================================================
      // 1. FORMAT: LAMPIRAN DETAIL PESERTA TIDAK HADIR
      // =========================================================================
      if (printFormat === 'list_tidak_hadir') {
        const groups = {};
        const seenPerTraining = new Set();

        for (const item of (listTidakHadirData || [])) {
          const trName = String(item.training || 'LAINNYA').trim().toUpperCase();
          const nik = String(item.nik || '').trim();
          const dedupKey = `${trName}__${nik}`;

          if (seenPerTraining.has(dedupKey)) continue;
          seenPerTraining.add(dedupKey);

          if (!groups[trName]) groups[trName] = [];
          groups[trName].push({
            training: trName,
            nik: nik,
            nama: String(item.nama || '').trim().toUpperCase(),
            kd_toko: String(item.kd_toko || item.kode_toko || '-').trim().toUpperCase(),
            nama_toko: String(item.nama_toko || '-').trim().toUpperCase(),
            alasan_tidak_hadir: String(item.alasan_tidak_hadir || item.alasan || '-').trim(),
          });
        }

        const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
        let filteredKeys = sortedKeys;
        if (selectedTrainingListFilter) {
          filteredKeys = sortedKeys.filter(
            (k) => k.toLowerCase() === selectedTrainingListFilter.toLowerCase()
          );
        }

        const trTag = selectedTrainingListFilter
          ? `_${selectedTrainingListFilter.replace(/[^a-zA-Z0-9]/g, '_')}`
          : '_Semua_Training';
        const filename = `Lampiran_Detail_Peserta_Tidak_Hadir${trTag}.pdf`;

        const doc = new jsPDF({
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        });

        if (filteredKeys.length === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(15);
          doc.text('LAMPIRAN DETAIL PESERTA TIDAK HADIR', 105, 18, { align: 'center' });
          doc.setFontSize(12);
          doc.text('JENIS TRAINING: -', 105, 25, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text('Tidak ada data peserta tidak hadir.', 105, 45, { align: 'center' });
          doc.save(filename);
          toast.success('Berkas PDF berhasil diunduh ke folder Downloads!', { id: toastId });
          return;
        }

        let totalPageCounter = 0;

        for (let gIdx = 0; gIdx < filteredKeys.length; gIdx++) {
          const groupKey = filteredKeys[gIdx];
          const groupItems = groups[groupKey];
          const totalGroupItems = groupItems.length;

          const chunkSize = 40;
          const chunkCount = Math.ceil(groupItems.length / chunkSize) || 1;

          for (let cIdx = 0; cIdx < chunkCount; cIdx++) {
            totalPageCounter++;

            if (totalPageCounter > 1) {
              doc.addPage('a4', 'portrait');
            }

            const chunkItems = groupItems.slice(cIdx * chunkSize, (cIdx + 1) * chunkSize);
            const startNo = cIdx * chunkSize + 1;

            const tableRows = chunkItems.map((item, idx) => [
              String(startNo + idx),
              item.training,
              item.nik,
              item.nama,
              item.kd_toko,
              item.nama_toko,
              item.alasan_tidak_hadir,
            ]);

            autoTable(doc, {
              startY: 31,
              head: [['NO', 'TRAINING', 'NIK', 'NAMA', 'KD TOKO', 'NAMA TOKO', 'ALASAN TIDAK HADIR']],
              body: tableRows,
              theme: 'grid',
              margin: { left: 12, right: 12, top: 31, bottom: 20 },
              styles: {
                font: 'helvetica',
                fontSize: 9,
                textColor: [0, 0, 0],
                cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
                valign: 'middle',
                minCellHeight: 7,
                overflow: 'linebreak',
                lineWidth: 0.2,
                lineColor: [0, 0, 0],
              },
              headStyles: {
                fontStyle: 'bold',
                fillColor: [242, 242, 242],
                textColor: [0, 0, 0],
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.2,
                lineColor: [0, 0, 0],
              },
              columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 26 },
                2: { halign: 'center', cellWidth: 26 },
                3: { halign: 'left', cellWidth: 44 },
                4: { halign: 'center', cellWidth: 18 },
                5: { halign: 'left', cellWidth: 36 },
                6: { halign: 'left', cellWidth: 26 },
              },
              didDrawPage: function () {
                // Judul & Subjudul Utama
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(15);
                doc.setTextColor(0, 0, 0);
                doc.text('LAMPIRAN DETAIL PESERTA TIDAK HADIR', 105, 18, { align: 'center' });

                doc.setFontSize(12);
                doc.text(`JENIS TRAINING: ${groupKey}`, 105, 25, { align: 'center' });

                // Footer
                const pageY = 284;
                doc.setLineWidth(0.2);
                doc.setDrawColor(0, 0, 0);
                doc.line(12, pageY - 2, 198, pageY - 2);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(85, 85, 85);
                doc.text(
                  `Dokumen Rekapitulasi Ketidakhadiran Peserta Training • Jenis Training: ${groupKey} (${totalGroupItems} Peserta)`,
                  12,
                  pageY + 2
                );

                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                const currentPage = doc.internal.getNumberOfPages();
                doc.text(`Halaman ${currentPage}`, 198, pageY + 2, { align: 'right' });
              },
            });
          }
        }

        doc.save(filename);
        toast.success('Berkas PDF berhasil diunduh ke folder Downloads!', { id: toastId });
        return;
      }

      // =========================================================================
      // 2. FORMAT: BERITA ACARA REKAPITULASI DISPENSASI
      // =========================================================================
      if (printFormat === 'rekap_dispensasi') {
        const doc = new jsPDF({
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        });

        const filename = `Berita_Acara_Rekapitulasi_Training_${bulanCetak}_${tahunCetak}_${ttdMode}.pdf`;

        // Header Judul
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('BERITA ACARA KETIDAKHADIRAN PESERTA TRAINING', 105, 18, { align: 'center' });
        doc.text('DAN PERMOHONAN DISPENSASI KETIDAKHADIRAN', 105, 24, { align: 'center' });

        // Paragraf Pengantar
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const introText = `Pada pelaksanaan kegiatan ${cabangCetak} periode Bulan ${bulanCetak} Tahun ${tahunCetak}, ditemukan adanya peserta training karyawan eksisting yang tidak dapat mengikuti beberapa jenis training. Berikut kami sampaikan rekapitulasi ketidakhadiran peserta berdasarkan jenis training sebagai dasar pengajuan dispensasi kepada ETD.`;
        const splitIntro = doc.splitTextToSize(introText, 186);
        doc.text(splitIntro, 12, 33);

        let currentY = 33 + splitIntro.length * 5 + 2;

        const tableRows = (rekapData || []).map((row, idx) => [
          String(row.no || idx + 1),
          String(row.jenis_training || '').toUpperCase(),
          String(row.target_lskt || ''),
          String(row.dispensasi || ''),
          String(row.target_tc_report || ''),
          String(row.hadir || ''),
          String(row.tidak_hadir || ''),
          String(row.no_list_peserta_tidak_hadir || '').toUpperCase(),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['NO', 'JENIS TRAINING', 'TARGET LSKT', 'DISPENSASI', 'TARGET', 'HADIR', 'TIDAK HADIR', 'NO LIST PESERTA TIDAK HADIR']],
          body: tableRows,
          theme: 'grid',
          margin: { left: 12, right: 12, bottom: 20 },
          styles: {
            font: 'helvetica',
            fontSize: 8.5,
            textColor: [0, 0, 0],
            cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
            valign: 'middle',
            minCellHeight: 6.5,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
          },
          headStyles: {
            fontStyle: 'bold',
            fillColor: [242, 242, 242],
            textColor: [0, 0, 0],
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left', cellWidth: 42 },
            2: { halign: 'center', cellWidth: 20 },
            3: { halign: 'center', cellWidth: 22 },
            4: { halign: 'center', cellWidth: 18 },
            5: { halign: 'center', cellWidth: 16 },
            6: { halign: 'center', cellWidth: 18 },
            7: { halign: 'center', cellWidth: 40 },
          },
        });

        currentY = doc.lastAutoTable.finalY + 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('Data Pendukung', 12, currentY);
        currentY += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Sebagai data pendukung, bersama Berita Acara ini kami lampirkan:', 12, currentY);
        currentY += 4.5;
        doc.text('1. Daftar peserta yang tidak hadir pada masing-masing jenis training.', 16, currentY);
        currentY += 4;
        doc.text('2. Alasan ketidakhadiran setiap peserta.', 16, currentY);
        currentY += 4;
        doc.text('3. Bukti pendukung ketidakhadiran (apabila tersedia).', 16, currentY);
        currentY += 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('Permohonan Dispensasi Ketidakhadiran', 12, currentY);
        currentY += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const p2 = 'Sehubungan dengan data ketidakhadiran tersebut, kami memohon kepada Bapak/Ibu ETD untuk memberikan dispensasi kepada peserta yang tercantum dalam daftar ketidakhadiran, sehingga ketidakhadiran tersebut tidak diperhitungkan sebagai pengurang poin rating sesuai ketentuan yang berlaku.';
        const splitP2 = doc.splitTextToSize(p2, 186);
        doc.text(splitP2, 12, currentY);
        currentY += splitP2.length * 4 + 4;

        const p3 = 'Demikian Berita Acara dan permohonan dispensasi ini kami sampaikan. Atas perhatian dan persetujuan Bapak/Ibu, kami ucapkan terima kasih.';
        const splitP3 = doc.splitTextToSize(p3, 186);
        doc.text(splitP3, 12, currentY);
        currentY += splitP3.length * 4 + 6;

        doc.text(tanggalCetak, 198, currentY, { align: 'right' });
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          head: [[
            { content: 'Mengetahui,', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: 'Dibuat oleh,', colSpan: 1, styles: { halign: 'center', fontStyle: 'bold' } }
          ]],
          body: [[
            'DBM Operasional',
            'DBM Admin',
            'HRD Manager',
            'TC Supervisor'
          ]],
          theme: 'grid',
          margin: { left: 12, right: 12 },
          styles: {
            font: 'helvetica',
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'bottom',
            minCellHeight: 20,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
          },
          columnStyles: {
            0: { cellWidth: 46.5 },
            1: { cellWidth: 46.5 },
            2: { cellWidth: 46.5 },
            3: { cellWidth: 46.5 },
          },
        });

        doc.save(filename);
        toast.success('Berkas PDF berhasil diunduh ke folder Downloads!', { id: toastId });
        return;
      }

      // =========================================================================
      // 3. FORMAT: BERITA ACARA SOFT SKILL
      // =========================================================================
      if (printFormat === 'soft_skill') {
        const doc = new jsPDF({
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        });

        const filename = `Berita_Acara_Soft_Skill_${softSkillPeriode.replace(/[^a-zA-Z0-9]/g, '_')}_${softSkillTtdMode}.pdf`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('BERITA ACARA', 105, 18, { align: 'center' });
        doc.setFontSize(12);
        doc.text('PESERTA GAGAL MENGIKUTI TRAINING SOFT SKILL DASAR PIMPINAN SHIFT', 105, 24, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const pText = `Pada hari ini, ${softSkillTanggalDibuat}, kami yang bertanda tangan di bawah ini menyatakan bahwa peserta berikut dari Cabang ${softSkillCabang} tidak dapat mengikuti Training Soft Skill Dasar Pimpinan Shift pada periode ${softSkillPeriode} dengan alasan sebagaimana tercantum di bawah ini.`;
        const splitP = doc.splitTextToSize(pText, 186);
        doc.text(splitP, 12, 33);

        let currentY = 33 + splitP.length * 4.5 + 3;

        doc.setFont('helvetica', 'bold');
        doc.text(`Cabang : ${softSkillCabang}`, 12, currentY);
        currentY += 4.5;
        doc.text(`Periode Training : ${softSkillPeriode}`, 12, currentY);
        currentY += 4.5;
        doc.text(`Tanggal Dibuat : ${softSkillTanggalDibuat}`, 12, currentY);
        currentY += 6;

        doc.text('Daftar Peserta Gagal Training:', 12, currentY);
        currentY += 4;

        const tableRows = (softSkillData || []).map((row, idx) => [
          String(row.no || idx + 1),
          String(row.nik || ''),
          String(row.nama || '').toUpperCase(),
          String(row.jabatan || ''),
          String(row.kategory || row.kategori || '-'),
          String(row.detail_alasan || '-'),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['No', 'NIK', 'Nama', 'Jabatan', 'Kategori', 'Detail Alasan']],
          body: tableRows,
          theme: 'grid',
          margin: { left: 12, right: 12, bottom: 20 },
          styles: {
            font: 'helvetica',
            fontSize: 9,
            textColor: [0, 0, 0],
            cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
            valign: 'middle',
            minCellHeight: 7,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
          },
          headStyles: {
            fontStyle: 'bold',
            fillColor: [30, 96, 213],
            textColor: [255, 255, 255],
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 28 },
            2: { halign: 'left', cellWidth: 50 },
            3: { halign: 'left', cellWidth: 38 },
            4: { halign: 'center', cellWidth: 22 },
            5: { halign: 'left', cellWidth: 38 },
          },
        });

        currentY = doc.lastAutoTable.finalY + 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.text('Demikian berita acara ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.', 12, currentY);
        currentY += 8;

        autoTable(doc, {
          startY: currentY,
          head: [[
            'Mengetahui 2,\nDeputy Branch Manager ADM',
            'Mengetahui 1,\nHuman Resource Manager',
            'Membuat,\nTraining Center Supervisor'
          ]],
          body: [[
            'RICKY MARIO',
            'ABEDNEGO SETYA NUGROHO',
            'ROKHMAN'
          ]],
          theme: 'grid',
          margin: { left: 12, right: 12 },
          styles: {
            font: 'helvetica',
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'bottom',
            minCellHeight: 22,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
          },
          columnStyles: {
            0: { cellWidth: 62 },
            1: { cellWidth: 62 },
            2: { cellWidth: 62 },
          },
        });

        doc.save(filename);
        toast.success('Berkas PDF berhasil diunduh ke folder Downloads!', { id: toastId });
        return;
      }

      // Fallback untuk format foto horizontal / lama jika dipilih
      const html2canvas = (await import('html2canvas')).default;
      const sheets = document.querySelectorAll('.sheet');
      if (!sheets || sheets.length === 0) {
        throw new Error('Elemen lembar dokumen (.sheet) tidak ditemukan');
      }

      const isLandscape = printFormat === 'horizontal' || printFormat === 'lama';
      const orientation = isLandscape ? 'landscape' : 'portrait';
      const pdfWidth = isLandscape ? 297 : 210;
      const pdfHeight = isLandscape ? 210 : 297;
      const windowWidthPx = isLandscape ? 1123 : 794;

      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: orientation,
        compress: true,
      });

      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];

        const canvas = await html2canvas(sheet, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: windowWidthPx,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (i > 0) {
          doc.addPage('a4', orientation);
        }

        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      let filename = printFormat === 'horizontal'
        ? `Lampiran_Bukti_Foto_Horizontal_${year}.pdf`
        : `Berita_Acara_Lama_${year}.pdf`;

      doc.save(filename);
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

  // Helper url ekspor Excel
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

  // Pengelompokan data per jenis training untuk Format Horizontal
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

  // Daftar jenis training unik dari sheet list_tidak_hadir
  const uniqueTrainingsFromList = useMemo(() => {
    const set = new Set();
    for (const item of listTidakHadirData) {
      if (item.training) set.add(item.training.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listTidakHadirData]);

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
      {/* Control Panel (Hidden saat cetak browser) */}
      <div className="no-print bg-white p-5 rounded-2xl border border-gray-100 shadow-soft space-y-4">
        {/* Baris 1: Header & Tombol Utama */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/rekap"
              className="p-2 text-gray-500 hover:text-[#0056b3] hover:bg-blue-50 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-gray-900 font-title">
                  Cetak Dokumen & Rekap PDF
                </h1>
                {/* Live Sync Badge 10s */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live Sync (10s): Terhubung</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Pilih format cetak: Berita Acara Rekap (Gambar 2 & 3), Lampiran List Peserta (Gambar 4), atau Bukti Foto.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tombol Buka SQL Editor Skrip */}
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all"
              title="Lihat skrip SQL untuk membuat tabel cetak_rekap, list_tidak_hadir, data_tambahan"
            >
              <Code2 className="w-4 h-4 text-[#0056b3]" />
              <span>Kode SQL Editor</span>
            </button>

            {/* Tombol Sinkronkan Manual */}
            <button
              type="button"
              onClick={() => syncSpreadsheet(true)}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0056b3] text-xs font-bold transition-all disabled:opacity-50"
              title="Tarik pembaruan terkini dari spreadsheet sekarang"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkron...' : 'Sync Live'}</span>
            </button>

            {/* Tombol Unduh Excel */}
            {printFormat === 'horizontal' && (
              <a
                href={getExcelExportUrl()}
                download
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all"
                title="Unduh data sesuai filter aktif ke Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Unduh Excel</span>
              </a>
            )}

            {/* Tombol Unduh PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              title="Unduh langsung dokumen ini sebagai berkas PDF (.pdf) Ultra-HD"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengunduh...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Tombol Cetak Browser */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={downloadingPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-bold shadow-xs transition-all"
              title="Buka dialog cetak browser (Cetak ke printer fisik)"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {/* Baris 2: Pemilihan 4 Format Cetak */}
        <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-700 mr-1">Pilihan Format Cetak:</span>
            <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 flex-wrap gap-1">
              {/* 1. Berita Acara Rekap (Gambar 2 & 3) */}
              <button
                type="button"
                onClick={() => setPrintFormat('rekap_dispensasi')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printFormat === 'rekap_dispensasi'
                    ? 'bg-white text-[#0056b3] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Berita Acara Rekap (Gambar 2 & 3)</span>
              </button>

              {/* 2. Berita Acara Soft Skill (Gambar 6 & 7) */}
              <button
                type="button"
                onClick={() => setPrintFormat('soft_skill')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printFormat === 'soft_skill'
                    ? 'bg-white text-[#0056b3] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-700" />
                <span>Berita Acara Soft Skill (Gambar 6 & 7)</span>
              </button>

              {/* 3. Lampiran List Tidak Hadir (Gambar 4 & 5) */}
              <button
                type="button"
                onClick={() => setPrintFormat('list_tidak_hadir')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printFormat === 'list_tidak_hadir'
                    ? 'bg-white text-[#0056b3] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Lampiran List Peserta (Gambar 4 & 5)</span>
              </button>

              {/* 4. Grid Horizontal Foto Bukti */}
              <button
                type="button"
                onClick={() => setPrintFormat('horizontal')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printFormat === 'horizontal'
                    ? 'bg-white text-[#0056b3] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Bukti Foto Horizontal (4 Kolom)</span>
              </button>

              {/* 5. Grid Vertikal Lama */}
              <button
                type="button"
                onClick={() => setPrintFormat('lama')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printFormat === 'lama'
                    ? 'bg-white text-[#0056b3] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Grid Vertikal (Lama)</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            {printFormat === 'rekap_dispensasi' && (
              <span>Total: <strong className="text-gray-800">{rekapData.length}</strong> baris rekap</span>
            )}
            {printFormat === 'soft_skill' && (
              <span>Total: <strong className="text-gray-800">{softSkillData.length}</strong> peserta</span>
            )}
            {printFormat === 'list_tidak_hadir' && (
              <span>Total: <strong className="text-gray-800">{listTidakHadirData.length}</strong> peserta tidak hadir</span>
            )}
            {(printFormat === 'horizontal' || printFormat === 'lama') && (
              <span>Menampilkan: <strong className="text-gray-800">{records.length}</strong> data</span>
            )}
          </div>
        </div>

        {/* Baris 3: Pengaturan Dinamis Berdasarkan Format Aktif */}

        {/* A. Pengaturan Khusus Berita Acara Rekapitulasi (Gambar 2 & 3) */}
        {printFormat === 'rekap_dispensasi' && (
          <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs bg-blue-50/40 p-3.5 rounded-xl border border-blue-100">
            {/* Pilihan Mode Tanda Tangan */}
            <div>
              <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-[#0056b3]" />
                Versi Tanda Tangan
              </label>
              <div className="inline-flex w-full p-1 bg-white rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setTtdMode('kosong')}
                  className={`flex-1 py-1 text-center font-bold rounded text-xs transition-colors ${
                    ttdMode === 'kosong'
                      ? 'bg-blue-100 text-[#0056b3]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  TTD Kosong (Gbr 2)
                </button>
                <button
                  type="button"
                  onClick={() => setTtdMode('ada')}
                  className={`flex-1 py-1 text-center font-bold rounded text-xs transition-colors ${
                    ttdMode === 'ada'
                      ? 'bg-blue-100 text-[#0056b3]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Ada TTD (Gbr 3)
                </button>
              </div>
            </div>

            {/* Warna Tinta TTD */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Warna Tinta TTD</label>
              <select
                value={inkColor}
                onChange={(e) => setInkColor(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              >
                <option value="#122b52">Biru Bolpoin Resmi</option>
                <option value="#111827">Hitam Pekat</option>
              </select>
            </div>

            {/* Setting Tanggal Cetak (Bebas Diedit Sesuai Keinginan User) */}
            <div>
              <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#0056b3]" />
                Tanggal Cetak
              </label>
              <input
                type="text"
                value={tanggalCetak}
                onChange={(e) => setTanggalCetak(e.target.value)}
                placeholder="Contoh: Surabaya, 5 Oktober 2026"
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              />
            </div>

            {/* Cabang */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Nama Training Center</label>
              <input
                type="text"
                value={cabangCetak}
                onChange={(e) => setCabangCetak(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              />
            </div>

            {/* Bulan Periode */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Bulan Periode</label>
              <input
                type="text"
                value={bulanCetak}
                onChange={(e) => setBulanCetak(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              />
            </div>

            {/* Tahun Periode */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Tahun Periode</label>
              <input
                type="text"
                value={tahunCetak}
                onChange={(e) => setTahunCetak(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              />
            </div>
          </div>
        )}

        {/* B. Pengaturan Khusus Berita Acara Soft Skill (Gambar 6 & 7) */}
        {printFormat === 'soft_skill' && (
          <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100">
            {/* Pilihan Mode Tanda Tangan */}
            <div>
              <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-[#0056b3]" />
                Versi Tanda Tangan
              </label>
              <div className="inline-flex w-full p-1 bg-white rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setSoftSkillTtdMode('kosong')}
                  className={`flex-1 py-1 text-center font-bold rounded text-xs transition-colors ${
                    softSkillTtdMode === 'kosong'
                      ? 'bg-blue-100 text-[#0056b3]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  TTD Kosong
                </button>
                <button
                  type="button"
                  onClick={() => setSoftSkillTtdMode('ada')}
                  className={`flex-1 py-1 text-center font-bold rounded text-xs transition-colors ${
                    softSkillTtdMode === 'ada'
                      ? 'bg-blue-100 text-[#0056b3]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sudah Ada TTD (Gbr 7)
                </button>
              </div>
            </div>

            {/* Warna Tinta TTD */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Warna Tinta TTD</label>
              <select
                value={inkColor}
                onChange={(e) => setInkColor(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              >
                <option value="#122b52">Biru Bolpoin Resmi</option>
                <option value="#111827">Hitam Pekat</option>
              </select>
            </div>

            {/* Cabang */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Cabang</label>
              <input
                type="text"
                value={softSkillCabang}
                onChange={(e) => setSoftSkillCabang(e.target.value)}
                placeholder="Surabaya"
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              />
            </div>

            {/* Periode Training */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Periode Training</label>
              <input
                type="text"
                value={softSkillPeriode}
                onChange={(e) => setSoftSkillPeriode(e.target.value)}
                placeholder="September 2026"
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              />
            </div>

            {/* Tanggal Dibuat */}
            <div>
              <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#0056b3]" />
                Tanggal Dibuat
              </label>
              <input
                type="text"
                value={softSkillTanggalDibuat}
                onChange={(e) => setSoftSkillTanggalDibuat(e.target.value)}
                placeholder="30 September 2026"
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              />
            </div>
          </div>
        )}

        {/* B. Pengaturan Khusus Lampiran List Tidak Hadir (Gambar 4) */}
        {printFormat === 'list_tidak_hadir' && (
          <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 text-xs bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100">
            <div className="w-full sm:w-72">
              <label className="block font-bold text-gray-700 mb-1">Pilih Jenis Training:</label>
              <select
                value={selectedTrainingListFilter}
                onChange={(e) => setSelectedTrainingListFilter(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-medium"
              >
                <option value="">Semua Jenis Training (Dipisah Rapi)</option>
                {uniqueTrainingsFromList.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-gray-500 text-xs sm:mt-5">
              💡 <em>Tiap jenis training akan otomatis dipisahkan per halaman (print-page-break) dengan format resmi persis Gambar 4.</em>
            </div>
          </div>
        )}

        {/* C. Pengaturan Format Bukti Foto (Horizontal / Lama) */}
        {(printFormat === 'horizontal' || printFormat === 'lama') && (
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
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. FORMAT: BERITA ACARA REKAPITULASI (GAMBAR 2 & GAMBAR 3)                 */}
      {/* ========================================================================= */}
      {printFormat === 'rekap_dispensasi' && (
        <div id="printable-content" className="max-w-4xl mx-auto">
          <BeritaAcaraRekap
            data={rekapData}
            ttdMode={ttdMode}
            inkColor={inkColor}
            tanggalCetak={tanggalCetak}
            cabang={cabangCetak}
            bulan={bulanCetak}
            tahun={tahunCetak}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FORMAT: BERITA ACARA SOFT SKILL (GAMBAR 6 & GAMBAR 7)                   */}
      {/* ========================================================================= */}
      {printFormat === 'soft_skill' && (
        <div id="printable-content" className="max-w-4xl mx-auto">
          <BeritaAcaraSoftSkill
            data={softSkillData}
            ttdMode={softSkillTtdMode}
            inkColor={inkColor}
            cabang={softSkillCabang}
            periode={softSkillPeriode}
            tanggalDibuat={softSkillTanggalDibuat}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. FORMAT: LAMPIRAN DETAIL PESERTA TIDAK HADIR (GAMBAR 4 & GAMBAR 5)       */}
      {/* ========================================================================= */}
      {printFormat === 'list_tidak_hadir' && (
        <div id="printable-content" className="max-w-4xl mx-auto">
          <LampiranListTidakHadir
            data={listTidakHadirData}
            selectedTraining={selectedTrainingListFilter}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FORMAT: GRID HORIZONTAL 4 KOLOM BUKTI FOTO                             */}
      {/* ========================================================================= */}
      {printFormat === 'horizontal' && (
        <div id="printable-content" className="space-y-8 print:space-y-0">
          {trainingGroups.length > 0 ? (
            trainingGroups.map((group, groupIdx) => {
              const chunks = chunkArray(group.records, 4);

              return (
                <div
                  key={group.id}
                  className={`sheet landscape ${
                    groupIdx === trainingGroups.length - 1 ? 'last-sheet' : ''
                  }`}
                >
                  <div className="overflow-x-auto">
                    <table
                      className="w-full text-left text-xs"
                      style={{
                        borderCollapse: 'collapse',
                        border: '1px solid #000000',
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            colSpan={8}
                            className="text-center font-black uppercase text-sm sm:text-base p-2 font-title tracking-wider text-black"
                            style={{ border: '1px solid #000000', backgroundColor: '#F3F4F6' }}
                          >
                            LAMPIRAN BUKTI TIDAK HADIR
                          </th>
                        </tr>
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
                          const padded = [...chunk];
                          while (padded.length < 4) {
                            padded.push(null);
                          }

                          return (
                            <React.Fragment key={chunkIdx}>
                              <tr className="print-break-avoid" style={{ backgroundColor: '#ffffff' }}>
                                {padded.map((item, idx) => (
                                  <React.Fragment key={`id-${chunkIdx}-${idx}`}>
                                    <td
                                      className="p-1 text-center font-mono font-bold text-[10px] sm:text-[11px] text-black"
                                      style={{ border: '1px solid #000000', width: '11%' }}
                                    >
                                      {item ? item.nik : ''}
                                    </td>
                                    <td
                                      className="p-1 font-semibold text-[10px] sm:text-[11px] text-gray-900 truncate"
                                      style={{ border: '1px solid #000000', width: '14%' }}
                                      title={item ? item.nama_peserta : ''}
                                    >
                                      {item ? item.nama_peserta : ''}
                                    </td>
                                  </React.Fragment>
                                ))}
                              </tr>

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
                                      <div className="h-[168px] w-full" />
                                    ) : !item.drive_file_id ? (
                                      <div className="h-[168px] w-full flex flex-col items-center justify-center text-gray-400 italic text-[11px]">
                                        Tidak ada bukti
                                      </div>
                                    ) : item.file_mime_type === 'application/pdf' ? (
                                      <div className="h-[168px] w-full flex flex-col items-center justify-center p-2 text-gray-700 bg-gray-50/60 rounded">
                                        <FileText className="w-8 h-8 text-red-500 mb-1" />
                                        <span className="text-[10px] font-bold text-center leading-tight">
                                          Dokumen PDF
                                          <br />
                                          <span className="font-normal text-gray-500">(lihat di sistem)</span>
                                        </span>
                                      </div>
                                    ) : (
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

      {/* ========================================================================= */}
      {/* 5. FORMAT: GRID VERTIKAL LAMA                                             */}
      {/* ========================================================================= */}
      {printFormat === 'lama' && (
        <div id="printable-content" className="max-w-6xl mx-auto">
          <div className="sheet landscape last-sheet">
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

          <div className="text-center my-6">
            <h1 className="text-base sm:text-lg font-black uppercase text-gray-900 tracking-wider underline font-title">
              BERITA ACARA KETIDAKHADIRAN PESERTA TRAINING
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Modul: {selectedTrainingObj?.name || 'Semua Jenis Training'} &bull; Periode Tahun {year || new Date().getFullYear()}
            </p>
          </div>

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
        </div>
      )}

      {/* Modal Skrip SQL Editor */}
      <SqlEditorModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
      />
    </div>
  );
}
