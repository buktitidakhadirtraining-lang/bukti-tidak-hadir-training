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
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import ConfirmDialog from '../../../../components/ConfirmDialog.js';
import { notifyTrainingTypesChanged, sortTrainings } from '../../../../lib/useMasterTrainings.js';

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

  // Cascade Rename Confirmation State
  const [cascadeDialog, setCascadeDialog] = useState({
    isOpen: false,
    item: null,
    oldName: '',
    newName: '',
    description: '',
    isActive: true,
    countAbsence: 0,
    countTambahan: 0,
    totalCount: 0,
    loading: false,
  });

  // Delete State
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, item: null, loading: false });

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trainings');
      const json = await res.json();
      if (json.ok) {
        setTrainings(sortTrainings(json.data || []));
      }
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

  async function executeDirectSave(payloadName, payloadDesc, payloadActive) {
    const url = editingItem ? `/api/admin/trainings/${editingItem.id}` : '/api/admin/trainings';
    const method = editingItem ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payloadName,
        description: payloadDesc,
        is_active: payloadActive,
      }),
    });

    const json = await res.json();
    if (res.ok && json.ok) {
      notifyTrainingTypesChanged();
      toast.success('Perubahan tersimpan. Pilihan Jenis Training di semua menu diperbarui otomatis.');
      setIsModalOpen(false);
      loadData();
    } else {
      toast.error(json.error || 'Gagal menyimpan modul training');
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error('Nama modul training wajib diisi');
      return;
    }

    setSaving(true);
    try {
      // Jika sedang mengedit dan nama berubah, periksa apakah nama lama dipakai di Input Data / Input Data Tambahan
      if (editingItem && editingItem.name.trim().toLowerCase() !== cleanName.toLowerCase()) {
        const checkRes = await fetch(
          `/api/admin/trainings/check-usage?id=${editingItem.id}&name=${encodeURIComponent(
            editingItem.name.trim()
          )}`
        );
        const checkJson = await checkRes.json();

        if (checkJson.ok && checkJson.totalCount > 0) {
          // Ada data yang memakai nama lama -> tampilkan dialog konfirmasi cascade
          setCascadeDialog({
            isOpen: true,
            item: editingItem,
            oldName: editingItem.name.trim(),
            newName: cleanName,
            description: description.trim() || null,
            isActive,
            countAbsence: checkJson.countAbsence,
            countTambahan: checkJson.countTambahan,
            totalCount: checkJson.totalCount,
            loading: false,
          });
          setSaving(false);
          return;
        }
      }

      await executeDirectSave(cleanName, description.trim() || null, isActive);
    } catch (e) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setSaving(false);
    }
  }

  // Menjalankan cascade update ke seluruh tabel
  async function handleCascadeConfirm(updateLegacy = true) {
    setCascadeDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/admin/trainings/cascade-rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cascadeDialog.item.id,
          oldName: cascadeDialog.oldName,
          newName: cascadeDialog.newName,
          updateLegacy,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        // Update deskripsi dan status jika ada
        if (
          cascadeDialog.description !== cascadeDialog.item.description ||
          cascadeDialog.isActive !== cascadeDialog.item.is_active
        ) {
          await fetch(`/api/admin/trainings/${cascadeDialog.item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: cascadeDialog.newName,
              description: cascadeDialog.description,
              is_active: cascadeDialog.isActive,
            }),
          });
        }

        notifyTrainingTypesChanged();
        toast.success(
          updateLegacy
            ? `Perubahan tersimpan. Nama baru diperbarui pada ${json.summary?.total_updated || 0} data di semua menu.`
            : 'Perubahan tersimpan. Pilihan Jenis Training di semua menu diperbarui otomatis.'
        );
        setCascadeDialog({ isOpen: false, item: null, loading: false });
        setIsModalOpen(false);
        loadData();
      } else {
        toast.error(json.error || 'Gagal memperbarui data');
        setCascadeDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan');
      setCascadeDialog((prev) => ({ ...prev, loading: false }));
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
        notifyTrainingTypesChanged();
        toast.success('Modul training berhasil dihapus. Pilihan di semua menu diperbarui.');
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

      {/* Dialog Konfirmasi Pembaruan Nama Lama (Cascade Update) */}
      {cascadeDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
            <div className="indomaret-bar">
              <div className="indomaret-bar-blue" />
              <div className="indomaret-bar-yellow" />
              <div className="indomaret-bar-red" />
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-title">
                    Perbarui Data yang Sudah Tersimpan?
                  </h3>
                  <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                    Nama lama <strong className="text-gray-900">&quot;{cascadeDialog.oldName}&quot;</strong> dipakai oleh{' '}
                    <strong className="text-[#0056b3]">{cascadeDialog.countAbsence} data</strong> di Input Data dan{' '}
                    <strong className="text-[#0056b3]">{cascadeDialog.countTambahan} data</strong> di Input Data Tambahan (semua cabang).
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Apakah Anda ingin memperbarui seluruh data lama tersebut ke nama baru{' '}
                    <strong className="text-emerald-700">&quot;{cascadeDialog.newName}&quot;</strong>?
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 space-y-1">
                <p>
                  &bull; <strong>Perbarui Semua:</strong> Mengganti nama di Master sekaligus memperbarui teks nama & ID pada seluruh data ketidakhadiran di semua cabang secara otomatis.
                </p>
                <p>
                  &bull; <strong>Lewati:</strong> Hanya mengubah nama di Master untuk input ke depan, data lama tetap memakai nama sebelumnya.
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  disabled={cascadeDialog.loading}
                  onClick={() => setCascadeDialog({ isOpen: false, item: null, loading: false })}
                  className="px-3.5 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={cascadeDialog.loading}
                  onClick={() => handleCascadeConfirm(false)}
                  className="px-4 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#0056b3] rounded-xl font-bold transition-colors"
                >
                  Lewati
                </button>
                <button
                  type="button"
                  disabled={cascadeDialog.loading}
                  onClick={() => handleCascadeConfirm(true)}
                  className="px-5 py-2 bg-[#0056b3] hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {cascadeDialog.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memperbarui Semua Data...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Perbarui Semua</span>
                    </>
                  )}
                </button>
              </div>
            </div>
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
