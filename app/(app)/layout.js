// app/(app)/layout.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Sidebar from '../../components/Sidebar.js';
import Navbar from '../../components/Navbar.js';
import { FOOTER_TEXT } from '../../lib/config.js';

export default function AppLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data) {
            setUser(json.data);
          } else {
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to load user session:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        toast.success('Berhasil keluar dari sistem');
        router.push('/login');
      } else {
        toast.error('Gagal keluar, silakan coba lagi');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7F6]">
        <div className="w-10 h-10 border-4 border-[#0056b3] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-600">Memuat data sesi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F6] flex flex-col">
      <Sidebar
        user={user}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        <Navbar
          user={user}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <footer className="py-4 px-6 text-center text-xs text-gray-500 border-t border-gray-200/80 bg-white no-print">
          <p>{FOOTER_TEXT}</p>
        </footer>
      </div>
    </div>
  );
}
