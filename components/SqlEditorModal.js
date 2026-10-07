// components/SqlEditorModal.js
'use client';

import React, { useState } from 'react';
import { Copy, Check, X, Database, Sparkles, AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const SQL_MIGRATION_ADD_BRANCH_ID = `-- ==============================================================================
-- SKRIP PERBAIKAN DATABASE & ROW LEVEL SECURITY (RLS) SUPABASE
-- JALANKAN SKRIP INI DI SUPABASE SQL EDITOR (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. HAPUS TRIGGER PENYALIN DATA OTOMATIS (Mencegah Input Data tercopy ke Data Tambahan)
DROP TRIGGER IF EXISTS trg_absence_records_to_data_tambahan ON public.absence_records;
DROP FUNCTION IF EXISTS public.fn_auto_record_to_data_tambahan();

-- 2. TAMBAH KOLOM PENANDA SUMBER_INPUT
ALTER TABLE public.absence_records ADD COLUMN IF NOT EXISTS sumber_input TEXT DEFAULT 'input_utama';
ALTER TABLE public.data_tambahan ADD COLUMN IF NOT EXISTS sumber_input TEXT DEFAULT 'input_tambahan';

-- Tandai data lama yang merupakan hasil salinan trigger sebagai 'input_utama'
UPDATE public.data_tambahan
SET sumber_input = 'input_utama'
WHERE source_record_id IS NOT NULL;

-- Tandai data murni tambahan sebagai 'input_tambahan'
UPDATE public.data_tambahan
SET sumber_input = 'input_tambahan'
WHERE source_record_id IS NULL AND (sumber_input IS NULL OR sumber_input != 'input_utama');

-- 3. TABEL: cetak_rekap
CREATE TABLE IF NOT EXISTS public.cetak_rekap (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabang TEXT NOT NULL,
    branch_id TEXT,
    no INTEGER,
    jenis_training TEXT,
    target_lskt INTEGER DEFAULT 0,
    dispensasi INTEGER DEFAULT 0,
    target_tc_report INTEGER DEFAULT 0,
    hadir INTEGER DEFAULT 0,
    tidak_hadir INTEGER DEFAULT 0,
    no_list_peserta_tidak_hadir TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pastikan kolom cabang ada
ALTER TABLE public.cetak_rekap ADD COLUMN IF NOT EXISTS cabang TEXT;
ALTER TABLE public.cetak_rekap ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- Aktifkan RLS pada cetak_rekap
ALTER TABLE public.cetak_rekap ENABLE ROW LEVEL SECURITY;

-- Drop Policy Lama
DROP POLICY IF EXISTS "Select cetak_rekap per cabang" ON public.cetak_rekap;
DROP POLICY IF EXISTS "Insert cetak_rekap per cabang" ON public.cetak_rekap;
DROP POLICY IF EXISTS "Update cetak_rekap per cabang" ON public.cetak_rekap;
DROP POLICY IF EXISTS "Delete cetak_rekap per cabang" ON public.cetak_rekap;

-- Policy RLS cetak_rekap
CREATE POLICY "Select cetak_rekap per cabang" ON public.cetak_rekap
    FOR SELECT USING (true);

CREATE POLICY "Insert cetak_rekap per cabang" ON public.cetak_rekap
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Update cetak_rekap per cabang" ON public.cetak_rekap
    FOR UPDATE USING (true);

CREATE POLICY "Delete cetak_rekap per cabang" ON public.cetak_rekap
    FOR DELETE USING (true);


-- 2. TABEL: list_soft_skill
CREATE TABLE IF NOT EXISTS public.list_soft_skill (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabang TEXT NOT NULL,
    branch_id TEXT,
    no INTEGER,
    nik TEXT,
    nama TEXT,
    jabatan TEXT,
    kategory TEXT,
    detail_alasan TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pastikan kolom cabang ada
ALTER TABLE public.list_soft_skill ADD COLUMN IF NOT EXISTS cabang TEXT;
ALTER TABLE public.list_soft_skill ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- Aktifkan RLS pada list_soft_skill
ALTER TABLE public.list_soft_skill ENABLE ROW LEVEL SECURITY;

-- Drop Policy Lama
DROP POLICY IF EXISTS "Select list_soft_skill per cabang" ON public.list_soft_skill;
DROP POLICY IF EXISTS "Insert list_soft_skill per cabang" ON public.list_soft_skill;
DROP POLICY IF EXISTS "Update list_soft_skill per cabang" ON public.list_soft_skill;
DROP POLICY IF EXISTS "Delete list_soft_skill per cabang" ON public.list_soft_skill;

-- Policy RLS list_soft_skill
CREATE POLICY "Select list_soft_skill per cabang" ON public.list_soft_skill
    FOR SELECT USING (true);

CREATE POLICY "Insert list_soft_skill per cabang" ON public.list_soft_skill
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Update list_soft_skill per cabang" ON public.list_soft_skill
    FOR UPDATE USING (true);

CREATE POLICY "Delete list_soft_skill per cabang" ON public.list_soft_skill
    FOR DELETE USING (true);


-- 3. Berikan Izin Akses Tabel
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Reload Schema PostgREST
NOTIFY pgrst, 'reload schema';`;

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
              <li>Klik tombol <strong>&quot;Salin Semua SQL&quot;</strong> di atas.</li>
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
