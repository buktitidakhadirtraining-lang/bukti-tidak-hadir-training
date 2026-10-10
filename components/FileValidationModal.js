'use client';
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function FileValidationModal({ isOpen, onClose, errors }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertTriangle className="w-8 h-8" />
          <h2 className="text-lg font-black font-title uppercase tracking-tight">Format File Tidak Sesuai</h2>
        </div>
        
        <div className="text-sm text-gray-700 space-y-3 mb-6">
            <p>File berikut tidak dapat diunggah:</p>
            <ul className="list-disc pl-5 space-y-1">
                {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
            <p className="font-semibold">Format yang diperbolehkan hanya JPG, JPEG, dan PNG. Silakan ubah atau konversi file Anda terlebih dahulu.</p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}
