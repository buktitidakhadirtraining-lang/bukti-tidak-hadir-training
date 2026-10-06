// app/(app)/input-tambahan/page.js
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Save,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  TableProperties,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Code2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SPREADSHEET_URL } from '../../../lib/config.js';
import AppsScriptModal from '../../../components/AppsScriptModal.js';

export default function InputTambahanPage() {
  const [training, setTraining] = useState('YFC');
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [kdToko, setKdToko] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [alasanTidakHadir, setAlasanTidakHadir] = useState('Sakit');

  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [meta, setMeta] = useState(null);
  const [showScriptModal, setShowScriptModal] = useState(false);

  // Ambil meta alasan & training
  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch('/api/meta');
        const json = await res.json();
        if (json.ok) setMeta(json.data);
      } catch (err) {
        console.error('Failed to load meta:', err);
      }
    }
    fetchMeta();
  }, []);

  // Ambil data tambahan yang sudah tersimpan
  const fetchRecords = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/data-tambahan');
      const json = await res.json();
      if (json.ok) {
        setRecords(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch data tambahan:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nik.trim() || !nama.trim()) {
      toast.error('NIK dan Nama Peserta wajib diisi');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Menyimpan ke Supabase & Google Spreadsheet...');

    try {
      const res = await fetch('/api/data-tambahan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          training: training.trim(),
          nik: nik.trim(),
          nama: nama.trim(),
          kd_toko: kdToko.trim(),
          nama_toko: namaToko.trim(),
          alasan_tidak_hadir: alasanTidakHadir.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(
          'Data berhasil tersimpan di Supabase & otomatis tercatat di sheet Data_tambahan!',
          { id: toastId }
        );
        // Reset form input
        setNik('');
        setNama('');
        setKdToko('');
        setNamaToko('');
        fetchRecords();
      } else {
        toast.error(json.error || 'Gagal menyimpan data tambahan', { id: toastId });
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan: ' + err.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  // Filter pencarian di tabel
  const filteredRecords = records.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.nik && String(r.nik).toLowerCase().includes(term)) ||
      (r.nama && String(r.nama).toLowerCase().includes(term)) ||
      (r.training && String(r.training).toLowerCase().includes(term)) ||
      (r.nama_toko && String(r.nama_toko).toLowerCase().includes(term)) ||
      (r.alasan_tidak_hadir && String(r.alasan_tidak_hadir).toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-[#0056b3] rounded-xl">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 font-title">
                Input Data Tambahan
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Penginputan peserta tambahan yang otomatis tersimpan ke database Supabase dan tercatat di Google Spreadsheet sheet <strong>Data_tambahan</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScriptModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-[#0056b3] rounded-xl text-xs font-bold transition-all border border-blue-200"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Kode & Panduan Apps Script (Code.gs)</span>
            </button>

            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-200"
            >
              <span>Buka Google Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Petunjuk Sinkronisasi Otomatis Spreadsheet */}
        <div className="mt-4 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Info Sinkronisasi Otomatis Spreadsheet:</span> Data yang diinput di bawah langsung tersimpan ke Supabase tabel <code>data_tambahan</code>. Agar otomatis langsung tercatat di sheet <strong>Data_tambahan</strong> Google Spreadsheet Anda, silakan pasang skrip <code>Code.gs</code> di Spreadsheet Anda.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowScriptModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 self-start sm:self-auto transition-colors"
          >
            Lihat Kode Code.gs
          </button>
        </div>
      </div>

      {/* Form Input Data Tambahan */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {/* Tricolor Bar */}
        <div className="indomaret-bar">
          <div className="indomaret-bar-blue" />
          <div className="indomaret-bar-yellow" />
          <div className="indomaret-bar-red" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            {/* 1. Jenis Training */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Jenis Training <span className="text-red-500">*</span>
              </label>
              {meta?.trainings && meta.trainings.length > 0 ? (
                <select
                  value={training}
                  onChange={(e) => setTraining(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
                >
                  {meta.trainings.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                  <option value="MODUL A">MODUL A</option>
                  <option value="SBM">SBM</option>
                  <option value="PKTF">PKTF</option>
                  <option value="YFC">YFC</option>
                  <option value="PCDO">PCDO</option>
                  <option value="EVABUL CSCI">EVABUL CSCI</option>
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={training}
                  onChange={(e) => setTraining(e.target.value)}
                  placeholder="Contoh: YFC, YCCG, PCDO..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
                />
              )}
            </div>

            {/* 2. NIK */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                NIK Peserta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="Contoh: 2015698709"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-mono font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>

            {/* 3. Nama Peserta */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Nama Lengkap Peserta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: AHMAD FAUZI"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>

            {/* 4. KD Toko */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Kode Toko
              </label>
              <input
                type="text"
                value={kdToko}
                onChange={(e) => setKdToko(e.target.value)}
                placeholder="Contoh: TVYI, TSSD, TCJ2..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-mono font-medium uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>

            {/* 5. Nama Toko */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Nama Toko
              </label>
              <input
                type="text"
                value={namaToko}
                onChange={(e) => setNamaToko(e.target.value)}
                placeholder="Contoh: INRES KALIBAGRE"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium uppercase focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
              />
            </div>

            {/* 6. Alasan Tidak Hadir */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Alasan Tidak Hadir <span className="text-red-500">*</span>
              </label>
              {meta?.reasons && meta.reasons.length > 0 ? (
                <select
                  value={alasanTidakHadir}
                  onChange={(e) => setAlasanTidakHadir(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
                >
                  {meta.reasons.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                  <option value="TIDAK LULUS PRA TRAINING">TIDAK LULUS PRA TRAINING</option>
                  <option value="TIDAK TUNTAS MISI ONLINE">TIDAK TUNTAS MISI ONLINE</option>
                  <option value="MUTASI IDEL">MUTASI IDEL</option>
                  <option value="Lain - lain">Lain - lain</option>
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={alasanTidakHadir}
                  onChange={(e) => setAlasanTidakHadir(e.target.value)}
                  placeholder="Contoh: Sakit, Cuti, Resign..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0056b3]"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-[11px] text-gray-500 italic">
              Data yang Anda input akan langsung tercatat di tabel Supabase dan sheet Data_tambahan secara real-time.
            </span>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 min-h-[42px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Data Tambahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Data Tambahan Terkini */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TableProperties className="w-5 h-5 text-gray-600" />
            <h2 className="text-base font-bold text-gray-900 font-title">
              Daftar Data Tambahan Tersimpan ({filteredRecords.length} Data)
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari NIK, Nama, Toko..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              />
            </div>
            <button
              type="button"
              onClick={fetchRecords}
              disabled={loadingList}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
              title="Perbarui daftar data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                <th className="p-3 text-center w-12">NO</th>
                <th className="p-3 w-32">TRAINING</th>
                <th className="p-3 text-center w-28">NIK</th>
                <th className="p-3">NAMA</th>
                <th className="p-3 text-center w-24">KD TOKO</th>
                <th className="p-3 w-40">NAMA TOKO</th>
                <th className="p-3 w-44">ALASAN TIDAK HADIR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 text-center font-bold text-gray-500">{r.no || i + 1}</td>
                    <td className="p-3 font-semibold text-blue-700 uppercase">{r.training}</td>
                    <td className="p-3 text-center font-mono font-bold text-gray-800">{r.nik}</td>
                    <td className="p-3 font-semibold text-gray-900 uppercase">{r.nama}</td>
                    <td className="p-3 text-center font-mono uppercase text-gray-600">{r.kd_toko || '-'}</td>
                    <td className="p-3 uppercase text-gray-700">{r.nama_toko || '-'}</td>
                    <td className="p-3 text-gray-700">{r.alasan_tidak_hadir || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                    {loadingList ? 'Memuat data...' : 'Belum ada data tambahan yang tercatat.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Kode & Panduan Google Apps Script */}
      <AppsScriptModal
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
      />
    </div>
  );
}
