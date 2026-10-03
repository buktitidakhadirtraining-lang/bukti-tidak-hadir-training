// app/(app)/tentang/page.js
// Sistem Data Ketidakhadiran Peserta Training — dibuat oleh Bang Ajiib (2026)
'use client';

import Link from 'next/link';
import {
  ShieldCheck,
  UserCheck,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  Cloud,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Sparkles,
  Award,
} from 'lucide-react';
import { LOGO_URL, APP_NAME } from '../../../lib/config.js';

export default function TentangPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-soft relative overflow-hidden">
        <div className="indomaret-bar absolute top-0 left-0 right-0">
          <div className="indomaret-bar-blue" />
          <div className="indomaret-bar-yellow" />
          <div className="indomaret-bar-red" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-2">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt="Logo Indomaret" className="h-10 w-auto object-contain" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#0056b3] border border-blue-200 mb-1.5">
                <Sparkles className="w-3 h-3 text-[#0056b3]" />
                <span>Versi 1.0 (Rilis 2026)</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-title tracking-tight">
                {APP_NAME}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Dibuat dan dikembangkan oleh <strong className="text-gray-800">Bang Ajiib</strong> &bull; Tahun 2026
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors self-start sm:self-center"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Profil Pengembang & Hak Cipta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft md:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl text-[#0056b3]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-title">
                Kepemilikan & Hak Cipta Perangkat Lunak
              </h2>
              <p className="text-xs text-gray-500">
                Informasi lisensi dan pengembang resmi aplikasi
              </p>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-r from-blue-50/70 to-blue-50/20 rounded-xl border border-blue-100 space-y-2 text-xs leading-relaxed text-gray-700">
            <p>
              <strong className="text-gray-900 font-bold">Nama Aplikasi:</strong> {APP_NAME}
            </p>
            <p>
              <strong className="text-gray-900 font-bold">Pengembang / Pemilik:</strong> Bang Ajiib
            </p>
            <p>
              <strong className="text-gray-900 font-bold">Tahun Rilis:</strong> 2026
            </p>
            <p>
              <strong className="text-gray-900 font-bold">Status Hak Cipta:</strong> Seluruh hak cipta dilindungi undang-undang (All rights reserved).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block text-amber-900 mb-0.5">
                Peringatan Perlindungan Hak Cipta:
              </strong>
              Hak cipta dilindungi. Dilarang menyalin, mendistribusikan, memodifikasi, atau mengklaim kepemilikan aplikasi ini sebagian maupun seluruhnya tanpa izin tertulis dari pembuat (<strong className="text-amber-950">Bang Ajiib</strong>).
            </div>
          </div>
        </div>

        {/* Ringkasan Status Arsitektur */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 font-title">
                Integritas Sistem
              </h3>
            </div>

            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Autentikasi JWT & Role Base</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Supabase PostgreSQL Storage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Drive Bridge Per Cabang</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pencatatan Audit Trail Lengkap</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-400 text-center font-medium">
            Bang Ajiib &bull; Hak Cipta © 2026
          </div>
        </div>
      </div>

      {/* Ringkasan Fungsi Utama Aplikasi */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-soft space-y-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 font-title">
            Fungsi & Fitur Utama Aplikasi
          </h2>
          <p className="text-xs text-gray-500">
            Arsitektur modul yang dibangun untuk operasional Training Center Indomaret
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
            <div className="p-2 w-fit rounded-lg bg-blue-50 text-[#0056b3]">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-900">Multi-Cabang Nasional</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Mendukung operasional cabang mandiri dan pengawasan terpusat oleh Admin Pusat di Head Office.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
            <div className="p-2 w-fit rounded-lg bg-emerald-50 text-emerald-600">
              <Cloud className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-900">Google Drive Terdistribusi</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Penyimpanan berkas bukti otomatis dialihkan ke Google Drive milik masing-masing cabang via Drive Bridge.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
            <div className="p-2 w-fit rounded-lg bg-indigo-50 text-indigo-600">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-900">Impor & Ekspor Excel</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Template data dinamis dengan sheet petunjuk master data, serta ekspor laporan rekap lengkap.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
            <div className="p-2 w-fit rounded-lg bg-amber-50 text-amber-600">
              <Printer className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-900">Format Cetak Ganda (A4)</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Mendukung Berita Acara formal standar dan Lampiran Bukti 8 Kolom (4 peserta per baris) dengan foto bukti asli.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
            <div className="p-2 w-fit rounded-lg bg-rose-50 text-rose-600">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-900">Keamanan & Audit Log</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Proteksi lockout saat salah sandi beruntun, enkripsi credential rahasia, dan pelacakan audit trail.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
            <div className="p-2 w-fit rounded-lg bg-teal-50 text-teal-600">
              <UserCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-gray-900">Wajib Ganti Sandi Awal</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Pengguna baru dipaksa mengganti password default pada saat pertama kali login demi proteksi akun.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
