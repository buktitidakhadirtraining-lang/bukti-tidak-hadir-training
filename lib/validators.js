// lib/validators.js
import { POSITIONS } from './config.js';

export function validateRecordPayload(data) {
  const errors = [];

  if (!data.branch_id) errors.push('Cabang wajib dipilih.');
  if (!data.training_id) errors.push('Modul training wajib dipilih.');
  if (!data.reason_id) errors.push('Alasan ketidakhadiran wajib dipilih.');
  if (!data.nik || data.nik.trim().length === 0) errors.push('NIK peserta wajib diisi.');
  if (!data.nama || data.nama.trim().length === 0) errors.push('Nama peserta wajib diisi.');
  if (!data.jabatan || !POSITIONS.includes(data.jabatan)) {
    errors.push('Jabatan peserta tidak valid atau tidak dipilih.');
  }
  if (!data.tanggal_training) errors.push('Tanggal training wajib diisi.');

  return {
    isValid: errors.length === 0,
    errors,
  };
}
