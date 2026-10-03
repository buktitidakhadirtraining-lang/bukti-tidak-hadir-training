// app/(app)/akun/page.js
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';

export default function AkunPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mustChange =
    searchParams.get('mustChange') === '1' ||
    searchParams.get('mustChange') === 'true' ||
    searchParams.get('change_required') === 'true';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Criteria checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(e) {
    e.preventDefault();

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber) {
      toast.error('Password baru belum memenuhi semua kriteria keamanan.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Password berhasil diperbarui!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setLoading(false);
        // Navigasi PENUH agar cookie sesi baru dan seluruh layout dimuat ulang
        window.location.assign('/dashboard');
        return;
      } else {
        toast.error(json.error || 'Gagal memperbarui password');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft">
        <h1 className="text-xl font-black text-gray-900 font-title">Keamanan Akun</h1>
        <p className="text-xs text-gray-500 mt-1">
          Ubah kata sandi akun Anda secara berkala untuk menjaga keamanan data perusahaan.
        </p>
      </div>

      {mustChange && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Wajib Mengganti Password Awal</p>
            <p className="mt-0.5 text-amber-700">
              Akun Anda menggunakan password default awal. Demi keamanan data, Anda wajib membuat password baru yang kuat.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {/* Indomaret Bar */}
        <div className="indomaret-bar">
          <div className="indomaret-bar-blue" />
          <div className="indomaret-bar-yellow" />
          <div className="indomaret-bar-red" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Password Saat Ini <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Password Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter..."
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Strength Checklist */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/60 text-xs space-y-1.5">
            <p className="font-bold text-gray-600 mb-1">Kriteria Keamanan Password:</p>
            <div className="grid grid-cols-2 gap-2">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Minimal 8 karakter</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Huruf besar (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasLower ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Huruf kecil (a-z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Minimal 1 angka (0-9)</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Konfirmasi Password Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password baru..."
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0056b3] min-h-[44px]"
              />
            </div>
            {confirmPassword && !isMatch && (
              <p className="text-[11px] text-red-500 mt-1">Konfirmasi password tidak cocok.</p>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || !isMatch || !hasMinLength || !hasUpper || !hasLower || !hasNumber}
              className="px-6 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-all flex items-center gap-2 min-h-[44px] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Password...</span>
                </>
              ) : (
                <span>Perbarui Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
