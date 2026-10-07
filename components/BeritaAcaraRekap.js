// components/BeritaAcaraRekap.js
'use client';

import React from 'react';

export default function BeritaAcaraRekap({
  data = [],
  ttdMode = 'ada', // 'kosong' (Gambar 2) | 'ada' (Gambar 3)
  tanggalCetak = 'Surabaya, 5 Oktober 2026',
  cabang = 'Training Center Cabang Surabaya',
  bulan = 'Oktober',
  tahun = '2026',
  ttdImages = {}, // { dbm_operasional: dataUrl, dbm_admin: dataUrl, hrd_manager: dataUrl, tc_supervisor: dataUrl }
}) {
  return (
    <div
      className="sheet text-xs leading-relaxed"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {/* 1. Header Judul Berita Acara */}
      <div className="text-center space-y-0.5 mb-4">
        <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight">
          BERITA ACARA KETIDAKHADIRAN PESERTA TRAINING
        </h1>
        <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight">
          DAN PERMOHONAN DISPENSASI KETIDAKHADIRAN
        </h2>
      </div>

      {/* 2. Paragraf Pengantar */}
      <p className="text-justify mb-3 leading-normal">
        Pada pelaksanaan kegiatan {cabang} periode Bulan <span className="font-bold">{bulan}</span> Tahun{' '}
        <span className="font-bold">{tahun}</span>, ditemukan adanya peserta training karyawan eksisting yang
        tidak dapat mengikuti beberapa jenis training. Berikut kami sampaikan rekapitulasi ketidakhadiran peserta
        berdasarkan jenis training sebagai dasar pengajuan dispensasi kepada ETD.
      </p>

      {/* 3. Tabel Rekapitulasi (Sesuai Format Gambar 2) */}
      <div className="overflow-x-auto mb-4">
        <table
          className="w-full text-center border-collapse"
          style={{ border: '0.75px solid #000000', fontSize: '11px' }}
        >
          <thead>
            <tr style={{ backgroundColor: '#ffffff' }}>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '0.75px solid #000000', width: '36px' }}
              >
                NO
              </th>
              <th
                className="p-1 font-bold uppercase text-left"
                style={{ border: '0.75px solid #000000', width: '160px' }}
              >
                JENIS TRAINING
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '0.75px solid #000000', width: '75px' }}
              >
                TARGET LSKT
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '0.75px solid #000000', width: '85px' }}
              >
                DISPENSASI
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '0.75px solid #000000', width: '75px' }}
              >
                TARGET
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '0.75px solid #000000', width: '65px' }}
              >
                HADIR
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '0.75px solid #000000', width: '65px' }}
              >
                TIDAK HADIR
              </th>
              <th
                className="p-1 font-bold uppercase text-center"
                style={{ border: '0.75px solid #000000' }}
              >
                NO LIST PESERTA TIDAK HADIR
              </th>
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={row.id || idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td className="p-1 font-semibold" style={{ border: '0.75px solid #000000' }}>
                    {row.no || idx + 1}
                  </td>
                  <td
                    className="p-1 text-left font-semibold uppercase"
                    style={{ border: '0.75px solid #000000' }}
                  >
                    {row.jenis_training}
                  </td>
                  <td className="p-1" style={{ border: '0.75px solid #000000' }}>
                    {row.target_lskt || ''}
                  </td>
                  <td className="p-1" style={{ border: '0.75px solid #000000' }}>
                    {row.dispensasi || ''}
                  </td>
                  <td className="p-1" style={{ border: '0.75px solid #000000' }}>
                    {row.target_tc_report || ''}
                  </td>
                  <td className="p-1" style={{ border: '0.75px solid #000000' }}>
                    {row.hadir || ''}
                  </td>
                  <td className="p-1" style={{ border: '0.75px solid #000000' }}>
                    {row.tidak_hadir || ''}
                  </td>
                  <td
                    className="p-1 font-medium text-center uppercase"
                    style={{ border: '0.75px solid #000000', fontSize: '10px' }}
                  >
                    {row.no_list_peserta_tidak_hadir || ''}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="p-3 italic text-center text-gray-500"
                  style={{ border: '0.75px solid #000000' }}
                >
                  Tidak ada data cetak_rekap yang tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Bagian Data Pendukung */}
      <div className="space-y-0.5 mb-3 leading-normal">
        <p className="font-bold">Data Pendukung</p>
        <p>Sebagai data pendukung, bersama Berita Acara ini kami lampirkan:</p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Daftar peserta yang tidak hadir pada masing-masing jenis training.</li>
          <li>Alasan ketidakhadiran setiap peserta.</li>
          <li>Bukti pendukung ketidakhadiran (apabila tersedia).</li>
        </ol>
      </div>

      {/* 5. Permohonan Dispensasi Ketidakhadiran */}
      <div className="space-y-0.5 mb-3 leading-normal">
        <p className="font-bold">Permohonan Dispensasi Ketidakhadiran</p>
        <p className="text-justify">
          Sehubungan dengan data ketidakhadiran tersebut, kami memohon kepada Bapak/Ibu ETD untuk memberikan
          dispensasi kepada peserta yang tercantum dalam daftar ketidakhadiran, sehingga ketidakhadiran tersebut
          tidak diperhitungkan sebagai pengurang poin rating sesuai ketentuan yang berlaku.
        </p>
      </div>

      {/* 6. Kalimat Penutup */}
      <p className="mb-4 leading-normal">
        Demikian Berita Acara dan permohonan dispensasi ini kami sampaikan. Atas perhatian dan persetujuan
        Bapak/Ibu, kami ucapkan terima kasih.
      </p>

      {/* 7. Tanggal Cetak (Rata Kanan) */}
      <div className="text-right mb-2">
        <p>{tanggalCetak}</p>
      </div>

      {/* 8. Kotak Tanda Tangan 4 Kolom (Sesuai Gambar 2 & Gambar 3) */}
      <div className="overflow-x-auto print-break-avoid" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <table
          className="w-full text-center border-collapse"
          style={{ border: '0.75px solid #000000', fontSize: '11px' }}
        >
          <thead>
            <tr>
              <th
                colSpan={3}
                className="p-1 font-bold"
                style={{ border: '0.75px solid #000000', width: '75%' }}
              >
                Mengetahui,
              </th>
              <th
                className="p-1 font-bold"
                style={{ border: '0.75px solid #000000', width: '25%' }}
              >
                Dibuat oleh,
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {/* Kolom 1: DBM Operasional */}
              <td
                className="p-1 align-bottom"
                style={{ border: '0.75px solid #000000', width: '25%' }}
              >
                <div className="h-16 flex items-center justify-center mb-1 w-full">
                  {ttdMode === 'ada' && ttdImages?.dbm_operasional ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ttdImages.dbm_operasional}
                      alt="TTD DBM Operasional"
                      crossOrigin="anonymous"
                      className="max-h-14 max-w-full object-contain mx-auto"
                    />
                  ) : (
                    <div className="h-14" />
                  )}
                </div>
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block text-center">DBM Operasional</span>
                </div>
              </td>

              {/* Kolom 2: DBM Admin */}
              <td
                className="p-1 align-bottom"
                style={{ border: '0.75px solid #000000', width: '25%' }}
              >
                <div className="h-16 flex items-center justify-center mb-1 w-full">
                  {ttdMode === 'ada' && ttdImages?.dbm_admin ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ttdImages.dbm_admin}
                      alt="TTD DBM Admin"
                      crossOrigin="anonymous"
                      className="max-h-14 max-w-full object-contain mx-auto"
                    />
                  ) : (
                    <div className="h-14" />
                  )}
                </div>
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block text-center">DBM Admin</span>
                </div>
              </td>

              {/* Kolom 3: HRD Manager */}
              <td
                className="p-1 align-bottom"
                style={{ border: '0.75px solid #000000', width: '25%' }}
              >
                <div className="h-16 flex items-center justify-center mb-1 w-full">
                  {ttdMode === 'ada' && ttdImages?.hrd_manager ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ttdImages.hrd_manager}
                      alt="TTD HRD Manager"
                      crossOrigin="anonymous"
                      className="max-h-14 max-w-full object-contain mx-auto"
                    />
                  ) : (
                    <div className="h-14" />
                  )}
                </div>
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block text-center">HRD Manager</span>
                </div>
              </td>

              {/* Kolom 4: TC Supervisor */}
              <td
                className="p-1 align-bottom"
                style={{ border: '0.75px solid #000000', width: '25%' }}
              >
                <div className="h-16 flex items-center justify-center mb-1 w-full">
                  {ttdMode === 'ada' && ttdImages?.tc_supervisor ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ttdImages.tc_supervisor}
                      alt="TTD TC Supervisor"
                      crossOrigin="anonymous"
                      className="max-h-14 max-w-full object-contain mx-auto"
                    />
                  ) : (
                    <div className="h-14" />
                  )}
                </div>
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block text-center">TC Supervisor</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
