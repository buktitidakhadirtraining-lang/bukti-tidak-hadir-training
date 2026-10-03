// lib/session.js
// Pengelolaan sesi JWT dengan library 'jose' (kompatibel Node.js dan Edge Runtime)
import { SignJWT, jwtVerify } from 'jose';
import { SESSION_DURATION_SECONDS } from './config.js';

export const COOKIE_NAME = 'auth_token';

/**
 * Mendapatkan Secret Key dalam bentuk Uint8Array untuk jose
 */
function getJwtSecret() {
  const secret = process.env.SESSION_SECRET || 'sistem_ketidakhadiran_training_session_secret_default_key_2026_xyz_auth_32';
  return new TextEncoder().encode(secret);
}

/**
 * Membuat token JWT sesi pengguna
 */
export async function createSessionToken(payload) {
  const secret = getJwtSecret();
  const token = await new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    branchId: payload.branchId || null,
    mustChangePassword: Boolean(payload.mustChangePassword),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret);

  return token;
}

/**
 * Memverifikasi token JWT sesi pengguna (kompatibel Edge runtime)
 */
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Membaca token dari cookie request (Edge Request atau NextRequest)
 */
export function getTokenFromRequest(request) {
  if (!request) return null;
  // Jika NextRequest dengan request.cookies.get
  if (request.cookies && typeof request.cookies.get === 'function') {
    const cookie = request.cookies.get(COOKIE_NAME);
    return cookie ? cookie.value : null;
  }
  // Jika standard Request dengan header cookie
  const cookieHeader = request.headers?.get?.('cookie') || request.headers?.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    const [key, ...v] = c.split('=');
    if (key === COOKIE_NAME) {
      return decodeURIComponent(v.join('='));
    }
  }
  return null;
}

/**
 * Mengambil dan memverifikasi sesi pengguna yang sedang login.
 * - Jika 'request' diberikan: token dibaca dari request tersebut.
 * - Jika tanpa argumen: token dibaca dari cookie konteks request Next.js.
 * Mengembalikan payload sesi (userId, username, role, branchId, mustChangePassword)
 * atau null jika belum login / token tidak valid.
 */
export async function getSessionFromRequest(request) {
  let token = null;
  if (request) {
    token = getTokenFromRequest(request);
  } else {
    // Import dinamis agar file ini tetap aman dipakai di middleware (Edge)
    const { cookies } = await import('next/headers');
    const store = await cookies();
    token = store.get(COOKIE_NAME)?.value || null;
  }
  return verifySessionToken(token);
}

/**
 * Konfigurasi opsi cookie HTTP-Only untuk sesi login
 */
export function getSessionCookieOptions(maxAgeSeconds = SESSION_DURATION_SECONDS) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}