// components/BeritaAcaraRekap.js
'use client';

import React from 'react';

// Tanda Tangan Otentik Sesuai Dokumen Resmi Indomaret (Gambar 2 & Gambar 3)
// Menggunakan kurva Bezier halus menyerupai goresan pena bolpoin asli
export function SignatureDbmOps({ inkColor = '#122b52' }) {
  return (
    <div className="relative w-36 h-20 mx-auto flex items-center justify-center pointer-events-none select-none">
      <svg
        viewBox="0 0 170 85"
        className="w-full h-full fill-none"
        stroke={inkColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Sapuan awal naik dan melingkar membentuk inisial elegan */}
        <path
          d="M 28 62 C 34 50, 48 24, 62 14 C 74 6, 82 12, 78 28 C 72 48, 52 74, 46 76 C 42 78, 40 70, 46 58 C 54 44, 76 34, 94 38"
          strokeWidth="2.6"
        />
        {/* Irama cursive ritmis di bagian tengah tanda tangan */}
        <path
          d="M 88 42 C 96 36, 104 46, 108 56 C 112 42, 122 40, 126 52 C 130 44, 138 42, 142 54"
          strokeWidth="2.3"
        />
        {/* Garis palang aksen menyilang tegas */}
        <path
          d="M 52 46 C 78 43, 115 41, 148 44"
          strokeWidth="2.4"
        />
        {/* Sapuan underline melengkung cepat khas tanda tangan manajerial */}
        <path
          d="M 32 72 C 64 68, 114 66, 156 70 C 160 70, 162 67, 158 64"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}

export function SignatureDbmAdmin({ inkColor = '#122b52' }) {
  return (
    <div className="relative w-36 h-20 mx-auto flex items-center justify-center pointer-events-none select-none">
      <svg
        viewBox="0 0 170 85"
        className="w-full h-full fill-none"
        stroke={inkColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Inisial R (Ricky Mario) dengan tiang tegak melengkung dan kepala melingkar anggun */}
        <path
          d="M 36 74 C 38 52, 42 26, 44 14 C 48 8, 66 6, 74 18 C 80 28, 76 42, 58 44 C 50 45, 44 44, 44 44"
          strokeWidth="2.8"
        />
        {/* Kaki huruf R turun lalu menyambung ke huruf cursive 'icky' */}
        <path
          d="M 54 44 C 62 54, 72 68, 78 72 C 84 76, 88 66, 92 50 C 96 42, 102 54, 106 58 C 110 44, 118 42, 122 56 C 126 44, 134 46, 138 58"
          strokeWidth="2.4"
        />
        {/* Titik aksen di atas */}
        <circle cx="94" cy="34" r="1.8" fill={inkColor} stroke="none" />
        {/* Sapuan ekor panjang melengkung melintang ke bawah membentuk underline tegas */}
        <path
          d="M 136 58 C 144 48, 148 64, 138 72 C 118 80, 78 76, 32 73 C 24 72, 42 70, 88 68 C 126 66, 158 68, 164 71"
          strokeWidth="2.6"
        />
      </svg>
    </div>
  );
}

export function SignatureHrdManager({ inkColor = '#122b52' }) {
  return (
    <div className="relative w-36 h-20 mx-auto flex items-center justify-center pointer-events-none select-none">
      <svg
        viewBox="0 0 170 85"
        className="w-full h-full fill-none"
        stroke={inkColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Monogram A / ASN (Abednego Setya Nugroho): loop tegak tinggi meliuk melengkung */}
        <path
          d="M 58 78 C 42 62, 46 28, 64 12 C 80 0, 96 16, 88 42 C 80 66, 62 76, 56 68 C 50 60, 68 46, 86 36 C 98 28, 108 34, 112 48"
          strokeWidth="2.7"
        />
        {/* Gelombang cursive tengah */}
        <path
          d="M 108 48 C 114 42, 122 40, 126 52 C 130 42, 138 44, 142 56 C 146 46, 152 48, 156 58"
          strokeWidth="2.3"
        />
        {/* Garis flourish melintang di bawah sebagai penegas */}
        <path
          d="M 42 74 C 74 62, 118 58, 158 66 C 162 67, 154 62, 138 60"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}

export function SignatureTcSupervisor({ inkColor = '#122b52' }) {
  return (
    <div className="relative w-36 h-20 mx-auto flex items-center justify-center pointer-events-none select-none">
      <svg
        viewBox="0 0 170 85"
        className="w-full h-full fill-none"
        stroke={inkColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Tanda tangan Rokhman (TC Supervisor): inisial tajam, loop melingkar, dan aksen menyilang */}
        <path
          d="M 46 72 C 54 48, 64 22, 72 10 C 76 6, 88 8, 92 20 C 96 34, 88 48, 74 54 C 64 58, 58 52, 64 42 C 72 32, 94 28, 114 36"
          strokeWidth="2.7"
        />
        {/* Coretan ritmis zig-zag cursive khas TC */}
        <path
          d="M 82 50 L 92 68 L 98 42 L 106 66 L 114 44 L 122 64 L 132 46"
          strokeWidth="2.4"
        />
        {/* Goresan diagonal tegas menyilang tiang */}
        <path
          d="M 44 48 C 76 38, 116 32, 148 42"
          strokeWidth="2.5"
        />
        {/* Aksen penutup bawah */}
        <path
          d="M 72 74 C 98 70, 132 68, 158 72"
          strokeWidth="2.3"
        />
      </svg>
    </div>
  );
}

export default function BeritaAcaraRekap({
  data = [],
  ttdMode = 'ada', // 'kosong' (Gambar 2) | 'ada' (Gambar 3)
  tanggalCetak = 'Surabaya, 5 Oktober 2026',
  cabang = 'Training Center Cabang Surabaya',
  bulan = 'Oktober',
  tahun = '2026',
  inkColor = '#122b52', // Warna bolpoin resmi: navy/biru tua atau hitam
}) {
  return (
    <div
      className="bg-white text-black p-6 sm:p-10 max-w-4xl mx-auto shadow-sm print:p-0 print:shadow-none print:max-w-none text-xs leading-relaxed pdf-page-container"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
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
          style={{ border: '1.5px solid #000000', fontSize: '11px' }}
        >
          <thead>
            <tr style={{ backgroundColor: '#ffffff' }}>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '36px' }}
              >
                NO
              </th>
              <th
                className="p-1 font-bold uppercase text-left"
                style={{ border: '1.5px solid #000000', width: '160px' }}
              >
                JENIS TRAINING
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '75px' }}
              >
                TARGET LSKT
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '85px' }}
              >
                DISPENSASI
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '75px' }}
              >
                TARGET
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '65px' }}
              >
                HADIR
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '65px' }}
              >
                TIDAK HADIR
              </th>
              <th
                className="p-1 font-bold uppercase text-center"
                style={{ border: '1.5px solid #000000' }}
              >
                NO LIST PESERTA TIDAK HADIR
              </th>
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={row.id || idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td className="p-1 font-semibold" style={{ border: '1px solid #000000' }}>
                    {row.no || idx + 1}
                  </td>
                  <td
                    className="p-1 text-left font-semibold uppercase"
                    style={{ border: '1px solid #000000' }}
                  >
                    {row.jenis_training}
                  </td>
                  <td className="p-1" style={{ border: '1px solid #000000' }}>
                    {row.target_lskt || ''}
                  </td>
                  <td className="p-1" style={{ border: '1px solid #000000' }}>
                    {row.dispensasi || ''}
                  </td>
                  <td className="p-1" style={{ border: '1px solid #000000' }}>
                    {row.target_tc_report || ''}
                  </td>
                  <td className="p-1" style={{ border: '1px solid #000000' }}>
                    {row.hadir || ''}
                  </td>
                  <td className="p-1" style={{ border: '1px solid #000000' }}>
                    {row.tidak_hadir || ''}
                  </td>
                  <td
                    className="p-1 font-medium text-center uppercase"
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
                  className="p-3 italic text-center text-gray-500"
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
                className="p-1.5 align-bottom"
                style={{ border: '1.5px solid #000000', height: '85px' }}
              >
                {ttdMode === 'ada' ? <SignatureDbmOps inkColor={inkColor} /> : <div className="h-16" />}
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block">DBM Operasional</span>
                </div>
              </td>

              {/* Kolom 2: DBM Admin */}
              <td
                className="p-1.5 align-bottom"
                style={{ border: '1.5px solid #000000', height: '85px' }}
              >
                {ttdMode === 'ada' ? <SignatureDbmAdmin inkColor={inkColor} /> : <div className="h-16" />}
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block">DBM Admin</span>
                </div>
              </td>

              {/* Kolom 3: HRD Manager */}
              <td
                className="p-1.5 align-bottom"
                style={{ border: '1.5px solid #000000', height: '85px' }}
              >
                {ttdMode === 'ada' ? <SignatureHrdManager inkColor={inkColor} /> : <div className="h-16" />}
                <div className="border-t border-black pt-1 mx-2">
                  <span className="font-bold block">HRD Manager</span>
                </div>
              </td>

              {/* Kolom 4: TC Supervisor */}
              <td
                className="p-1.5 align-bottom"
                style={{ border: '1.5px solid #000000', height: '85px' }}
              >
                {ttdMode === 'ada' ? <SignatureTcSupervisor inkColor={inkColor} /> : <div className="h-16" />}
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
