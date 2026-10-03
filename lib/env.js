// lib/env.js
// Validasi environment variable di sisi server (Node.js) dengan fallback aman

let cachedEnv = null;

const DEFAULT_SESSION_SECRET = 'sistem_ketidakhadiran_training_session_secret_default_key_2026_xyz_auth_32';
const DEFAULT_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SESSION_SECRET,
    ENCRYPTION_KEY,
  } = process.env;

  const isSupabaseConfigured = Boolean(
    SUPABASE_URL &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_SERVICE_ROLE_KEY &&
    SUPABASE_SERVICE_ROLE_KEY.length >= 20
  );

  const finalSessionSecret = SESSION_SECRET && SESSION_SECRET.length >= 32
    ? SESSION_SECRET
    : DEFAULT_SESSION_SECRET;

  const finalEncryptionKey = ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)
    ? ENCRYPTION_KEY
    : DEFAULT_ENCRYPTION_KEY;

  cachedEnv = {
    SUPABASE_URL: isSupabaseConfigured ? SUPABASE_URL : null,
    SUPABASE_SERVICE_ROLE_KEY: isSupabaseConfigured ? SUPABASE_SERVICE_ROLE_KEY : null,
    SESSION_SECRET: finalSessionSecret,
    ENCRYPTION_KEY: finalEncryptionKey,
    isSupabaseConfigured,
  };

  return cachedEnv;
}
