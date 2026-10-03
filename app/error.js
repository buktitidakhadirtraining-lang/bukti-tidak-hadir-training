// app/error.js
'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7F6] p-4 text-center">
      <h2 className="text-2xl font-bold text-red-600 mb-2">Terjadi Kesalahan</h2>
      <p className="text-sm text-gray-600 mb-6 max-w-md">
        {error?.message || 'Terjadi kesalahan sistem saat memproses halaman ini.'}
      </p>
      <button
        onClick={() => reset()}
        className="px-5 py-2.5 bg-[#0056b3] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
      >
        Coba Lagi
      </button>
    </div>
  );
}
