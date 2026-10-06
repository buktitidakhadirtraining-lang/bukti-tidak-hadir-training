// components/ImportExportModal.js
'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

export default function ImportExportModal({
  isOpen,
  onClose,
  title = 'Impor / Ekspor Data',
  targetName = 'Data Tambahan',
  importEndpoint = '/api/data-tambahan/import',
  exportEndpoint = '/api/data-tambahan/export',
  onSuccess,
  currentRecords = [],
}) {
  const [activeTab, setActiveTab] = useState('import'); // 'import' | 'export'
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function resetState() {
    setFile(null);
    setParsedRows([]);
    setParsing(false);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    resetState();
    onClose();
  }

  // Parse CSV / Excel file
  async function handleFileSelect(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);
    setParsedRows([]);

    try {
      const fileName = selectedFile.name.toLowerCase();
      if (fileName.endsWith('.csv')) {
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processRawData(results.data);
            setParsing(false);
          },
          error: (err) => {
            toast.error('Gagal membaca file CSV: ' + err.message);
            setParsing(false);
          },
        });
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
          toast.error('File Excel tidak memiliki lembar kerja (worksheet)');
          setParsing(false);
          return;
        }

        const rawData = [];
        const headers = [];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            row.eachCell((cell, colNumber) => {
              headers[colNumber] = String(cell.value || '').trim();
            });
          } else {
            const rowObj = {};
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber];
              if (header) {
                // Handle complex formula or text
                let val = cell.value;
                if (typeof val === 'object' && val !== null) {
                  val = val.result || val.text || '';
                }
                rowObj[header] = String(val || '').trim();
              }
            });
            if (Object.keys(rowObj).length > 0) {
              rawData.push(rowObj);
            }
          }
        });

        processRawData(rawData);
        setParsing(false);
      } else {
        toast.error('Format file tidak didukung. Harap upload .xlsx atau .csv');
        setParsing(false);
      }
    } catch (err) {
      toast.error('Terjadi kesalahan membaca file: ' + err.message);
      setParsing(false);
    }
  }

  function processRawData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      toast.error('Tidak ada data yang ditemukan di dalam file');
      return;
    }

    const normalized = data.map((item, index) => {
      // Normalisasi header
      const keys = Object.keys(item);
      const getVal = (patterns) => {
        for (const p of patterns) {
          const match = keys.find((k) => k.toLowerCase().trim().replace(/_/g, ' ') === p.toLowerCase());
          if (match && item[match] !== undefined && item[match] !== null) {
            return String(item[match]).trim();
          }
        }
        return '';
      };

      const no = getVal(['no', 'nomor']) || String(index + 1);
      const training = getVal(['training', 'jenis training', 'nama training']) || 'TRAINING';
      const nik = getVal(['nik', 'nik peserta', 'nip']);
      const nama = getVal(['nama', 'nama peserta', 'nama lengkap', 'nama karyawan']);
      const kdToko = getVal(['kd toko', 'kode toko', 'kdtoko']) || '-';
      const namaToko = getVal(['nama toko', 'namatoko', 'toko']) || '-';
      const alasan = getVal(['alasan tidak hadir', 'alasan', 'keterangan', 'alasan ketidakhadiran']) || '-';

      return {
        no,
        training: training.toUpperCase(),
        nik,
        nama: nama.toUpperCase(),
        kd_toko: kdToko.toUpperCase(),
        nama_toko: namaToko.toUpperCase(),
        alasan_tidak_hadir: alasan,
        isValid: Boolean(nik && nama),
      };
    });

    const validRows = normalized.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('Header tidak cocok atau data kosong. Harap gunakan template yang sesuai.');
    } else {
      toast.success(`Berhasil membaca ${validRows.length} baris data yang siap diimpor.`);
    }

    setParsedRows(normalized);
  }

  async function handleUpload() {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('Tidak ada data valid yang dapat disimpan');
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Mengimpor ${validRows.length} data ke database cabang...`);

    try {
      const res = await fetch(importEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(json.message || `Berhasil mengimpor ${validRows.length} data!`, { id: toastId });
        if (onSuccess) onSuccess();
        handleClose();
      } else {
        toast.error(json.error || 'Gagal mengimpor data', { id: toastId });
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  // Unduh Template Excel
  async function handleDownloadTemplate() {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template_Import');

      worksheet.columns = [
        { header: 'NO', key: 'no', width: 8 },
        { header: 'TRAINING', key: 'training', width: 22 },
        { header: 'NIK', key: 'nik', width: 18 },
        { header: 'NAMA', key: 'nama', width: 28 },
        { header: 'KD TOKO', key: 'kd_toko', width: 14 },
        { header: 'NAMA TOKO', key: 'nama_toko', width: 26 },
        { header: 'ALASAN TIDAK HADIR', key: 'alasan_tidak_hadir', width: 24 },
      ];

      // Style Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0056B3' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Contoh baris
      worksheet.addRow({
        no: 1,
        training: 'YFC',
        nik: '2015698709',
        nama: 'AHMAD FAUZI',
        kd_toko: 'TXYZ',
        nama_toko: 'INDOMARET RAYA DARMO',
        alasan_tidak_hadir: 'Sakit',
      });
      worksheet.addRow({
        no: 2,
        training: 'BARISTA',
        nik: '2018451290',
        nama: 'SITI RAHMAWATI',
        kd_toko: 'TABC',
        nama_toko: 'INDOMARET PEMUDA',
        alasan_tidak_hadir: 'Cuti',
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Import_${targetName.replace(/\s+/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template Excel berhasil diunduh!');
    } catch (err) {
      toast.error('Gagal mengunduh template: ' + err.message);
    }
  }

  // Ekspor Data ke Excel
  async function handleExportExcel() {
    setExporting(true);
    try {
      let exportData = currentRecords;
      if (!exportData || exportData.length === 0) {
        const res = await fetch(exportEndpoint);
        const json = await res.json();
        if (json.ok) {
          exportData = json.data || [];
        }
      }

      if (!exportData || exportData.length === 0) {
        toast.error('Tidak ada data untuk diekspor.');
        setExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(targetName.replace(/\s+/g, '_'));

      worksheet.columns = [
        { header: 'NO', key: 'no', width: 8 },
        { header: 'TRAINING', key: 'training', width: 24 },
        { header: 'NIK', key: 'nik', width: 18 },
        { header: 'NAMA', key: 'nama', width: 30 },
        { header: 'KD TOKO', key: 'kd_toko', width: 14 },
        { header: 'NAMA TOKO', key: 'nama_toko', width: 28 },
        { header: 'ALASAN TIDAK HADIR', key: 'alasan_tidak_hadir', width: 26 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0056B3' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      exportData.forEach((row, i) => {
        worksheet.addRow({
          no: row.no || i + 1,
          training: row.training || '-',
          nik: row.nik || '-',
          nama: row.nama || '-',
          kd_toko: row.kd_toko || '-',
          nama_toko: row.nama_toko || '-',
          alasan_tidak_hadir: row.alasan_tidak_hadir || '-',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Data_${targetName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Berhasil mengekspor ${exportData.length} data ke file Excel!`);
    } catch (err) {
      toast.error('Gagal mengekspor data: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  // Ekspor Data ke CSV
  async function handleExportCsv() {
    setExporting(true);
    try {
      let exportData = currentRecords;
      if (!exportData || exportData.length === 0) {
        const res = await fetch(exportEndpoint);
        const json = await res.json();
        if (json.ok) {
          exportData = json.data || [];
        }
      }

      if (!exportData || exportData.length === 0) {
        toast.error('Tidak ada data untuk diekspor.');
        setExporting(false);
        return;
      }

      const formatted = exportData.map((row, i) => ({
        NO: row.no || i + 1,
        TRAINING: row.training || '-',
        NIK: row.nik || '-',
        NAMA: row.nama || '-',
        'KD TOKO': row.kd_toko || '-',
        'NAMA TOKO': row.nama_toko || '-',
        'ALASAN TIDAK HADIR': row.alasan_tidak_hadir || '-',
      }));

      const csv = Papa.unparse(formatted);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Data_${targetName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Berhasil mengekspor ${exportData.length} data ke file CSV!`);
    } catch (err) {
      toast.error('Gagal mengekspor data: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-[#0056b3] rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-title">{title}</h2>
              <p className="text-xs text-gray-500">
                Impor atau ekspor berkas Excel/CSV untuk {targetName} cabang Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 px-6 pt-3 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'import'
                ? 'border-[#0056b3] text-[#0056b3]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Impor Data (Excel / CSV)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'export'
                ? 'border-[#0056b3] text-[#0056b3]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Data</span>
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === 'import' ? (
            <div className="space-y-5">
              {/* Petunjuk format header */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-blue-900 text-xs mb-1">
                    Format Header Kolom Excel / CSV Wajib:
                  </h3>
                  <div className="font-mono text-[11px] text-blue-800 font-semibold bg-white/80 p-2 rounded-lg border border-blue-100 inline-block">
                    NO | TRAINING | NIK | NAMA | KD TOKO | NAMA TOKO | ALASAN TIDAK HADIR
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-blue-100 text-[#0056b3] rounded-xl text-xs font-bold border border-blue-300 shadow-xs transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Template Excel</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-[#0056b3] bg-gray-50/50 hover:bg-blue-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="p-3 bg-blue-100 text-[#0056b3] rounded-2xl">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">
                      Pilih berkas Excel (.xlsx) atau CSV (.csv)
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Klik untuk memilih berkas dari komputer Anda
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-[#0056b3] rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{file.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} baris terbaca
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetState}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Status Ringkasan */}
              {parsedRows.length > 0 && (
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{validCount} Baris Valid</span>
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-700 font-bold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{invalidCount} Baris Tidak Lengkap (Dilewati)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Tabel Data */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <p className="font-bold text-gray-800 text-xs">
                    Pratinjau Data yang Akan Diimpor (Maksimal 10 Baris Pertama):
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-60">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0">
                          <th className="p-2 text-center w-10">NO</th>
                          <th className="p-2">TRAINING</th>
                          <th className="p-2 text-center">NIK</th>
                          <th className="p-2">NAMA</th>
                          <th className="p-2 text-center">KD TOKO</th>
                          <th className="p-2">NAMA TOKO</th>
                          <th className="p-2">ALASAN TIDAK HADIR</th>
                          <th className="p-2 text-center w-16">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.slice(0, 10).map((r, i) => (
                          <tr
                            key={i}
                            className={r.isValid ? 'hover:bg-gray-50' : 'bg-red-50/50 text-red-900'}
                          >
                            <td className="p-2 text-center font-bold text-gray-500">{r.no || i + 1}</td>
                            <td className="p-2 font-semibold text-blue-700">{r.training}</td>
                            <td className="p-2 text-center font-mono font-bold">{r.nik || '-'}</td>
                            <td className="p-2 font-semibold">{r.nama || '-'}</td>
                            <td className="p-2 text-center font-mono">{r.kd_toko || '-'}</td>
                            <td className="p-2">{r.nama_toko || '-'}</td>
                            <td className="p-2">{r.alasan_tidak_hadir || '-'}</td>
                            <td className="p-2 text-center">
                              {r.isValid ? (
                                <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-sm font-bold text-[10px]">
                                  Valid
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-800 rounded-sm font-bold text-[10px]">
                                  Error
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB EXPORT */
            <div className="space-y-6 py-4">
              <div className="text-center max-w-md mx-auto space-y-2">
                <div className="p-3 bg-blue-50 text-[#0056b3] rounded-2xl w-12 h-12 mx-auto flex items-center justify-center">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Ekspor Data {targetName} Cabang Anda
                </h3>
                <p className="text-gray-500 text-xs">
                  Unduh seluruh arsip data peserta {targetName} yang tersimpan di cabang Anda ke dalam format Excel (.xlsx) atau CSV (.csv).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="p-5 bg-white hover:bg-emerald-50/60 border-2 border-emerald-200 hover:border-emerald-500 rounded-2xl text-left transition-all shadow-xs flex flex-col gap-2 group disabled:opacity-50"
                >
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl w-fit group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs">Format Microsoft Excel</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      File .xlsx lengkap dengan header warna dan kolom terformat rapi.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exporting}
                  className="p-5 bg-white hover:bg-blue-50/60 border-2 border-blue-200 hover:border-[#0056b3] rounded-2xl text-left transition-all shadow-xs flex flex-col gap-2 group disabled:opacity-50"
                >
                  <div className="p-2 bg-blue-100 text-[#0056b3] rounded-xl w-fit group-hover:scale-105 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs">Format CSV (Comma Delimited)</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      File .csv standar untuk kompatibilitas aplikasi lain.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs border border-gray-200 transition-colors"
          >
            Tutup
          </button>

          {activeTab === 'import' && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={validCount === 0 || uploading || parsing}
              className="px-6 py-2.5 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 min-h-[40px]"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengimpor {validCount} Data...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Mulai Impor ({validCount} Data)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
