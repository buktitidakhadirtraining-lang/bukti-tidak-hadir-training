// components/Navbar.js
'use client';

import { Menu, User, Building } from 'lucide-react';
import { LOGO_URL } from '../lib/config.js';

export default function Navbar({ onOpenSidebar, user }) {
  const isAdminPusat = user?.role === 'admin_pusat';

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-200/80 shadow-xs no-print">
      {/* Tricolor Bar Indomaret */}
      <div className="indomaret-bar">
        <div className="indomaret-bar-blue" />
        <div className="indomaret-bar-yellow" />
        <div className="indomaret-bar-red" />
      </div>

      <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left Side: Hamburger on Mobile + Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="lg:hidden p-2 text-gray-600 hover:text-[#0056b3] hover:bg-blue-50 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Buka Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="lg:hidden flex items-center gap-2">
            <img src={LOGO_URL} alt="Logo" className="h-6 w-auto" />
            <span className="text-xs font-black text-[#0056b3] uppercase tracking-wider font-title">
              DATA TRAINING
            </span>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-base font-bold text-gray-800 font-title">
              {isAdminPusat ? 'Kantor Pusat' : `Cabang: ${user?.branch_name || 'Aktif'}`}
            </h2>
          </div>
        </div>

        {/* Right Side: Role & User Info */}
        <div className="flex items-center gap-3">
          {user?.branch_name && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
              <Building className="w-3.5 h-3.5 text-gray-500" />
              <span>{user.branch_name}</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/60 rounded-xl border border-blue-100">
            <div className="w-7 h-7 rounded-lg bg-[#0056b3] text-white flex items-center justify-center font-bold text-xs">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-gray-900 leading-tight max-w-[130px] truncate">
                {user?.full_name || 'Pengguna'}
              </p>
              <p className="text-[10px] text-[#0056b3] font-semibold uppercase leading-tight">
                {isAdminPusat ? 'Admin Pusat' : 'Admin Cabang'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
