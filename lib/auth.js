// lib/auth.js
import bcrypt from 'bcryptjs';

/**
 * Hash password menggunakan bcryptjs dengan salt round 10
 */
export async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password tidak boleh kosong.');
  }
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Bandingkan plaintext password dengan hash tersimpan
 */
export async function comparePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Validasi kekuatan kata sandi: minimal 8 karakter, huruf besar, huruf kecil, dan angka
 */
export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Kata sandi wajib diisi.' };
  }
  if (password.length < 8) {
    return { isValid: false, message: 'Kata sandi minimal 8 karakter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Kata sandi harus mengandung minimal 1 huruf besar (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Kata sandi harus mengandung minimal 1 huruf kecil (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Kata sandi harus mengandung minimal 1 angka (0-9).' };
  }
  return { isValid: true, message: 'Kata sandi memenuhi syarat keamanan.' };
}
