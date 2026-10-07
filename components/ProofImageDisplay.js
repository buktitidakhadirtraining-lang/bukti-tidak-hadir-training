// components/ProofImageDisplay.js
'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ImageIcon, RefreshCw, CheckCircle2 } from 'lucide-react';
import { photoLoader } from '../lib/photo-loader.js';

export default function ProofImageDisplay({
  record,
  records = [], // Jika ada opsi beberapa foto untuk satu peserta
  alt = 'Bukti Ketidakhadiran',
  maxHeight = '50mm',
  onLoaded,
  className = '',
}) {
  const candidateRecords = React.useMemo(() => {
    if (records && records.length > 0) return records;
    if (record) return [record];
    return [];
  }, [record, records]);

  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const currentRecord = candidateRecords[activeCandidateIndex] || null;
  const currentId = currentRecord?.id;

  const [cacheMap, setCacheMap] = useState(() => photoLoader.getAll());

  useEffect(() => {
    const unsub = photoLoader.subscribe((updatedMap) => {
      setCacheMap(updatedMap);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (currentId) {
      photoLoader.load(currentId);
    }
  }, [currentId]);

  const photoState = currentId ? cacheMap.get(currentId) : null;
  const status = photoState?.status || (currentId ? 'loading' : 'empty');
  const error = photoState?.error;
  const isHeic = photoState?.isHeic;
  const dataUrl = photoState?.dataUrl;
  const isOutdatedScript = photoState?.isOutdatedScript;

  // Jika kandidat saat ini gagal dan masih ada kandidat foto lain untuk peserta yang sama, coba berikutnya
  useEffect(() => {
    if (status === 'error' && activeCandidateIndex < candidateRecords.length - 1) {
      setActiveCandidateIndex((prev) => prev + 1);
    }
  }, [status, activeCandidateIndex, candidateRecords.length]);

  // Notifikasi callback onLoaded
  useEffect(() => {
    if (status === 'loaded' && onLoaded && currentId) {
      onLoaded(currentId, true, null);
    } else if (status === 'error' && onLoaded && currentId && activeCandidateIndex >= candidateRecords.length - 1) {
      onLoaded(currentId, false, error);
    }
  }, [status, currentId, onLoaded, activeCandidateIndex, candidateRecords.length, error]);

  if (!currentRecord || candidateRecords.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 italic text-[10px] p-2">
        <ImageIcon className="w-5 h-5 text-gray-300 mb-1" />
        <span>Belum ada bukti foto</span>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-[10px] p-2 bg-gray-50/70">
        <Loader2 className="w-5 h-5 text-[#0056b3] animate-spin mb-1" />
        <span>Memuat foto...</span>
      </div>
    );
  }

  if (status === 'loaded' && dataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUrl}
        alt={alt}
        className={`max-h-full max-w-full w-auto h-auto object-contain mx-auto block ${className}`}
        style={{
          maxHeight: maxHeight,
          maxWidth: '100%',
          objectFit: 'contain',
          imageRendering: 'auto',
          WebkitPrintColorAdjust: 'exact',
        }}
      />
    );
  }

  // Tampilan Error / Placeholder Informatif
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-amber-50/70 rounded-xs border border-amber-200 text-[10px] text-amber-900 select-none">
      <AlertCircle className="w-4 h-4 text-amber-600 mb-1 shrink-0" />
      <span className="font-bold leading-tight">
        {isOutdatedScript ? 'Apps Script Perlu Update (v5)' : 'Foto Tidak Tersedia'}
      </span>
      <span className="text-[9px] text-amber-800 mt-0.5 max-w-[95%] break-words leading-tight">
        {isHeic
          ? 'Format HEIC/HEIF tidak didukung browser, ganti dengan JPG/PNG'
          : error || 'Foto tidak ada di Drive. Upload ulang melalui Riwayat Data Input.'}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (currentId) {
            photoLoader.load(currentId);
          }
        }}
        className="no-print mt-1.5 px-2 py-0.5 text-[9px] font-semibold bg-white hover:bg-amber-100 text-amber-800 rounded border border-amber-300 shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
        title="Coba muat ulang atau pulihkan foto ini"
      >
        <RefreshCw className="w-2.5 h-2.5" />
        Coba Lagi / Pulihkan
      </button>
    </div>
  );
}
