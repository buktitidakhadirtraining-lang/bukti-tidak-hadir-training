// components/BeritaAcaraSoftSkill.js
'use client';

import React from 'react';
import {
  SignatureDbmAdmin,
  SignatureHrdManager,
  SignatureTcSupervisor,
} from './BeritaAcaraRekap.js';

export default function BeritaAcaraSoftSkill({
  data = [],
  ttdMode = 'ada', // 'ada' (Gambar 8) | 'kosong'
  cabang = 'Surabaya',
  periode = 'September 2026',
  tanggalDibuat = '30 September 2026',
  inkColor = '#122b52',
}) {
  return (
    <div
      className="bg-white text-black p-6 sm:p-10 max-w-4xl mx-auto shadow-sm print:p-0 print:shadow-none print:max-w-none text-xs leading-relaxed pdf-page-container"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* 1. Header Judul Berita Acara Soft Skill (Sesuai Gambar 7) */}
      <div className="text-center space-y-0.5 mb-4">
        <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight">
          BERITA ACARA
        </h1>
        <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase leading-tight">
          PESERTA GAGAL MENGIKUTI TRAINING SOFT SKILL DASAR PIMPINAN SHIFT
        </h2>
      </div>

      {/* 2. Paragraf Pernyataan (Sesuai Gambar 7) */}
      <p className="text-justify mb-3 leading-normal">
        Pada hari ini, <span className="font-semibold">{tanggalDibuat}</span>, kami yang bertanda tangan di bawah ini
        menyatakan bahwa peserta berikut dari Cabang <span className="font-semibold">{cabang}</span> tidak dapat
        mengikuti Training Soft Skill Dasar Pimpinan Shift pada periode <span className="font-semibold">{periode}</span>{' '}
        dengan alasan sebagaimana tercantum di bawah ini.
      </p>

      {/* 3. Ringkasan Informasi (Sesuai Gambar 7) */}
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
      </div>

      <p className="font-bold mb-1.5">Daftar Peserta Gagal Training:</p>

      {/* 4. Tabel Peserta Gagal Training (Header Biru Sesuai Gambar 7) */}
      <div className="overflow-x-auto mb-4">
        <table
          className="w-full text-left border-collapse"
          style={{ border: '1.5px solid #000000', fontSize: '11px' }}
        >
          <thead>
            <tr style={{ backgroundColor: '#1E60D5', color: '#ffffff' }}>
              <th
                className="p-1 font-bold uppercase text-center"
                style={{ border: '1.5px solid #000000', width: '36px' }}
              >
                No
              </th>
              <th
                className="p-1 font-bold uppercase text-center"
                style={{ border: '1.5px solid #000000', width: '105px' }}
              >
                NIK
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000' }}
              >
                Nama
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '160px' }}
              >
                Jabatan
              </th>
              <th
                className="p-1 font-bold uppercase text-center"
                style={{ border: '1.5px solid #000000', width: '90px' }}
              >
                Kategori
              </th>
              <th
                className="p-1 font-bold uppercase"
                style={{ border: '1.5px solid #000000', width: '130px' }}
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
                    style={{ border: '1px solid #000000' }}
                  >
                    {row.no || idx + 1}
                  </td>
                  <td
                    className="p-1 text-center font-mono font-bold"
                    style={{ border: '1px solid #000000' }}
                  >
                    {row.nik}
                  </td>
                  <td
                    className="p-1 uppercase font-semibold text-black"
                    style={{ border: '1px solid #000000' }}
                  >
                    {row.nama}
                  </td>
                  <td
                    className="p-1 font-medium"
                    style={{ border: '1px solid #000000' }}
                  >
                    {row.jabatan}
                  </td>
                  <td
                    className="p-1 text-center font-medium"
                    style={{ border: '1px solid #000000' }}
                  >
                    {row.kategory || row.kategori || '-'}
                  </td>
                  <td
                    className="p-1 font-medium"
                    style={{ border: '1px solid #000000' }}
                  >
                    {row.detail_alasan || '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="p-3 italic text-center text-gray-500"
                  style={{ border: '1px solid #000000' }}
                >
                  Tidak ada data peserta soft skill yang tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Kalimat Penutup (Sesuai Gambar 8) */}
      <p className="mb-4 leading-normal font-medium">
        Demikian berita acara ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
      </p>

      {/* 6. Kotak Tanda Tangan 3 Kolom (Sesuai Gambar 8) */}
      <div className="overflow-x-auto print-break-avoid pt-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div className="grid grid-cols-3 gap-4 text-center">
          {/* Kolom 1: Mengetahui 2, Deputy Branch Manager ADM - RICKY MARIO */}
          <div className="flex flex-col items-center">
            <p className="font-medium text-xs mb-0.5">Mengetahui 2,</p>
            <p className="font-bold text-xs mb-1">Deputy Branch Manager ADM</p>
            <div className="h-20 flex items-center justify-center my-0.5">
              {ttdMode === 'ada' ? <SignatureDbmAdmin inkColor={inkColor} /> : <div className="h-16 w-32" />}
            </div>
            <p className="font-bold text-xs uppercase underline tracking-wider mt-1">
              RICKY MARIO
            </p>
          </div>

          {/* Kolom 2: Mengetahui 1, Human Resource Manager - ABEDNEGO SETYA NUGROHO */}
          <div className="flex flex-col items-center">
            <p className="font-medium text-xs mb-0.5">Mengetahui 1,</p>
            <p className="font-bold text-xs mb-1">Human Resource Manager</p>
            <div className="h-20 flex items-center justify-center my-0.5">
              {ttdMode === 'ada' ? <SignatureHrdManager inkColor={inkColor} /> : <div className="h-16 w-32" />}
            </div>
            <p className="font-bold text-xs uppercase underline tracking-wider mt-1">
              ABEDNEGO SETYA NUGROHO
            </p>
          </div>

          {/* Kolom 3: Membuat, Training Center Supervisor - ROKHMAN */}
          <div className="flex flex-col items-center">
            <p className="font-medium text-xs mb-0.5">Membuat,</p>
            <p className="font-bold text-xs mb-1">Training Center Supervisor</p>
            <div className="h-20 flex items-center justify-center my-0.5">
              {ttdMode === 'ada' ? <SignatureTcSupervisor inkColor={inkColor} /> : <div className="h-16 w-32" />}
            </div>
            <p className="font-bold text-xs uppercase underline tracking-wider mt-1">
              ROKHMAN
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
