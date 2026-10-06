// components/BeritaAcaraRekap.js
'use client';

import React from 'react';

// Tanda Tangan SVG Asli Sesuai Dokumen Indomaret (Gambar 3)
export function SignatureDbmOps() {
  return (
    <div className="relative w-36 h-20 mx-auto flex items-center justify-center">
      <svg
        viewBox="0 0 160 85"
        className="w-full h-full stroke-black fill-none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Garis vertikal & salib dinamis */}
        <path d="M 75 75 L 75 10" />
        <path d="M 45 42 L 105 40" />
        <path d="M 55 30 L 95 55" />
        <path d="M 52 50 Q 75 42 98 48" />
        <path d="M 60 38 Q 72 58 84 36" />
        <path d="M 68 45 L 80 62" />
        <path d="M 88 35 Q 98 45 92 58 Q 85 70 70 70" />
      </svg>
      {/* Tulisan tangan 'Ach' di bawah garis */}
      <span
        className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs font-bold text-black select-none pointer-events-none"
        style={{ fontFamily: 'cursive, sans-serif' }}
      >
        Ach
      </span>
    </div>
  );
}

export function SignatureDbmAdmin() {
  return (
    <div className="w-36 h-20 mx-auto flex items-center justify-center">
      <svg
        viewBox="0 0 160 85"
        className="w-full h-full stroke-black fill-none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Tulisan tangan khas 'Ridy' dengan loop melengkung */}
        <path d="M 38 65 L 42 22 Q 58 16 64 32 Q 62 44 48 45 L 70 65" />
        <path d="M 76 34 L 76 56 M 76 25 L 77 25" />
        <path d="M 84 56 L 84 22 M 84 40 Q 98 34 98 46 Q 98 56 84 56" />
        <path d="M 104 36 L 108 52 Q 115 32 120 36 L 112 72 Q 105 78 92 72" />
        {/* Garis bawah flourish panjang */}
        <path d="M 30 70 Q 80 60 135 65" strokeWidth="2.2" />
      </svg>
    </div>
  );
}

export function SignatureHrdManager() {
  return (
    <div className="w-36 h-20 mx-auto flex items-center justify-center">
      <svg
        viewBox="0 0 160 85"
        className="w-full h-full stroke-black fill-none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Loop tegak elegan meliuk */}
        <path d="M 70 72 Q 48 50 64 20 Q 80 8 82 36 Q 80 66 58 60" />
        <path d="M 68 32 Q 92 24 88 52 Q 86 72 108 64" />
        <path d="M 62 64 Q 98 42 118 64" strokeWidth="2" />
      </svg>
    </div>
  );
}

export function SignatureTcSupervisor() {
  return (
    <div className="w-36 h-20 mx-auto flex items-center justify-center">
      <svg
        viewBox="0 0 160 85"
        className="w-full h-full stroke-black fill-none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Tanda bintang dan garis melingkar tegas */}
        <path d="M 64 68 L 82 16 M 70 28 L 102 54 M 56 44 L 95 38" />
        <path d="M 78 24 Q 118 12 124 42 Q 128 72 70 66 Q 46 62 82 50 Q 118 38 128 56" />
        <path d="M 82 54 Q 92 68 102 48" />
      </svg>
    </div>
  );
}

