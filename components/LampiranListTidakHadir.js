// components/LampiranListTidakHadir.js
'use client';

import React, { useMemo } from 'react';

// Chunk array helper function (chunk size 40)
function chunkArray(arr, size = 40) {
  if (!arr || arr.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default function LampiranListTidakHadir({
  data = [],
  selectedTraining = '', // '' berarti semua training
}) {
  // 1. Kelompokkan data per jenis training & deduplikasi peserta berdasarkan (training + NIK)
  const groupedData = useMemo(() => {
    const groups = {};
    const seenPerTraining = new Set();

    for (const item of data) {
      const trName = String(item.training || 'LAINNYA').trim().toUpperCase();
      const nik = String(item.nik || '').trim();
      const dedupKey = `${trName}__${nik}`;

      if (seenPerTraining.has(dedupKey)) {
        continue; // Abaikan duplikat
      }
      seenPerTraining.add(dedupKey);

      if (!groups[trName]) {
        groups[trName] = [];
      }
      groups[trName].push({
        ...item,
        training: trName,
        nik,
        nama: String(item.nama || '').trim().toUpperCase(),
        kd_toko: String(item.kd_toko || item.kode_toko || '-').trim().toUpperCase(),
        nama_toko: String(item.nama_toko || '-').trim().toUpperCase(),
        alasan_tidak_hadir: String(item.alasan_tidak_hadir || item.alasan || '-').trim(),
      });
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedKeys.map((key) => ({
      training: key,
      items: groups[key],
    }));
  }, [data]);

  // 2. Filter jika pengguna memilih jenis training tertentu
  const filteredGroups = useMemo(() => {
    if (!selectedTraining) return groupedData;
    return groupedData.filter(
      (g) => g.training.toLowerCase() === selectedTraining.toLowerCase()
    );
  }, [groupedData, selectedTraining]);

  // 3. Pagination & Chunking (maksimal 40 baris per lembar A4, 1 jenis training per lembar)
  const sheets = useMemo(() => {
    if (filteredGroups.length === 0) {
      return [
        {
          sheetId: 'empty-sheet',
          training: '-',
          items: [],
          startIndex: 0,
          pageNumber: 1,
          totalItemsInGroup: 0,
          isEmpty: true,
        },
      ];
    }

    const resultSheets = [];
    let currentPageCounter = 0;

    for (const group of filteredGroups) {
      const chunks = chunkArray(group.items, 40);

      if (chunks.length === 0) {
        currentPageCounter++;
        resultSheets.push({
          sheetId: `empty-${group.training}`,
          training: group.training,
          items: [],
          startIndex: 0,
          pageNumber: currentPageCounter,
          totalItemsInGroup: 0,
          isEmpty: true,
        });
      } else {
        chunks.forEach((chunk, chunkIdx) => {
          currentPageCounter++;
          resultSheets.push({
            sheetId: `${group.training}-p${chunkIdx + 1}`,
            training: group.training,
            items: chunk,
            startIndex: chunkIdx * 40,
            pageNumber: currentPageCounter,
            totalItemsInGroup: group.items.length,
            isEmpty: false,
          });
        });
      }
    }

    return resultSheets;
  }, [filteredGroups]);

  const totalSheetsCount = sheets.length;

  return (
    <div className="lampiran-container text-black">
      {sheets.map((sheet, sheetIdx) => {
        const isLastSheet = sheetIdx === totalSheetsCount - 1;

        return (
          <div
            key={sheet.sheetId}
            className={`sheet ${isLastSheet ? 'last-sheet' : ''}`}
          >
            {/* Header Lembar A4 (Sesuai Aturan 1: Dalam alur normal dokumen) */}
            <div className="sheet-header text-center mb-3">
              <h1 className="text-[13pt] font-bold tracking-wide uppercase leading-tight text-black m-0 p-0 font-serif">
                LAMPIRAN DETAIL PESERTA TIDAK HADIR
              </h1>
              <h2 className="text-[12pt] font-bold tracking-wide uppercase leading-tight text-black mt-1 m-0 p-0 font-serif">
                JENIS TRAINING: {sheet.training}
              </h2>
            </div>

            {/* Tabel / Konten Lembar */}
            <div className="sheet-body w-full">
              {sheet.isEmpty ? (
                <div className="p-12 text-center text-gray-500 italic border border-black rounded mt-4">
                  Tidak ada data peserta tidak hadir.
                </div>
              ) : (
                <table
                  className="sheet-table w-full text-left border-collapse"
                  style={{
                    tableLayout: 'fixed',
                    width: '100%',
                    borderCollapse: 'collapse',
                    border: '1.5px solid #000000',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#ffffff' }}>
                      <th
                        className="font-bold uppercase text-center text-black"
                        style={{
                          border: '1.5px solid #000000',
                          width: '5%',
                          padding: '1mm 2mm',
                          fontSize: '9pt',
                        }}
                      >
                        NO
                      </th>
                      <th
                        className="font-bold uppercase text-center text-black"
                        style={{
                          border: '1.5px solid #000000',
                          width: '14%',
                          padding: '1mm 2mm',
                          fontSize: '9pt',
                        }}
                      >
                        TRAINING
                      </th>
                      <th
                        className="font-bold uppercase text-center text-black"
                        style={{
                          border: '1.5px solid #000000',
                          width: '14%',
                          padding: '1mm 2mm',
                          fontSize: '9pt',
                        }}
                      >
                        NIK
                      </th>
                      <th
                        className="font-bold uppercase text-black text-left"
                        style={{
                          border: '1.5px solid #000000',
                          width: '25%',
                          padding: '1mm 2mm',
                          fontSize: '9pt',
                        }}
                      >
                        NAMA
                      </th>
                      <th
                        className="font-bold uppercase text-center text-black"
                        style={{
                          border: '1.5px solid #000000',
                          width: '10%',
                          padding: '1mm 2mm',
                          fontSize: '9pt',
                        }}
                      >
                        KD TOKO
                      </th>
                      <th
                        className="font-bold uppercase text-black text-left"
                        style={{
                          border: '1.5px solid #000000',
                          width: '20%',
                          padding: '1mm 2mm',
                          fontSize: '9pt',
                        }}
                      >
                        NAMA TOKO
                      </th>
                      <th
                        className="font-bold uppercase text-black text-left"
                        style={{
                          border: '1.5px solid #000000',
                          width: '12%',
                          padding: '1mm 2mm',
                          fontSize: '9pt',
                        }}
                      >
                        ALASAN TIDAK HADIR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.items.map((row, rIdx) => {
                      const rowNumber = sheet.startIndex + rIdx + 1;
                      return (
                        <tr key={row.id || `${row.nik}-${rIdx}`} style={{ height: '6mm' }}>
                          <td
                            className="text-center font-medium text-black"
                            style={{
                              border: '1px solid #000000',
                              padding: '1mm 2mm',
                              fontSize: '9pt',
                              lineHeight: '1.2',
                            }}
                          >
                            {rowNumber}
                          </td>
                          <td
                            className="text-center uppercase font-medium text-black"
                            style={{
                              border: '1px solid #000000',
                              padding: '1mm 2mm',
                              fontSize: '9pt',
                              lineHeight: '1.2',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {row.training}
                          </td>
                          <td
                            className="text-center font-mono font-medium text-black"
                            style={{
                              border: '1px solid #000000',
                              padding: '1mm 2mm',
                              fontSize: '9pt',
                              lineHeight: '1.2',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {row.nik}
                          </td>
                          <td
                            className="uppercase font-medium text-black"
                            style={{
                              border: '1px solid #000000',
                              padding: '1mm 2mm',
                              fontSize: '9pt',
                              lineHeight: '1.2',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {row.nama}
                          </td>
                          <td
                            className="text-center uppercase font-medium text-black"
                            style={{
                              border: '1px solid #000000',
                              padding: '1mm 2mm',
                              fontSize: '9pt',
                              lineHeight: '1.2',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {row.kd_toko || '-'}
                          </td>
                          <td
                            className="uppercase font-medium text-black"
                            style={{
                              border: '1px solid #000000',
                              padding: '1mm 2mm',
                              fontSize: '9pt',
                              lineHeight: '1.2',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {row.nama_toko || '-'}
                          </td>
                          <td
                            className="uppercase font-medium text-black"
                            style={{
                              border: '1px solid #000000',
                              padding: '1mm 2mm',
                              fontSize: '9pt',
                              lineHeight: '1.2',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {row.alasan_tidak_hadir || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer Lembar A4 (Sesuai Aturan 1: Pakai margin-top: auto, bukan position: absolute) */}
            <div
              className="sheet-footer pt-2 border-t border-black flex items-center justify-between text-black text-[8.5pt]"
              style={{ marginTop: 'auto' }}
            >
              <span className="italic text-gray-800">
                Dokumen Rekapitulasi Ketidakhadiran Peserta Training &bull; Jenis Training: {sheet.training} ({sheet.totalItemsInGroup} Peserta)
              </span>
              <span className="font-bold text-black">
                Halaman {sheet.pageNumber}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
