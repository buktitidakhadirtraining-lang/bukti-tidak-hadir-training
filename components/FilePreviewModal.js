// components/FilePreviewModal.js
'use client';

import { useState } from 'react';
import { X, Download, FileText, ExternalLink, Loader2 } from 'lucide-react';

export default function FilePreviewModal({
  isOpen,
  recordId = null,
  fileUrl = null,
  fileName = 'Berkas Bukti',
  mimeType = '',
  onClose,
}) {
  const [loading, setLoading] = useState(true);

  const resolvedUrl = fileUrl || (recordId ? `/api/records/${recordId}/file` : null);

  if (!isOpen || !resolvedUrl) return null;

  const isPdf =
    (mimeType && mimeType.includes('pdf')) ||
    (fileName && fileName.toLowerCase().endsWith('.pdf')) ||
    (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.pdf'));

  const isImage = !isPdf;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
        {/* Header Bar */}
        <div className="indomaret-bar">
          <div className="indomaret-bar-blue" />
          <div className="indomaret-bar-yellow" />
          <div className="indomaret-bar-red" />
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-2 bg-blue-50 text-[#0056b3] rounded-xl shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">{fileName}</h3>
              <p className="text-[11px] text-gray-500 font-medium">Pratinjau Bukti Berita Acara</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#0056b3] bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              title="Buka di Tab Baru / Unduh"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Buka Penuh</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-gray-50/70 min-h-[350px] relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-[#0056b3] mb-2" />
              <p className="text-xs font-semibold text-gray-600">Memuat berkas bukti...</p>
            </div>
          )}

          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedUrl}
              alt={fileName}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-md border border-gray-200 bg-white"
            />
          ) : isPdf ? (
            <iframe
              src={resolvedUrl}
              title={fileName}
              onLoad={() => setLoading(false)}
              className="w-full h-[70vh] rounded-2xl border border-gray-200 bg-white shadow-sm"
            />
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-800 mb-1">{fileName}</p>
              <p className="text-xs text-gray-500 mb-4">
                Pratinjau langsung di dalam browser tidak didukung untuk tipe berkas ini.
              </p>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0056b3] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" /> Unduh Berkas
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
