// components/LampiranListTidakHadir.js
'use client';

import React, { useMemo } from 'react';

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

    // Urutkan nama training secara alfabetis
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
    <div className="space-y-10 print:space-y-0 text-black">
      {filteredGroups.map((group, gIdx) => (
        <div
          key={group.training}
          className={`bg-white p-8 sm:p-10 max-w-4xl mx-auto shadow-sm rounded-xl border border-gray-200 print:border-0 print:p-0 print:shadow-none print:max-w-none ${
            gIdx > 0 ? 'print-page-break' : ''
          }`}
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >
          {/* Header Lampiran (Sesuai Gambar 4) */}
          <div className="text-center space-y-1 mb-6">
            <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase">
              LAMPIRAN DETAIL PESERTA TIDAK HADIR
            </h1>
            <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase">
              JENIS TRAINING {group.training}
            </h2>
          </div>

          {/* Tabel Detail Peserta (Sesuai Gambar 4) */}
          <div className="overflow-x-auto">
            <table
              className="w-full text-left border-collapse"
              style={{ border: '1.5px solid #000000', fontSize: '11px' }}
            >
              <thead>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <th
                    className="p-1.5 font-bold uppercase text-center"
                    style={{ border: '1.5px solid #000000', width: '38px' }}
                  >
                    NO
                  </th>
                  <th
                    className="p-1.5 font-bold uppercase text-center"
                    style={{ border: '1.5px solid #000000', width: '130px' }}
                  >
                    TRAINING
                  </th>
                  <th
                    className="p-1.5 font-bold uppercase text-center"
                    style={{ border: '1.5px solid #000000', width: '95px' }}
                  >
                    NIK
                  </th>
                  <th
                    className="p-1.5 font-bold uppercase"
                    style={{ border: '1.5px solid #000000' }}
                  >
                    NAMA
                  </th>
                  <th
                    className="p-1.5 font-bold uppercase text-center"
                    style={{ border: '1.5px solid #000000', width: '75px' }}
                  >
                    KD TOKO
                  </th>
                  <th
                    className="p-1.5 font-bold uppercase"
                    style={{ border: '1.5px solid #000000', width: '150px' }}
                  >
                    NAMA TOKO
                  </th>
                  <th
                    className="p-1.5 font-bold uppercase"
                    style={{ border: '1.5px solid #000000', width: '170px' }}
                  >
                    ALASAN TIDAK HADIR
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((row, rIdx) => (
                  <tr key={row.id || rIdx} className="print-break-avoid">
                    <td
                      className="p-1.5 text-center font-medium"
                      style={{ border: '1px solid #000000' }}
                    >
                      {rIdx + 1}
                    </td>
                    <td
                      className="p-1.5 text-center uppercase font-medium"
                      style={{ border: '1px solid #000000' }}
                    >
                      {row.training}
                    </td>
                    <td
                      className="p-1.5 text-center font-mono font-medium"
                      style={{ border: '1px solid #000000' }}
                    >
                      {row.nik}
                    </td>
                    <td
                      className="p-1.5 uppercase font-medium"
                      style={{ border: '1px solid #000000' }}
                    >
                      {row.nama}
                    </td>
                    <td
                      className="p-1.5 text-center uppercase font-medium"
                      style={{ border: '1px solid #000000' }}
                    >
                      {row.kd_toko || '-'}
                    </td>
                    <td
                      className="p-1.5 uppercase font-medium"
                      style={{ border: '1px solid #000000' }}
                    >
                      {row.nama_toko || '-'}
                    </td>
                    <td
                      className="p-1.5 uppercase font-medium"
                      style={{ border: '1px solid #000000' }}
                    >
                      {row.alasan_tidak_hadir || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