export default function BeritaAcaraRekap({
  data = [],
  ttdMode = 'kosong', // 'kosong' (Gambar 2) | 'ada' (Gambar 3)
  tanggalCetak = 'Surabaya, 5 Oktober 2026',
  cabang = 'Training Center Cabang Surabaya',
  bulan = 'Oktober',
  tahun = '2026',
}) {
  return (
    <div
      className="bg-white text-black p-8 sm:p-12 max-w-4xl mx-auto shadow-sm print:p-0 print:shadow-none print:max-w-none text-xs leading-relaxed"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* 1. Header Judul Berita Acara */}
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase">
          BERITA ACARA KETIDAKHADIRAN PESERTA TRAINING
        </h1>
        <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase">
          DAN PERMOHONAN DISPENSASI KETIDAKHADIRAN
        </h2>
      </div>

      {/* 2. Paragraf Pengantar */}
      <p className="text-justify mb-5 leading-normal">
        Pada pelaksanaan kegiatan {cabang} periode Bulan <span className="font-bold">{bulan}</span> Tahun{' '}
        <span className="font-bold">{tahun}</span>, ditemukan adanya peserta training karyawan eksisting yang
        tidak dapat mengikuti beberapa jenis training. Berikut kami sampaikan rekapitulasi ketidakhadiran peserta
        berdasarkan jenis training sebagai dasar pengajuan dispensasi kepada ETD.
      </p>

      {/* 3. Tabel Rekapitulasi (Sesuai Format Gambar 2) */}
      <div className="overflow-x-auto mb-6">
        <table
          className="w-full text-center border-collapse"
          style={{ border: '1.5px solid #000000', fontSize: '11px' }}
        >
          <thead>
            <tr style={{ backgroundColor: '#ffffff' }}>
              <th
                className="p-1.5 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '38px' }}
              >
                NO
              </th>
              <th
                className="p-1.5 font-bold uppercase text-left"
                style={{ border: '1.5px solid #000000', width: '160px' }}
              >
                JENIS TRAINING
              </th>
              <th
                className="p-1.5 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '75px' }}
              >
                TARGET LSKT
              </th>
              <th
                className="p-1.5 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '85px' }}
              >
                DISPENSASI
              </th>
              <th
                className="p-1.5 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '75px' }}
              >
                TARGET
              </th>
              <th
                className="p-1.5 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '65px' }}
              >
                HADIR
              </th>
              <th
                className="p-1.5 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '65px' }}
              >
                TIDAK HADIR
              </th>
              <th
                className="p-1.5 font-bold uppercase text-center"
                style={{ border: '1.5px solid #000000' }}
              >
                NO LIST PESERTA TIDAK HADIR
              </th>
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="p-1.5 font-semibold" style={{ border: '1px solid #000000' }}>
                    {row.no || idx + 1}
                  </td>
                  <td
                    className="p-1.5 text-left font-semibold uppercase"
                    style={{ border: '1px solid #000000' }}
                  >
                    {row.jenis_training}
                  </td>
                  <td className="p-1.5" style={{ border: '1px solid #000000' }}>
                    {row.target_lskt || ''}
                  </td>
                  <td className="p-1.5" style={{ border: '1px solid #000000' }}>
                    {row.dispensasi || ''}
                  </td>
                  <td className="p-1.5" style={{ border: '1px solid #000000' }}>
                    {row.target_tc_report || ''}
                  </td>
                  <td className="p-1.5" style={{ border: '1px solid #000000' }}>
                    {row.hadir || ''}
                  </td>
                  <td className="p-1.5" style={{ border: '1px solid #000000' }}>
                    {row.tidak_hadir || ''}
                  </td>
                  <td
                    className="p-1.5 font-medium text-center uppercase"
                    style={{ border: '1px solid #000000', fontSize: '10px' }}
                  >
                    {row.no_list_peserta_tidak_hadir || ''}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="p-4 italic text-center text-gray-500"
                  style={{ border: '1px solid #000000' }}
                >
                  Tidak ada data cetak_rekap yang tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Bagian Data Pendukung */}
      <div className="space-y-1 mb-4 leading-normal">
        <p className="font-bold">Data Pendukung</p>
        <p>Sebagai data pendukung, bersama Berita Acara ini kami lampirkan:</p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Daftar peserta yang tidak hadir pada masing-masing jenis training.</li>
          <li>Alasan ketidakhadiran setiap peserta.</li>
          <li>Bukti pendukung ketidakhadiran (apabila tersedia).</li>
        </ol>
      </div>

      {/* 5. Permohonan Dispensasi Ketidakhadiran */}
      <div className="space-y-1 mb-4 leading-normal">
        <p className="font-bold">Permohonan Dispensasi Ketidakhadiran</p>
        <p className="text-justify">
          Sehubungan dengan data ketidakhadiran tersebut, kami memohon kepada Bapak/Ibu ETD untuk memberikan
          dispensasi kepada peserta yang tercantum dalam daftar ketidakhadiran, sehingga ketidakhadiran tersebut
          tidak diperhitungkan sebagai pengurang poin rating sesuai ketentuan yang berlaku.
        </p>
      </div>

      {/* 6. Kalimat Penutup */}
      <p className="mb-6 leading-normal">
        Demikian Berita Acara dan permohonan dispensasi ini kami sampaikan. Atas perhatian dan persetujuan
        Bapak/Ibu, kami ucapkan terima kasih.
      </p>

      {/* 7. Tanggal Cetak (Rata Kanan) */}
      <div className="text-right mb-2">
        <p>{tanggalCetak}</p>
      </div>

      {/* 8. Kotak Tanda Tangan 4 Kolom (Sesuai Gambar 2 & Gambar 3) */}
      <div className="overflow-x-auto print-break-avoid">
        <table
          className="w-full text-center border-collapse"
          style={{ border: '1.5px solid #000000', fontSize: '11px' }}
        >
          <thead>
            <tr>
              <th
                colSpan={3}
                className="p-1 font-bold"
                style={{ border: '1.5px solid #000000', width: '75%' }}
              >
                Mengetahui,
              </th>
              <th
                className="p-1 font-bold"
                style={{ border: '1.5px solid #000000', width: '25%' }}
              >
                Dibuat oleh,
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {/* Kolom 1: DBM Operasional */}
              <td
                className="p-2 align-bottom"
                style={{ border: '1.5px solid #000000', height: '90px' }}
              >
                {ttdMode === 'ada' ? <SignatureDbmOps /> : <div className="h-16" />}
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block">DBM Operasional</span>
                </div>
              </td>

              {/* Kolom 2: DBM Admin */}
              <td
                className="p-2 align-bottom"
                style={{ border: '1.5px solid #000000', height: '90px' }}
              >
                {ttdMode === 'ada' ? <SignatureDbmAdmin /> : <div className="h-16" />}
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block">DBM Admin</span>
                </div>
              </td>

              {/* Kolom 3: HRD Manager */}
              <td
                className="p-2 align-bottom"
                style={{ border: '1.5px solid #000000', height: '90px' }}
              >
                {ttdMode === 'ada' ? <SignatureHrdManager /> : <div className="h-16" />}
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block">HRD Manager</span>
                </div>
              </td>

              {/* Kolom 4: TC Supervisor */}
              <td
                className="p-2 align-bottom"
                style={{ border: '1.5px solid #000000', height: '90px' }}
              >
                {ttdMode === 'ada' ? <SignatureTcSupervisor /> : <div className="h-16" />}
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block">TC Supervisor</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
