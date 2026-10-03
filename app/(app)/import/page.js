// app/(app)/import/page.js
'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileCheck,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function ImportPage() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  function handleFileChange(file) {
    if (!file) return;
    const name = file.name || '';
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      toast.error('Format berkas tidak didukung. Harap pilih berkas .xlsx atau .csv');
      return;
    }
    setSelectedFile(file);
    setResult(null);
  }

  function removeFile() {
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;

    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/records/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.ok) {
        toast.success(json.message || 'Impor data selesai');
        setResult(json);
      } else {
        toast.error(json.error || 'Gagal memproses impor');
        setResult(json);
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan saat mengunggah berkas');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-title tracking-tight">
            Impor Data Ketidakhadiran
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Unggah berkas Excel (.xlsx) atau CSV untuk memasukkan banyak data ketidakhadiran sekaligus secara massal.
          </p>
        </div>

        <a
          href="/api/records/import/template"
          download
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0 min-h-[42px]"
        >
          <Download className="w-4 h-4" />
          <span>Unduh Format Template Excel</span>
        </a>
      </div>

      {/* Guide Box */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 text-xs sm:text-sm text-blue-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-[#0056b3]">
          <Info className="w-4 h-4 shrink-0" />
          <span>Ketentuan dan Petunjuk Impor Data:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-blue-800 text-xs pl-1">
          <li>Gunakan template resmi yang disediakan agar susunan kolom sesuai.</li>
          <li>Kolom wajib: NIK (8-16 digit angka), Nama Peserta, Jabatan, Jenis Training, Batch, Tanggal (YYYY-MM-DD), Cabang, dan Alasan.</li>
          <li>Nama jenis training dan alasan harus cocok dengan master data yang terdaftar di sistem.</li>
          <li>Berkas bukti berita acara tidak dapat diimpor massal via Excel, namun dapat dilengkapi nanti melalui menu Rekap Data.</li>
        </ul>
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6 space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files?.[0]) {
              handleFileChange(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => {
            if (!selectedFile) fileInputRef.current?.click();
          }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            isDragOver
              ? 'border-[#0056b3] bg-blue-50/50'
              : selectedFile
              ? 'border-teal-300 bg-teal-50/20'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50/40 cursor-pointer'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull; Siap dianalisis & disimpan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="Hapus berkas"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <UploadCloud className="w-12 h-12 text-gray-400 mx-auto" />
              <p className="text-sm font-bold text-gray-800">
                Pilih atau seret berkas Excel/CSV ke sini
              </p>
              <p className="text-xs text-gray-400">
                Mendukung format .xlsx, .xls, atau .csv (maksimal 5 MB)
              </p>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-all flex items-center gap-2 min-h-[44px] disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memvalidasi & Mengimpor Baris...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Proses Impor Sekarang</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Result Section */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900 font-title">
            Hasil Pemrosesan Impor
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center">
              <div className="text-xs text-gray-500 font-semibold uppercase">Total Baris</div>
              <div className="text-2xl font-black text-gray-800 font-title mt-1">
                {result.totalRows || 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-xs text-emerald-700 font-semibold uppercase">Berhasil Diimpor</div>
              <div className="text-2xl font-black text-emerald-700 font-title mt-1">
                {result.successCount || 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
              <div className="text-xs text-red-700 font-semibold uppercase">Gagal / Dilewati</div>
              <div className="text-2xl font-black text-red-700 font-title mt-1">
                {result.failedCount || 0}
              </div>
            </div>
          </div>

          {result.errors?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Rincian Baris yang Mengalami Kendala:
              </h4>

              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-2.5 text-center w-14">Baris</th>
                      <th className="p-2.5">NIK</th>
                      <th className="p-2.5">Nama</th>
                      <th className="p-2.5">Penyebab Kesalahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-red-50/40">
                        <td className="p-2.5 text-center font-bold text-gray-500">
                          #{err.rowNumber}
                        </td>
                        <td className="p-2.5 font-mono">{err.nik || '-'}</td>
                        <td className="p-2.5 font-medium">{err.name || '-'}</td>
                        <td className="p-2.5 text-red-600 font-medium">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
