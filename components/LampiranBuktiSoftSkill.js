// components/LampiranBuktiSoftSkill.js
'use client';

import React, { useMemo } from 'react';
import { ImageIcon } from 'lucide-react';

function chunkArray(arr, size = 3) {
  if (!arr || arr.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default function LampiranBuktiSoftSkill({
  data = [],
  records = [],
  cabang = 'Surabaya',
  kategoriLabel = 'Pimpinan Shift',
  showInstructionText = false,
  startPageNumber = 2,
  totalDocPages = 2,
}) {
  // Peta bukti foto per NIK peserta (ambil yang terbaru atau semua foto yang ada)
  const participantPhotos = useMemo(() => {
    const map = new Map();
    for (const p of data) {
      const cleanNik = String(p.nik || '').trim();
      const matched = (records || [])
        .filter(
          (r) =>
            String(r.nik || '').trim() === cleanNik &&
            r.drive_file_id &&
            (!r.file_mime_type || r.file_mime_type.startsWith('image/'))
        )
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      map.set(cleanNik, matched);
    }
    return map;
  }, [data, records]);

  // Pembagian maksimal 3 peserta per halaman lampiran A4
  const chunks = useMemo(() => chunkArray(data, 3), [data]);

  if (!data || data.length === 0) return null;

  return (
    <div className="lampiran-soft-skill-container space-y-8 print:space-y-0">
      {chunks.map((chunk, pageIdx) => {
        const isLastPage = pageIdx === chunks.length - 1;
        const currentPage = startPageNumber + pageIdx;

        return (
          <div
            key={`attach-page-${pageIdx}`}
            className={`sheet ${isLastPage ? 'last-sheet' : ''} text-black flex flex-col justify-between`}
            style={{
              fontFamily: 'Arial, Helvetica, sans-serif',
              boxSizing: 'border-box',
            }}
          >
            {/* 1. Header Lampiran Bukti Kelengkapan / Foto Peserta */}
            <div className="text-center mb-3">
              <h1
                className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight"
                style={{ color: '#1E60D5' }}
              >
                LAMPIRAN BUKTI FOTO PESERTA - BERITA ACARA SOFT SKILL
              </h1>
              <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-gray-800 mt-0.5">
                KATEGORI: {kategoriLabel.toUpperCase()} &bull; CABANG: {cabang.toUpperCase()}
              </h2>
              {showInstructionText && (
                <p
                  className="text-[11px] italic mt-1 leading-snug px-4"
                  style={{ color: '#1E60D5' }}
                >
                  Instruksi: Silakan hapus teks petunjuk ini dan tempelkan foto/scan bukti kelengkapan (misal: surat keterangan dokter, disposisi pimpinan, dsb.) pada kotak yang telah disediakan.
                </p>
              )}
            </div>

            {/* 2. Daftar 3 Blok Peserta (Tinggi rata & proporsional) */}
            <div className="flex-1 flex flex-col justify-between gap-3 overflow-hidden">
              {chunk.map((row) => {
                const cleanNik = String(row.nik || '').trim();
                const photos = participantPhotos.get(cleanNik) || [];

                return (
                  <div
                    key={row.id || `${row.nik}-${row.no}`}
                    className="w-full flex-1 flex flex-col justify-between p-2 rounded-xs border border-gray-300 bg-white"
                    style={{
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      minHeight: '68mm',
                      maxHeight: '74mm',
                    }}
                  >
                    {/* Baris a: Judul Tebal: "<no>. NIK: <nik> - <NAMA>" */}
                    <div className="font-bold text-xs uppercase text-black truncate leading-tight">
                      {row.no}. NIK: {row.nik} - {row.nama}
                    </div>

                    {/* Baris b: Keterangan */}
                    <div className="text-[10px] text-gray-700 leading-tight">
                      Kategori: <span className="font-medium">{row.kategory || row.kategori || '-'}</span> | Alasan:{' '}
                      <span className="font-medium">{row.detail_alasan || row.alasan || '-'}</span> | Kelengkapan Wajib:
                    </div>

                    {/* Baris c: Kotak Foto Bukti (Contain, utuh & rasio asli) */}
                    <div className="w-full flex-1 min-h-[48mm] max-h-[54mm] border border-black rounded-xs bg-gray-50/50 p-1 flex items-center justify-center overflow-hidden">
                      {photos.length > 0 ? (
                        <div className="w-full h-full flex items-center justify-center gap-2 overflow-hidden">
                          {photos.map((photo, pIdx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={photo.id || pIdx}
                              src={`/api/records/${photo.id}/file`}
                              alt={`Bukti ${row.nama}`}
                              crossOrigin="anonymous"
                              className="max-h-[50mm] max-w-full h-auto w-auto object-contain mx-auto"
                              style={{ objectFit: 'contain' }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 italic text-[11px] py-3">
                          <ImageIcon className="w-6 h-6 text-gray-300 mb-1" />
                          <span>Belum ada bukti foto</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. Footer Lampiran */}
            <div
              className="sheet-footer pt-2 mt-2 flex items-center justify-between border-t border-black text-[8pt] text-gray-600"
              style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
            >
              <span>
                Lampiran Bukti Kelengkapan &bull; Kategori: {kategoriLabel} &bull; Cabang: {cabang}
              </span>
              <span className="font-bold text-black">
                Halaman {currentPage} dari {totalDocPages}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
