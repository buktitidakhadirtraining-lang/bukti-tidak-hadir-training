// app/(app)/admin/pengguna/page.js
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Users,
  PlusCircle,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Building,
} from 'lucide-react';
import ConfirmDialog from '../../../../components/ConfirmDialog.js';

export default function AdminPenggunaPage() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('admin_cabang');
  const [branchId, setBranchId] = useState('');
  const [initialPassword, setInitialPassword] = useState('Indomaret123!');
  const [resetPassword, setResetPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [unlockAccount, setUnlockAccount] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, user: null, loading: false });

  async function loadData() {
    setLoading(true);
    try {
      const [uRes, bRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/branches'),
      ]);
      const uJson = await uRes.json();
      const bJson = await bRes.json();
      if (uJson.ok) setUsers(uJson.data || []);
      if (bJson.ok) setBranches(bJson.data || []);
    } catch (e) {
      toast.error('Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setRole('admin_cabang');
    setBranchId(branches[0]?.id || '');
    setInitialPassword('Indomaret123!');
    setResetPassword('');
    setIsActive(true);
    setUnlockAccount(false);
    setIsModalOpen(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.full_name);
    setRole(user.role);
    setBranchId(user.branch_id || '');
    setResetPassword('');
    setIsActive(user.is_active);
    setUnlockAccount(false);
    setIsModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload = {
        username: username.trim().toLowerCase(),
        full_name: fullName.trim(),
        role,
        branch_id: role === 'admin_pusat' ? null : branchId,
        is_active: isActive,
      };

      if (!editingUser) {
        payload.initial_password = initialPassword.trim();
      } else {
        if (resetPassword.trim()) {
          payload.reset_password = resetPassword.trim();
        }
        if (unlockAccount) {
          payload.unlock_account = true;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(json.message);
        setIsModalOpen(false);
        loadData();
      } else {
        toast.error(json.error || 'Gagal menyimpan pengguna');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    const u = deleteDialog.user;
    if (!u) return;

    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Pengguna berhasil dihapus');
        setDeleteDialog({ isOpen: false, user: null, loading: false });
        loadData();
      } else {
        toast.error(json.error || 'Gagal menghapus pengguna');
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
            Master Pengguna & Hak Akses
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Kelola akun Admin Pusat dan Admin Cabang, hak akses cabang, serta reset password pengguna.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0056b3] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors min-h-[42px] shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tambah Pengguna Baru</span>
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
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Peran (Role)</th>
                  <th className="py-3 px-4">Cabang</th>
                  <th className="py-3 px-4 text-center">Status Akun</th>
                  <th className="py-3 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u, idx) => {
                  const isLocked = u.locked_until && new Date(u.locked_until) > new Date();
                  return (
                    <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4 text-center font-bold text-gray-400">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{u.username}</td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{u.full_name}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            u.role === 'admin_pusat'
                              ? 'bg-blue-100 text-[#0056b3]'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {u.role === 'admin_pusat' ? 'Admin Pusat' : 'Admin Cabang'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">
                        {u.role === 'admin_pusat' ? 'Nasional (Semua)' : u.branches?.name || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center space-x-1">
                        {isLocked ? (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Terkunci
                          </span>
                        ) : u.is_active ? (
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                            Nonaktif
                          </span>
                        )}
                        {u.must_change_password && (
                          <span className="text-[10px] text-amber-600 font-semibold" title="Perlu ganti password">
                            *
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-gray-500 hover:text-[#0056b3] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Pengguna"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteDialog({
                                isOpen: true,
                                user: u,
                                loading: false,
                              })
                            }
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah/Edit Pengguna */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="indomaret-bar">
              <div className="indomaret-bar-blue" />
              <div className="indomaret-bar-yellow" />
              <div className="indomaret-bar-red" />
            </div>

            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
              <h3 className="text-base font-bold text-gray-900 font-title">
                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUser)}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: admin.sby"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:bg-white disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama Lengkap Karyawan"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Peran (Role) *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold"
                >
                  <option value="admin_cabang">Admin Cabang</option>
                  <option value="admin_pusat">Admin Pusat</option>
                </select>
              </div>

              {role === 'admin_cabang' && (
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">
                    Penugasan Cabang *
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    required
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold"
                  >
                    <option value="">Pilih Cabang...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!editingUser ? (
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">
                    Password Awal
                  </label>
                  <input
                    type="text"
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Default: Indomaret123! (Pengguna akan dipaksa ganti password pada login pertama)
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block font-bold text-gray-700 uppercase mb-1">
                      Reset Password (Opsional)
                    </label>
                    <input
                      type="text"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Kosongkan jika tidak ingin mereset password..."
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                    />
                  </div>

                  {editingUser.locked_until && new Date(editingUser.locked_until) > new Date() && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 flex items-center justify-between">
                      <span className="text-red-700 font-semibold">Akun saat ini sedang terkunci</span>
                      <button
                        type="button"
                        onClick={() => setUnlockAccount(!unlockAccount)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          unlockAccount ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        {unlockAccount ? 'Akan Dibuka' : 'Buka Kunci'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-[#0056b3] rounded-sm focus:ring-[#0056b3]"
                />
                <label htmlFor="userActive" className="font-bold text-gray-700">
                  Akun Aktif
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
                  <span>Simpan Pengguna</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Hapus Pengguna"
        message={`Apakah Anda yakin ingin menghapus akun "${deleteDialog.user?.username}" (${deleteDialog.user?.full_name})?`}
        confirmText="Ya, Hapus Pengguna"
        cancelText="Batal"
        danger={true}
        isLoading={deleteDialog.loading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, user: null, loading: false })}
      />
    </div>
  );
}
