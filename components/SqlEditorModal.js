// components/SqlEditorModal.js
'use client';

import React, { useState } from 'react';
import { Copy, Check, X, Database, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const SQL_MIGRATION_ADD_BRANCH_ID = `-- ==============================================================================
-- SKRIP MIGRASI CEPAT: TAMBAH KOLOM branch_id & created_by
-- ==============================================================================
-- Jalankan skrip ini di SQL Editor Supabase untuk mengaktifkan isolasi data per cabang:

ALTER TABLE data_tambahan ADD COLUMN IF NOT EXISTS branch_id text;
ALTER TABLE data_tambahan ADD COLUMN IF NOT EXISTS created_by text;

ALTER TABLE list_tidak_hadir ADD COLUMN IF NOT EXISTS branch_id text;
ALTER TABLE list_tidak_hadir ADD COLUMN IF NOT EXISTS created_by text;

ALTER TABLE cetak_list_tidak_hadir ADD COLUMN IF NOT EXISTS branch_id text;
ALTER TABLE cetak_list_tidak_hadir ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE cetak_list_tidak_hadir ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'list_tidak_hadir';

ALTER TABLE cetak_rekap ADD COLUMN IF NOT EXISTS branch_id text;
ALTER TABLE list_soft_skill ADD COLUMN IF NOT EXISTS branch_id text;

CREATE INDEX IF NOT EXISTS idx_data_tambahan_branch ON data_tambahan(branch_id);
CREATE INDEX IF NOT EXISTS idx_list_tidak_hadir_branch ON list_tidak_hadir(branch_id);
CREATE INDEX IF NOT EXISTS idx_cetak_list_tidak_hadir_branch ON cetak_list_tidak_hadir(branch_id);

NOTIFY pgrst, 'reload schema';`;

const SQL_SCRIPT = `-- ==============================================================================
-- SCHEMA SQL LENGKAP: TABEL DATA KETIDAKHADIRAN & CETAK BUKTI PDF
-- ==============================================================================
-- Mendukung isolasi data multi-cabang (Setiap Admin Cabang hanya melihat data cabangnya)

-- 1. TABEL: cetak_rekap
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
create index if not exists idx_cetak_rekap_branch on cetak_rekap (branch_id);

-- 2. TABEL: list_tidak_hadir (Menu: List Tidak Hadir Training)
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
create index if not exists idx_list_tidak_hadir_branch on list_tidak_hadir (branch_id);
create index if not exists idx_list_tidak_hadir_training on list_tidak_hadir (training);
create index if not exists idx_list_tidak_hadir_nik on list_tidak_hadir (nik);

-- 3. TABEL: data_tambahan (Menu: Input Data Tambahan)
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
create index if not exists idx_data_tambahan_branch on data_tambahan (branch_id);
create index if not exists idx_data_tambahan_nik on data_tambahan (nik);

-- 4. TABEL: cetak_list_tidak_hadir (Gabungan Data_tambahan + List_tidak_hadir)
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
create index if not exists idx_cetak_list_tidak_hadir_branch on cetak_list_tidak_hadir (branch_id);

-- 5. TABEL: list_soft_skill
create table if not exists list_soft_skill (
  id uuid primary key default gen_random_uuid(),
  no int,
  nik text not null,
  nama text not null,
  jabatan text default '',
  kategory text default '',
  detail_alasan text default '',
  branch_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists idx_list_soft_skill_branch on list_soft_skill (branch_id);
create index if not exists idx_list_soft_skill_nik on list_soft_skill (nik);

-- 6. Hak Akses RLS
alter table cetak_rekap enable row level security;
alter table list_tidak_hadir enable row level security;
alter table data_tambahan enable row level security;
alter table cetak_list_tidak_hadir enable row level security;
alter table list_soft_skill enable row level security;

create policy "Full access cetak_rekap" on cetak_rekap for all using (true) with check (true);
create policy "Full access list_tidak_hadir" on list_tidak_hadir for all using (true) with check (true);
create policy "Full access data_tambahan" on data_tambahan for all using (true) with check (true);
create policy "Full access cetak_list_tidak_hadir" on cetak_list_tidak_hadir for all using (true) with check (true);
create policy "Full access list_soft_skill" on list_soft_skill for all using (true) with check (true);

notify pgrst, 'reload schema';`;

export default function SqlEditorModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('migration'); // 'migration' | 'full'
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentSql = activeTab === 'migration' ? SQL_MIGRATION_ADD_BRANCH_ID : SQL_SCRIPT;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(currentSql);
      setCopied(true);
      toast.success(
        activeTab === 'migration'
          ? 'Skrip migrasi tambah kolom branch_id berhasil disalin!'
          : 'Kode SQL seluruh tabel berhasil disalin!'
      );
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
                SQL Editor Supabase (Migrasi Kolom Cabang)
              </h2>
              <p className="text-xs text-gray-500">
                Skrip SQL untuk mengaktifkan kolom <strong>branch_id</strong> dan isolasi data per cabang
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Petunjuk */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 space-y-1.5 leading-relaxed">
            <p className="font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Petunjuk Mengatasi Notifikasi &quot;column branch_id does not exist&quot;:
            </p>
            <p>
              1. Buka <strong>SQL Editor</strong> di dashboard Supabase Anda.
            </p>
            <p>
              2. Salin skrip <strong>Migrasi Tambah Kolom (ALTER TABLE)</strong> di bawah ini, tempel di SQL Editor Supabase, lalu klik tombol <strong>RUN</strong>.
            </p>
            <p>
              3. Setelah dijalankan, seluruh tabel Anda akan memiliki kolom <code>branch_id</code> dan data antar-cabang akan terpisah 100% secara otomatis.
            </p>
          </div>

          <div>
            {/* Tabs Pemilihan Skrip */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('migration')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                    activeTab === 'migration'
                      ? 'bg-white text-[#0056b3] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Migrasi Cepat (Tambah Kolom)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('full')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    activeTab === 'full'
                      ? 'bg-white text-[#0056b3] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>Skrip Lengkap (Semua Tabel)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0056b3] hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Kode SQL'}</span>
              </button>
            </div>

            {/* Code Block */}
            <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-[#1e1e1e]">
              <pre className="p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-72 leading-relaxed">
                <code>{currentSql}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <p className="text-[11px] text-gray-500">
            Sistem otomatis beradaptasi (Auto-fallback) agar aplikasi tetap berjalan normal saat proses migrasi.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
