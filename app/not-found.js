// app/not-found.js
import Link from 'next/link';
import { LOGO_URL } from '../lib/config.js';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7F6] p-4 text-center">
      <img src={LOGO_URL} alt="Logo" className="h-14 mb-4 object-contain" />
      <h1 className="text-4xl font-extrabold text-[#0056b3] mb-2">404</h1>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Halaman Tidak Ditemukan</h2>
      <p className="text-sm text-gray-600 max-w-md mb-6">
        Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 bg-[#0056b3] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
