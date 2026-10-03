// lib/auth.js
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from './supabase.js';
import { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES } from './config.js';

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

/**
 * Cek apakah akun sedang terkunci karena terlalu banyak percobaan gagal
 */
export function isAccountLocked(user) {
  if (!user || !user.locked_until) return false;
  const lockedUntil = new Date(user.locked_until);
  return lockedUntil.getTime() > Date.now();
}

/**
 * Catat kegagalan login dan kunci akun jika mencapai batas maksimal
 */
export async function handleFailedLogin(userId, currentFailedCount = 0) {
  try {
    const supabase = getSupabaseAdmin();
    const newCount = (currentFailedCount || 0) + 1;
    const isLockedNow = newCount >= MAX_LOGIN_ATTEMPTS;
    
    let lockedUntil = null;
    if (isLockedNow) {
      lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
    }

    await supabase
      .from('users')
      .update({
        failed_login_count: isLockedNow ? 0 : newCount,
        locked_until: lockedUntil,
      })
      .eq('id', userId);

    return {
      locked: isLockedNow,
      remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - newCount),
    };
  } catch (err) {
    console.error('Failed to handle failed login counter:', err);
    return {
      locked: false,
      remainingAttempts: 0,
    };
  }
}

/**
 * Reset counter gagal login saat login berhasil
 */
export async function resetFailedLogin(userId) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('users')
      .update({
        failed_login_count: 0,
        locked_until: null,
      })
      .eq('id', userId);
  } catch (err) {
    console.error('Failed to reset login counter:', err);
  }
}
