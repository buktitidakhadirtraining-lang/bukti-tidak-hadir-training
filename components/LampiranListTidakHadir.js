// components/LampiranListTidakHadir.js
'use client';

import React, { useMemo } from 'react';

export default function LampiranListTidakHadir({
  data = [],
  selectedTraining = '', // '' berarti semua training
}) {
  // Kelompokkan data per jenis training dan deduplikasi jika ada item yang sama
  const groupedData = useMemo(() => {
    const groups = {};
    const seenPerTraining = new Set();

    for (const item of data) {
      const trName = (item.training || 'LAINNYA').trim().toUpperCase();
      const nik = String(item.nik || '').trim();
      const dedupKey = `${trName}__${nik}`;

      if (seenPerTraining.has(dedupKey)) {
        continue; // Lewati jika duplikat
      }
      seenPerTraining.add(dedupKey);

      if (!groups[trName]) {
        groups[trName] = [];
      }
      groups[trName].push(item);
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedKeys.map((key) => ({
      training: key,
      items: groups[key],
    }));
  }, [data]);

  // Filter jika pengguna memilih training tertentu
  const filteredGroups = useMemo(() => {
    if (!selectedTraining) return groupedData;
    return groupedData.filter(
      (g) => g.training.toLowerCase() === selectedTraining.toLowerCase()
    );
  }, [groupedData, selectedTraining]);

  if (filteredGroups.length === 0) {
    return (
      <div className="bg-white p-12 text-center text-gray-500 italic max-w-4xl mx-auto rounded-xl border border-gray-200">
        Tidak ada data peserta tidak hadir untuk kriteria yang dipilih.
      </div>
    );
  }

  return (
    <div className="text-black space-y-8 print:space-y-0">
      {filteredGroups.map((group, groupIdx) => {
        const count = group.items.length;
        const isCompact = count > 15;
        const isVeryCompact = count > 22;

        const cellPadding = isVeryCompact ? 'py-1 px-1' : isCompact ? 'py-1.5 px-1.5' : 'py-2 px-2';
        const fontSize = isVeryCompact ? '10px' : isCompact ? '10.5px' : '11px';

        return (
          <div
            key={group.training}
            className={`bg-white p-6 sm:p-8 max-w-4xl mx-auto rounded-xl border border-gray-200 shadow-sm print:border-0 print:p-0 print:shadow-none print:max-w-none mb-8 print:mb-0 relative ${
              groupIdx > 0 ? 'print-page-break html2pdf__page-break' : ''
            }`}
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              pageBreakAfter: 'always',
              breakAfter: 'page',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
              boxSizing: 'border-box',
              minHeight: 'auto',
            }}
          >
            {/* Header Lampiran (Sesuai Format Gambar 4 & 5) */}
            <div className="text-center space-y-1 mb-5">
              <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight text-black">
                LAMPIRAN DETAIL PESERTA TIDAK HADIR
              </h1>
              <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight text-black">
                JENIS TRAINING {group.training}
              </h2>
            </div>

            {/* Tabel Detail Peserta 1 Training 1 Lembar */}
            <div className="w-full mb-6">
              <table
                className="w-full text-left border-collapse table-fixed"
                style={{ border: '1.5px solid #000000', fontSize }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#ffffff' }}>
                    <th
                      className="py-2 px-1 font-bold uppercase text-center text-black"
                      style={{ border: '1.5px solid #000000', width: '6%' }}
                    >
                      NO
                    </th>
                    <th
                      className="py-2 px-1 font-bold uppercase text-center text-black"
                      style={{ border: '1.5px solid #000000', width: '15%' }}
                    >
                      TRAINING
                    </th>
                    <th
                      className="py-2 px-1 font-bold uppercase text-center text-black"
                      style={{ border: '1.5px solid #000000', width: '15%' }}
                    >
                      NIK
                    </th>
                    <th
                      className="py-2 px-2 font-bold uppercase text-black"
                      style={{ border: '1.5px solid #000000', width: '22%' }}
                    >
                      NAMA
                    </th>
                    <th
                      className="py-2 px-1 font-bold uppercase text-center text-black"
                      style={{ border: '1.5px solid #000000', width: '10%' }}
                    >
                      KD TOKO
                    </th>
                    <th
                      className="py-2 px-2 font-bold uppercase text-black"
                      style={{ border: '1.5px solid #000000', width: '17%' }}
                    >
                      NAMA TOKO
                    </th>
                    <th
                      className="py-2 px-2 font-bold uppercase text-black"
                      style={{ border: '1.5px solid #000000', width: '15%' }}
                    >
                      ALASAN TIDAK HADIR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((row, rIdx) => (
                    <tr
                      key={row.id || `${row.nik}-${rIdx}`}
                      style={{
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                      }}
                    >
                      <td
                        className={`${cellPadding} text-center font-medium text-black`}
                        style={{ border: '1px solid #000000' }}
                      >
                        {rIdx + 1}
                      </td>
                      <td
                        className={`${cellPadding} text-center uppercase font-medium text-black break-words`}
                        style={{ border: '1px solid #000000' }}
                      >
                        {row.training}
                      </td>
                      <td
                        className={`${cellPadding} text-center font-mono font-medium text-black break-words`}
                        style={{ border: '1px solid #000000' }}
                      >
                        {row.nik}
                      </td>
                      <td
                        className={`${cellPadding} uppercase font-medium text-black break-words`}
                        style={{ border: '1px solid #000000' }}
                      >
                        {row.nama}
                      </td>
                      <td
                        className={`${cellPadding} text-center uppercase font-medium text-black break-words`}
                        style={{ border: '1px solid #000000' }}
                      >
                        {row.kd_toko || '-'}
                      </td>
                      <td
                        className={`${cellPadding} uppercase font-medium text-black break-words`}
                        style={{ border: '1px solid #000000' }}
                      >
                        {row.nama_toko || '-'}
                      </td>
                      <td
                        className={`${cellPadding} uppercase font-medium text-black break-words`}
                        style={{ border: '1px solid #000000' }}
                      >
                        {row.alasan_tidak_hadir || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Nomor Halaman di Sudut Kanan Bawah */}
            <div
              className="pt-3 mt-4 flex items-center justify-between text-xs text-gray-700 border-t border-gray-200 print:border-t-0"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              <span className="italic text-[10px] text-gray-500">
                Dokumen Rekapitulasi Ketidakhadiran Peserta Training &bull; Jenis Training {group.training} ({group.items.length} Peserta)
              </span>
              <span className="font-bold text-xs text-black">
                Halaman {groupIdx + 1}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
