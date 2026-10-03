// components/EmptyState.js
'use client';

import { FolderOpen } from 'lucide-react';

export default function EmptyState({
  title = 'Tidak Ada Data',
  message = 'Belum ada catatan yang ditemukan untuk kriteria ini.',
  action = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-gray-100 shadow-sm my-4">
      <div className="p-4 bg-gray-50 text-gray-400 rounded-2xl mb-4">
        <FolderOpen className="w-10 h-10" />
      </div>
      <h3 className="text-base font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{message}</p>
      {action}
    </div>
  );
}
