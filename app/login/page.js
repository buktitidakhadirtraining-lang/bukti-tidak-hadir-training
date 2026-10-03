// Sistem Data Ketidakhadiran Peserta Training — dibuat oleh Bang Ajiib (2026)
// app/login/page.js
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Lock, User, Eye, EyeOff, Loader2, AlertCircle, Info } from 'lucide-react';
import { LOGO_URL, APP_NAME, APP_DESCRIPTION, FOOTER_TEXT } from '../../lib/config.js';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDemoCreds, setShowDemoCreds] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password) {
      setErrorMessage('Username dan password wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error || 'Username atau password salah');
        toast.error(data.error || 'Gagal masuk');
        setIsLoading(false);
        return;
      }

      toast.success(`Selamat datang, ${data.data?.fullName || data.data?.username}!`);

      // Mengambil target redirect dari URL query atau default ke /dashboard
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const targetUrl = urlParams?.get('redirect') || '/dashboard';

      setTimeout(() => {
        if (data.data?.mustChangePassword) {
          window.location.href = '/akun?change_required=true';
        } else {
          window.location.href = targetUrl;
        }
      }, 250);
    } catch (err) {
      setErrorMessage('Terjadi kesalahan jaringan. Silakan periksa koneksi Anda.');
      toast.error('Gagal terhubung ke server');
      setIsLoading(false);
    }
  }

  function fillCreds(u, p) {
    setUsername(u);
    setPassword(p);
    setErrorMessage('');
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-[#F4F7F6]">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        {/* Tricolor Bar Indomaret */}
        <div className="indomaret-bar">
          <div className="indomaret-bar-blue" />
          <div className="indomaret-bar-yellow" />
          <div className="indomaret-bar-red" />
        </div>

        <div className="p-6 sm:p-8">
          {/* Logo & Judul */}
          <div className="flex flex-col items-center text-center mb-6">
            <img
              src={LOGO_URL}
              alt="Logo Indomaret"
              className="h-12 sm:h-14 w-auto object-contain mb-3"
            />
            <h1 className="text-lg sm:text-xl font-black text-gray-900 font-title tracking-tight">
              DATA KETIDAKHADIRAN
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#0056b3] uppercase tracking-wider mt-0.5">
              Peserta Training PT Indomarco Prismatama
            </p>
          </div>

          {/* Pesan Error Jika Ada */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ED1C24]" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: admin.pusat atau admin.sby"
                  className="w-full pl-10 pr-4 py-3 text-sm bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] focus:border-transparent transition-all min-h-[46px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 text-sm bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] focus:border-transparent transition-all min-h-[46px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-[#0056b3] hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <span>Masuk ke Sistem</span>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Guide */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowDemoCreds(!showDemoCreds)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-[#0056b3] font-semibold py-1"
            >
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Informasi Akun Default
              </span>
              <span>{showDemoCreds ? 'Sembunyikan' : 'Tampilkan'}</span>
            </button>

            {showDemoCreds && (
              <div className="mt-3 p-3 bg-blue-50/50 rounded-xl text-xs space-y-2 border border-blue-100">
                <p className="text-gray-600 font-medium">Klik akun untuk mengisi otomatis:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillCreds('admin.pusat', 'Admin123!')}
                    className="p-2 text-left bg-white rounded-lg border border-gray-200 hover:border-[#0056b3] flex justify-between items-center transition-colors"
                  >
                    <div>
                      <div className="font-bold text-gray-800">Admin Pusat</div>
                      <div className="text-[11px] text-gray-500 font-mono">admin.pusat / Admin123!</div>
                    </div>
                    <span className="text-[10px] font-bold text-[#0056b3] uppercase">Pilih</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillCreds('admin.sby', 'Admin123!')}
                    className="p-2 text-left bg-white rounded-lg border border-gray-200 hover:border-[#0056b3] flex justify-between items-center transition-colors"
                  >
                    <div>
                      <div className="font-bold text-gray-800">Admin Surabaya</div>
                      <div className="text-[11px] text-gray-500 font-mono">admin.sby / Admin123!</div>
                    </div>
                    <span className="text-[10px] font-bold text-[#0056b3] uppercase">Pilih</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-6 text-xs text-gray-500 text-center font-medium">
        <p>{FOOTER_TEXT}</p>
      </footer>
    </div>
  );
}
