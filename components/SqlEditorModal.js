// components/SqlEditorModal.js
'use client';

import React, { useState } from 'react';
import { Copy, Check, X, Database, Sparkles, AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const SQL_MIGRATION_ADD_BRANCH_ID = `-- ==============================================================================
-- SKRIP MIGRASI & PERBAIKAN HAK AKSES SUPABASE (JALANKAN DI SQL EDITOR)
-- ==============================================================================
-- 1. Buat tabel jika belum ada
create table if not exists data_tambahan (
  id uuid primary key default gen_random_uuid(),
  no int,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  branch_id text,
  created_by text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists list_tidak_hadir (
  id uuid primary key default gen_random_uuid(),
  no int,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  branch_id text,
  created_by text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists cetak_list_tidak_hadir (
  id text primary key,
  no int,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  source_type text default 'list_tidak_hadir',
  branch_id text,
  created_by text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists cetak_rekap (
  id uuid primary key default gen_random_uuid(),
  no int,
  jenis_training text not null,
  target_lskt text default '0',
  dispensasi text default '0',
  target_tc_report text default '',
  hadir text default '',
  tidak_hadir text default '',
  no_list_peserta_tidak_hadir text default '',
  branch_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Pastikan kolom branch_id & created_by ada pada semua tabel
alter table data_tambahan add column if not exists branch_id text;
alter table data_tambahan add column if not exists created_by text;
alter table data_tambahan add column if not exists no int;
alter table data_tambahan add column if not exists kd_toko text;
alter table data_tambahan add column if not exists nama_toko text;
alter table data_tambahan add column if not exists alasan_tidak_hadir text;

alter table list_tidak_hadir add column if not exists branch_id text;
alter table list_tidak_hadir add column if not exists created_by text;
alter table list_tidak_hadir add column if not exists no int;
alter table list_tidak_hadir add column if not exists kd_toko text;
alter table list_tidak_hadir add column if not exists nama_toko text;
alter table list_tidak_hadir add column if not exists alasan_tidak_hadir text;

alter table cetak_list_tidak_hadir add column if not exists branch_id text;
alter table cetak_list_tidak_hadir add column if not exists created_by text;
alter table cetak_list_tidak_hadir add column if not exists source_type text default 'list_tidak_hadir';

alter table cetak_rekap add column if not exists branch_id text;

-- 3. Matikan RLS agar Anon Key & Service Role bisa menyimpan data tanpa diblokir
alter table if exists data_tambahan disable row level security;
alter table if exists list_tidak_hadir disable row level security;
alter table if exists cetak_list_tidak_hadir disable row level security;
alter table if exists cetak_rekap disable row level security;
alter table if exists list_soft_skill disable row level security;

-- 4. Berikan izin penuh ke anon, authenticated, dan service_role
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- 5. Reload Schema PostgREST
notify pgrst, 'reload schema';`;

export default function SqlEditorModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SQL_MIGRATION_ADD_BRANCH_ID);
      setCopied(true);
      toast.success('Kode SQL Supabase berhasil disalin!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Gagal menyalin teks');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-[#0056b3] rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-title">
                Skrip SQL Supabase (Struktur Tabel & Izin Akses)
              </h2>
              <p className="text-xs text-gray-500">
                Jalankan skrip ini sekali di <strong>SQL Editor Dashboard Supabase</strong> Anda.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-900">
                Mengapa data belum masuk ke Supabase?
              </p>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                Jika tabel belum dibuat di Supabase atau fitur <strong>Row Level Security (RLS)</strong> masih mengunci akses, jalankan skrip di bawah ini di <strong>Dashboard Supabase &gt; SQL Editor &gt; New Query &gt; Run</strong>.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 rounded-t-xl text-[11px] font-mono">
              <span>supabase_setup_script.sql</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Semua SQL'}</span>
              </button>
            </div>
            <pre className="p-4 bg-gray-900 text-green-400 rounded-b-xl overflow-x-auto text-xs font-mono max-h-72 leading-relaxed selection:bg-blue-500 selection:text-white">
              {SQL_MIGRATION_ADD_BRANCH_ID}
            </pre>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2 text-blue-950">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Langkah Singkat Menjalankan Skrip:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-900">
              <li>Klik tombol <strong>"Salin Semua SQL"</strong> di atas.</li>
              <li>Buka proyek Supabase Anda di browser (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-bold text-blue-700">supabase.com/dashboard</a>).</li>
              <li>Pilih menu <strong>SQL Editor</strong> di bilah navigasi kiri &gt; Klik <strong>New Query</strong>.</li>
              <li>Tempel (Paste) kode SQL tersebut lalu klik <strong>Run</strong>.</li>
              <li>Selesai! Seluruh data input akan langsung masuk ke database Supabase Anda.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <p className="text-[11px] text-gray-500">
            Skrip ini aman dijalankan berulang kali (Idempotent).
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Sudah Tersalin' : 'Salin Skrip SQL'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
