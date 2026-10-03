// app/(app)/admin/training/page.js
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  GraduationCap,
  PlusCircle,
  Edit2,
  Trash2,
  Loader2,
  XCircle,
} from 'lucide-react';
import ConfirmDialog from '../../../../components/ConfirmDialog.js';

export default function AdminTrainingPage() {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, item: null, loading: false });

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trainings');
      const json = await res.json();
      if (json.ok) setTrainings(json.data || []);
    } catch (e) {
      toast.error('Gagal memuat data modul training');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingItem(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || '');
    setIsActive(item.is_active);
    setIsModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nama modul training wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const url = editingItem ? `/api/admin/trainings/${editingItem.id}` : '/api/admin/trainings';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(json.message);
        setIsModalOpen(false);
        loadData();
      } else {
        toast.error(json.error || 'Gagal menyimpan modul training');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    const item = deleteDialog.item;
    if (!item) return;

    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/trainings/${item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Modul training berhasil dihapus');
        setDeleteDialog({ isOpen: false, item: null, loading: false });
        loadData();
      } else {
        toast.error(json.error || 'Gagal menghapus');
        setDeleteDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (e) {
      toast.error('Terjadi kesalahan jaringan');
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 font-title tracking-tight">
            Master Jenis Training
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Daftar program dan kurikulum training operasional & manajerial Indomaret.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors min-h-[42px] shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tambah Jenis Training</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0056b3]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Training</th>
                  <th className="py-3 px-4">Deskripsi</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trainings.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4 text-center font-bold text-gray-400">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">{item.name}</td>
                    <td className="py-3.5 px-4 text-gray-600">{item.description || '-'}</td>
                    <td className="py-3.5 px-4 text-center">
                      {item.is_active ? (
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-gray-500 hover:text-[#0056b3] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ isOpen: true, item, loading: false })}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="indomaret-bar">
              <div className="indomaret-bar-blue" />
              <div className="indomaret-bar-yellow" />
              <div className="indomaret-bar-red" />
            </div>

            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 font-title">
                {editingItem ? 'Edit Modul Training' : 'Tambah Modul Training'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Nama Modul Training *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Service Excellence"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Deskripsi</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deskripsi singkat kurikulum..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="trainingActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-[#0056b3] rounded-sm focus:ring-[#0056b3]"
                />
                <label htmlFor="trainingActive" className="font-bold text-gray-700">
                  Status Aktif
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#0056b3] hover:bg-blue-700 font-bold text-white shadow-xs flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Hapus Modul Training"
        message={`Apakah Anda yakin ingin menghapus "${deleteDialog.item?.name}"?`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        danger={true}
        isLoading={deleteDialog.loading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, item: null, loading: false })}
      />
    </div>
  );
}
