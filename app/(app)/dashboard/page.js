// Sistem Data Ketidakhadiran Peserta Training — dibuat oleh Bang Ajiib (2026)
// app/(app)/dashboard/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  FileCheck2,
  FileX2,
  Percent,
  PlusCircle,
  FileSpreadsheet,
  UploadCloud,
  Printer,
  Calendar,
  Filter,
  RefreshCw,
  Building2,
  GraduationCap,
  HelpCircle,
} from 'lucide-react';
import StatCard from '../../../components/StatCard.js';
import { StatCardSkeleton } from '../../../components/Skeleton.js';
import { MONTHS } from '../../../lib/config.js';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/meta');
      const json = await res.json();
      if (json.ok) {
        setMeta(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch meta:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.set('year', selectedYear);
      if (selectedMonth) params.set('month', selectedMonth);
      if (selectedBranch) params.set('branch_id', selectedBranch);

      const res = await fetch(`/api/stats?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedBranch]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const isAdminPusat = meta?.userRole === 'admin_pusat';

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-title tracking-tight">
            Dashboard Ketidakhadiran
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Ringkasan data ketidakhadiran peserta training dan kelengkapan bukti berita acara.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/input"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[42px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Input Data</span>
          </Link>
          <Link
            href="/rekap"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 hover:border-[#0056b3] text-gray-700 hover:text-[#0056b3] text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[42px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-gray-500" />
            <span>Lihat Rekap</span>
          </Link>
          <Link
            href="/cetak"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold shadow-xs transition-all min-h-[42px]"
            title="Cetak Berita Acara"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            <span className="hidden sm:inline">Cetak PDF</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-[#0056b3]" />
          <span>Filter Data:</span>
        </div>

        {/* Filter Tahun */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
        >
          {meta?.years?.map((y) => (
            <option key={y} value={y}>
              Tahun {y}
            </option>
          ))}
        </select>

        {/* Filter Bulan */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
        >
          <option value="">Semua Bulan (Jan - Des)</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {/* Filter Cabang (Hanya Admin Pusat) */}
        {isAdminPusat && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[38px]"
          >
            <option value="">Semua Cabang Nasional</option>
            {meta?.branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} - {b.name}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={fetchStats}
          disabled={loading}
          className="ml-auto p-2 text-gray-500 hover:text-[#0056b3] hover:bg-blue-50 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
          title="Segarkan Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0056b3]' : ''}`} />
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Tidak Hadir"
              value={stats?.totalAbsent ?? 0}
              subtitle="Peserta training"
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Ada Bukti Drive"
              value={stats?.withProofCount ?? 0}
              subtitle="Tersimpan di Google Drive"
              icon={FileCheck2}
              color="blue"
            />
            <StatCard
              title="Belum Ada Bukti"
              value={stats?.withoutProofCount ?? 0}
              subtitle="Perlu tindak lanjut cabang"
              icon={FileX2}
              color="red"
            />
            <StatCard
              title="Rasio Kelengkapan"
              value={!stats?.totalAbsent || isNaN(stats?.proofRatePercentage) ? '0%' : `${stats.proofRatePercentage}%`}
              subtitle="Tingkat kepatuhan bukti"
              icon={Percent}
              color="yellow"
            />
          </>
        )}
      </div>

      {/* Visual Breakdowns: Training, Alasan, Trend Bulanan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribusi Menurut Jenis Training */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-[#0056b3]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-title">
                Ketidakhadiran per Jenis Training
              </h3>
              <p className="text-xs text-gray-500">Distribusi peserta menurut modul training</p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {stats?.byTraining?.length > 0 ? (
              stats.byTraining.map((item) => {
                const total = stats.totalAbsent || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700 truncate">{item.name}</span>
                      <span className="text-[#0056b3] font-bold shrink-0">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#0056b3] h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">Tidak ada data untuk periode ini</p>
            )}
          </div>
        </div>

        {/* Distribusi Menurut Alasan */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-title">
                Alasan Ketidakhadiran Terbanyak
              </h3>
              <p className="text-xs text-gray-500">Penyebab utama peserta tidak dapat hadir</p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {stats?.byReason?.length > 0 ? (
              stats.byReason.map((item) => {
                const total = stats.totalAbsent || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700 truncate">{item.name}</span>
                      <span className="text-amber-600 font-bold shrink-0">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">Tidak ada data untuk periode ini</p>
            )}
          </div>
        </div>
      </div>

      {/* Tren Bulanan & Distribusi Cabang */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tren Bulanan */}
        <div className={`bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft ${isAdminPusat ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-[#0056b3]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-title">
                Tren Ketidakhadiran Tahun {selectedYear}
              </h3>
              <p className="text-xs text-gray-500">Jumlah kasus per bulan sepanjang tahun</p>
            </div>
          </div>

          {/* Bar Chart Sederhana Responsif */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-6 items-end h-48 border-b border-gray-200">
            {stats?.monthlyTrend?.map((m) => {
              const maxCount = Math.max(1, ...stats.monthlyTrend.map((x) => x.count));
              const heightPct = Math.max(8, Math.round((m.count / maxCount) * 100));
              return (
                <div key={m.label} className="flex flex-col items-center h-full justify-end group">
                  <span className="text-[10px] font-bold text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.count}
                  </span>
                  <div
                    className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                      m.count > 0 ? 'bg-[#0056b3] hover:bg-blue-700' : 'bg-gray-100'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[11px] font-semibold text-gray-600 mt-2">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Khusus Admin Pusat: Ketidakhadiran per Cabang */}
        {isAdminPusat && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-[#0056b3]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-title">
                  Peringkat Cabang
                </h3>
                <p className="text-xs text-gray-500">Jumlah kasus per cabang</p>
              </div>
            </div>

            <div className="space-y-3 mt-4 max-h-64 overflow-y-auto pr-1">
              {stats?.byBranch?.length > 0 ? (
                stats.byBranch.map((item, idx) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-xs font-black text-gray-400">#{idx + 1}</span>
                      <span className="text-xs font-bold text-gray-800 truncate">{item.name}</span>
                    </div>
                    <span className="text-xs font-black text-[#0056b3] px-2 py-0.5 bg-white rounded-lg border border-gray-200">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-6">Tidak ada data cabang</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
