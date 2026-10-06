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
    <div
      className="lampiran-container text-black"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {sheets.map((sheet, sheetIdx) => {
        const isLastSheet = sheetIdx === totalSheetsCount - 1;
        const itemCount = sheet.items ? sheet.items.length : 0;
        // Pengecekan ukuran font dan padding: jika > 30 baris, gunakan 8.5pt dan 1.2mm
        const cellFontSize = itemCount > 30 ? '8.5pt' : '9pt';
        const cellPadding = itemCount > 30 ? '1.2mm 2mm' : '1.6mm 2mm';

        return (
          <div
            key={sheet.sheetId}
            className={`sheet ${isLastSheet ? 'last-sheet' : ''}`}
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            {/* Header Lembar A4 */}
            <div className="sheet-header text-center" style={{ marginBottom: '0' }}>
              <h1
                style={{
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '15pt',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  color: '#000000',
                  margin: 0,
                  padding: 0,
                  lineHeight: '1.2',
                }}
              >
                LAMPIRAN DETAIL PESERTA TIDAK HADIR
              </h1>
              <h2
                style={{
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '12pt',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  color: '#000000',
                  marginTop: '2mm',
                  marginBottom: '6mm',
                  padding: 0,
                  lineHeight: '1.2',
                }}
              >
                JENIS TRAINING: {sheet.training}
              </h2>
            </div>

            {/* Tabel / Konten Lembar */}
            <div className="sheet-body w-full">
              {sheet.isEmpty ? (
                <div
                  className="p-12 text-center text-gray-500 rounded"
                  style={{ border: '0.75px solid #000000', fontFamily: 'Arial, Helvetica, sans-serif' }}
                >
                  Tidak ada data peserta tidak hadir.
                </div>
              ) : (
                <table
                  className="sheet-table w-full text-left border-collapse"
                  style={{
                    tableLayout: 'fixed',
                    width: '100%',
                    borderCollapse: 'collapse',
                    border: '0.75px solid #000000',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f2f2f2' }}>
                      <th
                        style={{
                          border: '0.75px solid #000000',
                          width: '5%',
                          padding: cellPadding,
                          fontSize: cellFontSize,
                          fontWeight: 'bold',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          color: '#000000',
                        }}
                      >
                        NO
                      </th>
                      <th
                        style={{
                          border: '0.75px solid #000000',
                          width: '14%',
                          padding: cellPadding,
                          fontSize: cellFontSize,
                          fontWeight: 'bold',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          color: '#000000',
                        }}
                      >
                        TRAINING
                      </th>
                      <th
                        style={{
                          border: '0.75px solid #000000',
                          width: '13%',
                          padding: cellPadding,
                          fontSize: cellFontSize,
                          fontWeight: 'bold',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          color: '#000000',
                        }}
                      >
                        NIK
                      </th>
                      <th
                        style={{
                          border: '0.75px solid #000000',
                          width: '24%',
                          padding: cellPadding,
                          fontSize: cellFontSize,
                          fontWeight: 'bold',
                          textAlign: 'left',
                          verticalAlign: 'middle',
                          color: '#000000',
                        }}
                      >
                        NAMA
                      </th>
                      <th
                        style={{
                          border: '0.75px solid #000000',
                          width: '9%',
                          padding: cellPadding,
                          fontSize: cellFontSize,
                          fontWeight: 'bold',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          color: '#000000',
                        }}
                      >
                        KD TOKO
                      </th>
                      <th
                        style={{
                          border: '0.75px solid #000000',
                          width: '20%',
                          padding: cellPadding,
                          fontSize: cellFontSize,
                          fontWeight: 'bold',
                          textAlign: 'left',
                          verticalAlign: 'middle',
                          color: '#000000',
                        }}
                      >
                        NAMA TOKO
                      </th>
                      <th
                        style={{
                          border: '0.75px solid #000000',
                          width: '15%',
                          padding: cellPadding,
                          fontSize: cellFontSize,
                          fontWeight: 'bold',
                          textAlign: 'left',
                          verticalAlign: 'middle',
                          color: '#000000',
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
                        <tr key={row.id || `${row.nik}-${rIdx}`}>
                          <td
                            style={{
                              border: '0.75px solid #000000',
                              padding: cellPadding,
                              fontSize: cellFontSize,
                              lineHeight: '1.3',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              whiteSpace: 'nowrap',
                              color: '#000000',
                            }}
                          >
                            {rowNumber}
                          </td>
                          <td
                            style={{
                              border: '0.75px solid #000000',
                              padding: cellPadding,
                              fontSize: cellFontSize,
                              lineHeight: '1.3',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              textTransform: 'uppercase',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              color: '#000000',
                            }}
                          >
                            {row.training}
                          </td>
                          <td
                            style={{
                              border: '0.75px solid #000000',
                              padding: cellPadding,
                              fontSize: cellFontSize,
                              lineHeight: '1.3',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              whiteSpace: 'nowrap',
                              fontVariantNumeric: 'tabular-nums',
                              color: '#000000',
                            }}
                          >
                            {row.nik}
                          </td>
                          <td
                            style={{
                              border: '0.75px solid #000000',
                              padding: cellPadding,
                              fontSize: cellFontSize,
                              lineHeight: '1.3',
                              textAlign: 'left',
                              verticalAlign: 'middle',
                              textTransform: 'uppercase',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              color: '#000000',
                            }}
                          >
                            {row.nama}
                          </td>
                          <td
                            style={{
                              border: '0.75px solid #000000',
                              padding: cellPadding,
                              fontSize: cellFontSize,
                              lineHeight: '1.3',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              whiteSpace: 'nowrap',
                              textTransform: 'uppercase',
                              color: '#000000',
                            }}
                          >
                            {row.kd_toko || '-'}
                          </td>
                          <td
                            style={{
                              border: '0.75px solid #000000',
                              padding: cellPadding,
                              fontSize: cellFontSize,
                              lineHeight: '1.3',
                              textAlign: 'left',
                              verticalAlign: 'middle',
                              textTransform: 'uppercase',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              color: '#000000',
                            }}
                          >
                            {row.nama_toko || '-'}
                          </td>
                          <td
                            style={{
                              border: '0.75px solid #000000',
                              padding: cellPadding,
                              fontSize: cellFontSize,
                              lineHeight: '1.3',
                              textAlign: 'left',
                              verticalAlign: 'middle',
                              textTransform: 'uppercase',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              color: '#000000',
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

            {/* Footer Lembar A4 */}
            <div
              className="sheet-footer pt-2 flex items-center justify-between"
              style={{
                marginTop: 'auto',
                borderTop: '0.75px solid #000000',
                color: '#555555',
                fontSize: '8pt',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontStyle: 'normal',
              }}
            >
              <span style={{ color: '#555555', fontStyle: 'normal' }}>
                Dokumen Rekapitulasi Ketidakhadiran Peserta Training &bull; Jenis Training: {sheet.training} ({sheet.totalItemsInGroup} Peserta)
              </span>
              <span style={{ color: '#000000', fontWeight: 'bold' }}>
                Halaman {sheet.pageNumber}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
