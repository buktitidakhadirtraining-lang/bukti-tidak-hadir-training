// components/LampiranListTidakHadir.js
'use client';

import React, { useMemo } from 'react';

// Batasan baris per halaman yang aman dan terkalibrasi persis untuk A4 (Sesuai Gambar 5)
// Halaman 1 memiliki judul besar, halaman lanjutan judul ringkas
const ROWS_PER_PAGE_FIRST = 18; 
const ROWS_PER_PAGE_SUBSEQUENT = 22;

export default function LampiranListTidakHadir({
  data = [],
  selectedTraining = '', // '' berarti semua training
}) {
  // Kelompokkan data per jenis training
  const groupedData = useMemo(() => {
    const groups = {};
    for (const item of data) {
      const trName = (item.training || 'LAINNYA').trim();
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

  // Pecah setiap kelompok training menjadi halaman-halaman rapi (Sesuai Gambar 5)
  // agar PDF tidak pernah terputus di tengah dokumen
  const pagedList = useMemo(() => {
    const pages = [];
    let globalPageNum = 1;

    for (const group of filteredGroups) {
      const totalItems = group.items.length;
      let startIndex = 0;
      let pageInGroup = 1;

      while (startIndex < totalItems) {
        const pageSize = pageInGroup === 1 ? ROWS_PER_PAGE_FIRST : ROWS_PER_PAGE_SUBSEQUENT;
        const pageItems = group.items.slice(startIndex, startIndex + pageSize);

        pages.push({
          training: group.training,
          isFirstPageOfGroup: pageInGroup === 1,
          pageInGroup,
          globalPageNum,
          startRowNumber: startIndex + 1,
          items: pageItems,
          totalGroupItems: totalItems,
        });

        startIndex += pageSize;
        pageInGroup++;
        globalPageNum++;
      }
    }

    return pages;
  }, [filteredGroups]);

  if (pagedList.length === 0) {
    return (
      <div className="bg-white p-12 text-center text-gray-500 italic max-w-4xl mx-auto rounded-xl border border-gray-200">
        Tidak ada data peserta tidak hadir untuk kriteria yang dipilih.
      </div>
    );
  }

  return (
    <div className="text-black space-y-6 print:space-y-0">
      {pagedList.map((page, idx) => (
        <React.Fragment key={`${page.training}-p${page.pageInGroup}-${page.globalPageNum}`}>
          {/* Sisipkan pemisah halaman khusus html2pdf agar halaman terputus bersih tanpa memotong baris */}
          {idx > 0 && (
            <div
              className="html2pdf__page-break"
              style={{
                pageBreakBefore: 'always',
                breakBefore: 'page',
                height: 0,
                display: 'block',
              }}
            />
          )}

          <div
            className={`bg-white p-6 sm:p-8 max-w-4xl mx-auto shadow-sm rounded-xl border border-gray-200 print:border-0 print:p-0 print:shadow-none print:max-w-none flex flex-col justify-between pdf-page-container ${
              idx > 0 ? 'print-page-break' : ''
            }`}
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              pageBreakBefore: idx > 0 ? 'always' : 'auto',
              breakBefore: idx > 0 ? 'page' : 'auto',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <div>
              {/* Header Lampiran (Halaman pertama tiap training menampilkan judul penuh, halaman lanjutan judul ringkas) */}
              {page.isFirstPageOfGroup ? (
                <div className="text-center space-y-0.5 mb-4">
                  <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight">
                    LAMPIRAN DETAIL PESERTA TIDAK HADIR
                  </h1>
                  <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight">
                    JENIS TRAINING {page.training}
                  </h2>
                </div>
              ) : (
                <div className="text-center space-y-0.5 mb-3">
                  <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-gray-800 leading-tight">
                    LAMPIRAN DETAIL PESERTA TIDAK HADIR — JENIS TRAINING {page.training} (LANJUTAN)
                  </h2>
                </div>
              )}

              {/* Tabel Detail Peserta (Header selalu diulang di setiap halaman seperti Gambar 5) */}
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left border-collapse"
                  style={{ border: '1.5px solid #000000', fontSize: '11px' }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#ffffff' }}>
                      <th
                        className="p-1 font-bold uppercase text-center"
                        style={{ border: '1.5px solid #000000', width: '36px' }}
                      >
                        NO
                      </th>
                      <th
                        className="p-1 font-bold uppercase text-center"
                        style={{ border: '1.5px solid #000000', width: '120px' }}
                      >
                        TRAINING
                      </th>
                      <th
                        className="p-1 font-bold uppercase text-center"
                        style={{ border: '1.5px solid #000000', width: '95px' }}
                      >
                        NIK
                      </th>
                      <th
                        className="p-1 font-bold uppercase"
                        style={{ border: '1.5px solid #000000' }}
                      >
                        NAMA
                      </th>
                      <th
                        className="p-1 font-bold uppercase text-center"
                        style={{ border: '1.5px solid #000000', width: '70px' }}
                      >
                        KD TOKO
                      </th>
                      <th
                        className="p-1 font-bold uppercase"
                        style={{ border: '1.5px solid #000000', width: '140px' }}
                      >
                        NAMA TOKO
                      </th>
                      <th
                        className="p-1 font-bold uppercase"
                        style={{ border: '1.5px solid #000000', width: '160px' }}
                      >
                        ALASAN TIDAK HADIR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((row, rIdx) => {
                      const rowNumber = page.startRowNumber + rIdx;
                      return (
                        <tr
                          key={row.id || `${row.nik}-${rIdx}`}
                          style={{
                            pageBreakInside: 'avoid',
                            breakInside: 'avoid',
                          }}
                        >
                          <td
                            className="p-1 text-center font-medium"
                            style={{ border: '1px solid #000000' }}
                          >
                            {rowNumber}
                          </td>
                          <td
                            className="p-1 text-center uppercase font-medium"
                            style={{ border: '1px solid #000000' }}
                          >
                            {row.training}
                          </td>
                          <td
                            className="p-1 text-center font-mono font-medium"
                            style={{ border: '1px solid #000000' }}
                          >
                            {row.nik}
                          </td>
                          <td
                            className="p-1 uppercase font-medium"
                            style={{ border: '1px solid #000000' }}
                          >
                            {row.nama}
                          </td>
                          <td
                            className="p-1 text-center uppercase font-medium"
                            style={{ border: '1px solid #000000' }}
                          >
                            {row.kd_toko || '-'}
                          </td>
                          <td
                            className="p-1 uppercase font-medium"
                            style={{ border: '1px solid #000000' }}
                          >
                            {row.nama_toko || '-'}
                          </td>
                          <td
                            className="p-1 uppercase font-medium"
                            style={{ border: '1px solid #000000' }}
                          >
                            {row.alasan_tidak_hadir || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Nomor Halaman di Sudut Kanan Bawah (Sesuai Gambar 5) */}
            <div
              className="pt-3 mt-4 flex items-center justify-between text-xs text-gray-700 border-t border-gray-200 print:border-t-0"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              <span className="italic text-[10px] text-gray-500">
                Dokumen Rekapitulasi Ketidakhadiran Peserta Training
              </span>
              <span className="font-bold text-xs text-black">
                Halaman {page.globalPageNum}
              </span>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
