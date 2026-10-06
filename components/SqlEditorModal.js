// components/SqlEditorModal.js
'use client';

import React, { useState } from 'react';
import { Copy, Check, X, Database, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { SPREADSHEET_URL } from '../lib/config.js';

const SQL_SCRIPT = `-- ==============================================================================
-- SCHEMA SQL: TABEL GOOGLE SPREADSHEET SYNC & CETAK REKAP DISPENSASI
-- ==============================================================================
-- Mendukung multi-cabang (Tiap cabang memiliki file Spreadsheet & Web App sendiri)

-- 1. TABEL: cetak_rekap (Sesuai Sheet cetak_rekap)
-- Header: NO, JENIS TRAINING, TARGET LSKT, DISPENSASI, TARGET TC REPORT, HADIR, TIDAK HADIR, NO LIST PESERTA TIDAK HADIR
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
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create unique index if not exists idx_cetak_rekap_training on cetak_rekap (jenis_training);

-- 2. TABEL: list_tidak_hadir (Sesuai Sheet list_tidak_hadir)
-- Header: NO, TRAINING, NIK, NAMA, KD TOKO, NAMA TOKO, ALASAN TIDAK HADIR
create table if not exists list_tidak_hadir (
  id uuid primary key default gen_random_uuid(),
  no int,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists idx_list_tidak_hadir_training on list_tidak_hadir (training);
create index if not exists idx_list_tidak_hadir_nik on list_tidak_hadir (nik);

-- 3. TABEL: data_tambahan (Sesuai Sheet Data_tambahan)
-- Header: NO, TRAINING, NIK, NAMA, KD TOKO, NAMA TOKO, ALASAN TIDAK HADIR
-- Otomatis mencatat data input baru dari website ke tabel ini
create table if not exists data_tambahan (
  id uuid primary key default gen_random_uuid(),
  no serial,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  source_record_id uuid,
  created_at timestamptz default now() not null
);

-- 4. TABEL: cetak_list_tidak_hadir (Sesuai Sheet cetak_list_tidak_hadir)
-- Header: NO, TRAINING, NIK, NAMA, KD TOKO, NAMA TOKO, ALASAN TIDAK HADIR
create table if not exists cetak_list_tidak_hadir (
  id uuid primary key default gen_random_uuid(),
  no int,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 5. TABEL: list_soft_skill (Sesuai Sheet list_soft_skill Google Sheets)
-- Header: NIK, Nama, Jabatan, Kategory, Detail Alasan
-- Otomatis ditarik & disinkronisasi setiap 10 detik dari spreadsheet
create table if not exists list_soft_skill (
  id uuid primary key default gen_random_uuid(),
  no int,
  nik text not null,
  nama text not null,
  jabatan text default '',
  kategory text default '',
  detail_alasan text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists idx_list_soft_skill_nik on list_soft_skill (nik);

-- 6. TRIGGER: Otomatis mencatat data baru dari absence_records ke data_tambahan
create or replace function fn_auto_record_to_data_tambahan()
returns trigger as $$
declare
  v_training_name text;
  v_alasan_name text;
  v_next_no int;
begin
  select name into v_training_name from training_types where id = new.training_id;
  if v_training_name is null then v_training_name := 'TRAINING'; end if;

  select name into v_alasan_name from absence_reasons where id = new.alasan_id;
  if v_alasan_name is null then v_alasan_name := coalesce(new.keterangan, '-'); end if;

  select coalesce(max(no), 0) + 1 into v_next_no from data_tambahan;

  insert into data_tambahan (
    no, training, nik, nama, kd_toko, nama_toko, alasan_tidak_hadir, source_record_id, created_at
  ) values (
    v_next_no, v_training_name, new.nik, new.nama_peserta, coalesce(new.jabatan, '-'), '-', v_alasan_name, new.id, now()
  );

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_absence_records_to_data_tambahan on absence_records;
create trigger trg_absence_records_to_data_tambahan
after insert on absence_records
for each row
execute function fn_auto_record_to_data_tambahan();

-- 7. TABEL: app_settings (Pengaturan Webhook & Konfigurasi Sistem)
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now() not null
);

-- 8. Hak Akses RLS
alter table cetak_rekap enable row level security;
alter table list_tidak_hadir enable row level security;
alter table data_tambahan enable row level security;
alter table cetak_list_tidak_hadir enable row level security;
alter table list_soft_skill enable row level security;
alter table app_settings enable row level security;

create policy "Full access cetak_rekap" on cetak_rekap for all using (true) with check (true);
create policy "Full access list_tidak_hadir" on list_tidak_hadir for all using (true) with check (true);
create policy "Full access data_tambahan" on data_tambahan for all using (true) with check (true);
create policy "Full access cetak_list_tidak_hadir" on cetak_list_tidak_hadir for all using (true) with check (true);
create policy "Full access list_soft_skill" on list_soft_skill for all using (true) with check (true);
create policy "Full access app_settings" on app_settings for all using (true) with check (true);

notify pgrst, 'reload schema';`;

const SQL_ONLY_SOFT_SKILL = `-- ==============================================================================
-- KODE SQL EDITOR KHUSUS TABEL: list_soft_skill
-- ==============================================================================
-- Header: NIK | Nama | Jabatan | Kategory | Detail Alasan
create table if not exists list_soft_skill (
  id uuid primary key default gen_random_uuid(),
  no int,
  nik text not null,
  nama text not null,
  jabatan text default '',
  kategory text default '',
  detail_alasan text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_list_soft_skill_nik on list_soft_skill (nik);
alter table list_soft_skill enable row level security;
create policy "Full access list_soft_skill" on list_soft_skill for all using (true) with check (true);

notify pgrst, 'reload schema';`;

export default function SqlEditorModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'soft_skill'
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentSql = activeTab === 'soft_skill' ? SQL_ONLY_SOFT_SKILL : SQL_SCRIPT;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(currentSql);
      setCopied(true);
      toast.success(
        activeTab === 'soft_skill'
          ? 'Kode SQL list_soft_skill berhasil disalin!'
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
                SQL Editor Supabase (Sheet Sync & Rekap)
              </h2>
              <p className="text-xs text-gray-500">
                Skrip SQL untuk membuat tabel cetak_rekap, list_tidak_hadir, data_tambahan, cetak_list_tidak_hadir, dan list_soft_skill
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
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1.5 leading-relaxed">
            <p className="font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#0056b3]" />
              Sistem Sinkronisasi Live Time (10 Detik):
            </p>
            <p>
              1. <strong>Tabel cetak_rekap, list_tidak_hadir, & list_soft_skill</strong> otomatis ditarik dari Google Spreadsheet setiap 10 detik oleh sistem backend dan diperbarui ke Supabase.
            </p>
            <p>
              2. <strong>Tabel Data_tambahan</strong> otomatis mencatat setiap data tambahan baru yang diinput via website ke Supabase & Google Spreadsheet.
            </p>
            <div className="pt-1">
              <a
                href={SPREADSHEET_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0056b3] hover:underline"
              >
                <span>Buka Google Spreadsheet Sumber</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div>
            {/* Tabs Pemilihan Skrip */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-md font-bold text-xs transition-colors ${
                    activeTab === 'all'
                      ? 'bg-white text-[#0056b3] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Semua Tabel (Lengkap)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('soft_skill')}
                  className={`px-3 py-1 rounded-md font-bold text-xs transition-colors ${
                    activeTab === 'soft_skill'
                      ? 'bg-white text-[#0056b3] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Khusus list_soft_skill
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0056b3] hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Kode SQL'}</span>
              </button>
            </div>

            <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[340px] leading-relaxed border border-gray-800">
              {currentSql}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-xs transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin ke Clipboard' : 'Salin Kode SQL Ini'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
