// components/BeritaAcaraSoftSkill.js
'use client';

import React from 'react';

export default function BeritaAcaraSoftSkill({
  data = [],
  ttdMode = 'ada', // 'ada' | 'kosong'
  cabang = 'Surabaya',
  periode = 'September 2026',
  tanggalDibuat = '30 September 2026',
  inkColor = '#122b52',
  kategoriLabel = 'Pimpinan Shift',
  ttdImages = {},
  signerConfig = {},
  pageNumber = 1,
  totalDocPages = 1,
}) {
  const {
    mengetahui2_jabatan = 'Deputy Branch Manager ADM',
    mengetahui2_nama = 'RICKY MARIO',
    mengetahui1_jabatan = 'Human Resource Manager',
    mengetahui1_nama = 'ABEDNEGO SETYA NUGROHO',
    membuat_jabatan = 'Training Center Supervisor',
    membuat_nama = 'ROKHMAN',
    mode_gambar = 'hanya_ttd',
    ttd_scale = 100,
    ttd_offset_y = 0,
    ttd_offset_x = 0,
  } = signerConfig;

  const hasSoftSkillTtd = Boolean(ttdImages?.paket_ttd_softskill);
  const isModeLengkap = mode_gambar === 'lengkap';

  return (
    <div
      className="sheet text-xs leading-relaxed flex flex-col justify-between"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div>
        {/* 1. Header Judul Berita Acara Soft Skill (Sesuai Gambar 7 & Kategori) */}
        <div className="text-center space-y-0.5 mb-4">
          <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight">
            BERITA ACARA
          </h1>
          <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight">
            PESERTA GAGAL MENGIKUTI TRAINING SOFT SKILL DASAR {kategoriLabel.toUpperCase()}
          </h2>
        </div>

        {/* 2. Paragraf Pernyataan */}
        <p className="text-justify mb-3 leading-normal">
          Pada hari ini, <span className="font-semibold">{tanggalDibuat}</span>, kami yang bertanda tangan di bawah ini
          menyatakan bahwa peserta berikut dari Cabang <span className="font-semibold">{cabang}</span> tidak dapat
          mengikuti Training Soft Skill Dasar {kategoriLabel} pada periode <span className="font-semibold">{periode}</span>{' '}
          dengan alasan sebagaimana tercantum di bawah ini.
        </p>

        {/* 3. Ringkasan Informasi */}
        <div className="mb-3 space-y-0.5 font-semibold text-xs">
          <div className="flex">
            <span className="w-32">Cabang</span>
            <span>: {cabang}</span>
          </div>
          <div className="flex">
            <span className="w-32">Periode Training</span>
            <span>: {periode}</span>
          </div>
          <div className="flex">
            <span className="w-32">Tanggal Dibuat</span>
            <span>: {tanggalDibuat}</span>
          </div>
          <div className="flex">
            <span className="w-32">Kategori Peserta</span>
            <span className="text-[#0056b3] font-bold">: {kategoriLabel} ({data.length} Peserta)</span>
          </div>
        </div>

        <p className="font-bold mb-1.5">Daftar Peserta Gagal Training:</p>

        {/* 4. Tabel Peserta Gagal Training (Header Biru Sesuai Gambar 7) */}
        <div className="overflow-x-auto mb-4">
          <table
            className="w-full text-left border-collapse"
            style={{ border: '0.75px solid #000000', fontSize: '11px' }}
          >
            <thead>
              <tr style={{ backgroundColor: '#1E60D5', color: '#ffffff' }}>
                <th
                  className="p-1 font-bold uppercase text-center"
                  style={{ border: '0.75px solid #000000', width: '36px' }}
                >
                  No
                </th>
                <th
                  className="p-1 font-bold uppercase text-center"
                  style={{ border: '0.75px solid #000000', width: '105px' }}
                >
                  NIK
                </th>
                <th
                  className="p-1 font-bold uppercase"
                  style={{ border: '0.75px solid #000000' }}
                >
                  Nama
                </th>
                <th
                  className="p-1 font-bold uppercase"
                  style={{ border: '0.75px solid #000000', width: '160px' }}
                >
                  Jabatan
                </th>
                <th
                  className="p-1 font-bold uppercase text-center"
                  style={{ border: '0.75px solid #000000', width: '90px' }}
                >
                  Kategori
                </th>
                <th
                  className="p-1 font-bold uppercase"
                  style={{ border: '0.75px solid #000000', width: '130px' }}
                >
                  Detail Alasan
                </th>
              </tr>
            </thead>
            <tbody>
              {data && data.length > 0 ? (
                data.map((row, idx) => (
                  <tr key={row.id || `${row.nik}-${idx}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td
                      className="p-1 text-center font-bold"
                      style={{ border: '0.75px solid #000000' }}
                    >
                      {row.no || idx + 1}
                    </td>
                    <td
                      className="p-1 text-center font-mono font-bold"
                      style={{ border: '0.75px solid #000000' }}
                    >
                      {row.nik}
                    </td>
                    <td
                      className="p-1 uppercase font-semibold text-black"
                      style={{ border: '0.75px solid #000000' }}
                    >
                      {row.nama}
                    </td>
                    <td
                      className="p-1 font-medium"
                      style={{ border: '0.75px solid #000000' }}
                    >
                      {row.jabatan}
                    </td>
                    <td
                      className="p-1 text-center font-medium"
                      style={{ border: '0.75px solid #000000' }}
                    >
                      {row.kategory || row.kategori || '-'}
                    </td>
                    <td
                      className="p-1 font-medium"
                      style={{ border: '0.75px solid #000000' }}
                    >
                      {row.detail_alasan || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 italic text-center text-amber-800 bg-amber-50"
                    style={{ border: '0.75px solid #000000' }}
                  >
                    Tidak ada peserta pada kategori {kategoriLabel} ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Kalimat Penutup */}
        <p className="mb-4 leading-normal font-medium">
          Demikian berita acara ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
        </p>
      </div>

      {/* 6. Kotak Tanda Tangan */}
      <div>
        {ttdMode === 'ada' && isModeLengkap && hasSoftSkillTtd ? (
          // Mode Gambar Lengkap: gambar paket ditempel utuh menggantikan seluruh blok tanda tangan
          <div className="w-full print-break-avoid pt-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ttdImages.paket_ttd_softskill}
              alt="Blok Paket Tanda Tangan Berita Acara Soft Skill"
              className="w-full h-auto object-contain mx-auto block rounded-xs shadow-xs"
              style={{
                width: '100%',
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </div>
        ) : (
          // Mode Hanya Tanda Tangan (Default) atau TTD Kosong: teks jabatan & nama dari pengaturan
          <div className="overflow-x-auto print-break-avoid pt-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            {/* Header 3 Kolom: Label & Jabatan */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex flex-col items-center px-1">
                <p className="font-medium text-xs mb-0.5">Mengetahui 2,</p>
                <p className="font-bold text-xs leading-snug">{mengetahui2_jabatan}</p>
              </div>
              <div className="flex flex-col items-center px-1">
                <p className="font-medium text-xs mb-0.5">Mengetahui 1,</p>
                <p className="font-bold text-xs leading-snug">{mengetahui1_jabatan}</p>
              </div>
              <div className="flex flex-col items-center px-1">
                <p className="font-medium text-xs mb-0.5">Membuat,</p>
                <p className="font-bold text-xs leading-snug">{membuat_jabatan}</p>
              </div>
            </div>

            {/* Area Tanda Tangan Tengah (Selebar 3 Kolom Penuh) */}
            {ttdMode === 'ada' && hasSoftSkillTtd ? (
              <div className="w-full my-2 flex items-center justify-center relative overflow-visible">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ttdImages.paket_ttd_softskill}
                  alt="3 Goresan Tanda Tangan Soft Skill"
                  className="h-auto object-contain mx-auto block"
                  style={{
                    width: `${ttd_scale}%`,
                    maxWidth: `${ttd_scale}%`,
                    height: 'auto',
                    display: 'block',
                    transform: `translate(${ttd_offset_x}px, ${ttd_offset_y}px)`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.1s ease-out, width 0.1s ease-out',
                  }}
                />
              </div>
            ) : (
              <div className="h-16 w-full" />
            )}

            {/* Footer 3 Kolom: Nama Penandatangan Bergaris Bawah */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex flex-col items-center px-1">
                <p className="font-bold text-xs uppercase underline tracking-wider break-words leading-tight">
                  {mengetahui2_nama}
                </p>
              </div>
              <div className="flex flex-col items-center px-1">
                <p className="font-bold text-xs uppercase underline tracking-wider break-words leading-tight">
                  {mengetahui1_nama}
                </p>
              </div>
              <div className="flex flex-col items-center px-1">
                <p className="font-bold text-xs uppercase underline tracking-wider break-words leading-tight">
                  {membuat_nama}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Nomor Halaman Berita Acara */}
        {totalDocPages > 1 && (
          <div
            className="sheet-footer pt-2 mt-3 flex items-center justify-between border-t border-gray-300 text-[8pt] text-gray-500"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            <span>
              Berita Acara Soft Skill &bull; Kategori: {kategoriLabel} &bull; Cabang: {cabang}
            </span>
            <span className="font-bold text-black">
              Halaman {pageNumber} dari {totalDocPages}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
