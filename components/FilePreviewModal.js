// components/FilePreviewModal.js
'use client';

import { X, Download, FileText, ExternalLink } from 'lucide-react';

export default function FilePreviewModal({
  isOpen,
  fileUrl,
  fileName = 'Berkas Bukti',
  mimeType = '',
  onClose,
}) {
  if (!isOpen || !fileUrl) return null;

  const isPdf = mimeType.includes('pdf') || fileUrl.toLowerCase().endsWith('.pdf');
  const isImage = mimeType.startsWith('image/') || (!isPdf && !mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-800 truncate">{fileName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={fileName}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title="Unduh / Buka di Tab Baru"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-100/50 min-h-[300px]">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
            />
          ) : isPdf ? (
            <iframe
              src={fileUrl}
              title={fileName}
              className="w-full h-[70vh] rounded-lg border border-gray-200"
            />
          ) : (
            <div className="text-center p-8">
              <p className="text-sm text-gray-600 mb-4">
                Pratinjau langsung tidak tersedia untuk tipe berkas ini.
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ExternalLink className="w-4 h-4" /> Buka Berkas
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
