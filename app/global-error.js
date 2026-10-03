// app/global-error.js
'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="id">
      <body className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7F6] p-4 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Terjadi Kesalahan Sistem</h2>
        <p className="text-sm text-gray-600 mb-6 max-w-md">
          {error?.message || 'Sistem mengalami kendala tak terduga.'}
        </p>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-[#0056b3] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
        >
          Muat Ulang
        </button>
      </body>
    </html>
  );
}
