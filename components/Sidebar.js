// components/Sidebar.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  UserPlus,
  FileSpreadsheet,
  UploadCloud,
  Printer,
  Building2,
  Users,
  GraduationCap,
  HelpCircle,
  KeyRound,
  LogOut,
  Info,
  X,
} from 'lucide-react';
import { LOGO_URL, APP_NAME } from '../lib/config.js';

export default function Sidebar({
  user,
  onLogout,
  isOpen,
  onClose,
}) {
  const pathname = usePathname();
  const isAdminPusat = user?.role === 'admin_pusat';

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/input', label: 'Input Data', icon: PlusCircle },
    { href: '/input-tambahan', label: 'Input Data Tambahan', icon: UserPlus },
    { href: '/rekap', label: 'Rekap Data', icon: FileSpreadsheet },
    { href: '/import', label: 'Impor Excel/CSV', icon: UploadCloud },
    { href: '/cetak', label: 'Cetak Bukti PDF', icon: Printer },
    { href: '/tentang', label: 'Tentang Aplikasi', icon: Info },
  ];

  const adminItems = [
    { href: '/admin/cabang', label: 'Master Cabang', icon: Building2 },
    { href: '/admin/pengguna', label: 'Master Pengguna', icon: Users },
    { href: '/admin/training', label: 'Jenis Training', icon: GraduationCap },
    { href: '/admin/alasan', label: 'Alasan Tidak Hadir', icon: HelpCircle },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Tricolor Indomaret Bar */}
      <div className="indomaret-bar">
        <div className="indomaret-bar-blue" />
        <div className="indomaret-bar-yellow" />
        <div className="indomaret-bar-red" />
      </div>

      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0" onClick={onClose}>
          <img src={LOGO_URL} alt="Logo Indomaret" className="h-7 w-auto object-contain shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xs font-black text-[#0056b3] uppercase tracking-wider truncate font-title">
              DATA KETIDAKHADIRAN
            </h1>
            <p className="text-[11px] text-gray-400 font-medium truncate">Peserta Training</p>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Menu Utama
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                    isActive
                      ? 'bg-[#0056b3] text-white shadow-xs'
                      : 'text-gray-700 hover:bg-blue-50/60 hover:text-[#0056b3]'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Menu Khusus Admin Pusat */}
        {isAdminPusat && (
          <div>
            <p className="px-3 text-[11px] font-bold text-[#0056b3] uppercase tracking-wider mb-2">
              Admin Pusat
            </p>
            <nav className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-[#0056b3] text-white shadow-xs'
                        : 'text-gray-700 hover:bg-blue-50/60 hover:text-[#0056b3]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* User Info & Footer Actions */}
      <div className="p-3 border-t border-gray-100 bg-gray-50/70">
        <div className="px-3 py-2 bg-white rounded-xl border border-gray-200/70 mb-2">
          <p className="text-xs font-bold text-gray-900 truncate">{user?.full_name || 'Pengguna'}</p>
          <div className="flex items-center justify-between mt-1">
            <span
              className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider ${
                isAdminPusat ? 'bg-blue-100 text-[#0056b3]' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isAdminPusat ? 'Pusat' : 'Cabang'}
            </span>
            {user?.branch_name && (
              <span className="text-[11px] text-gray-500 font-medium truncate max-w-[120px]">
                {user.branch_name}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/akun"
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200/80 bg-white border border-gray-200 transition-colors min-h-[40px]"
            title="Ganti Password"
          >
            <KeyRound className="w-4 h-4 text-gray-500" />
            <span>Akun</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 bg-white border border-red-200 transition-colors min-h-[40px]"
            title="Keluar dari Aplikasi"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed Left) */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30 shadow-xs">
        {content}
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-slide-right">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
