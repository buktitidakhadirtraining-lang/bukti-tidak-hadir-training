// lib/env.js
// Validasi environment variable di sisi server (Node.js) dengan fallback aman
// Mendukung semua variasi penamaan variabel Supabase (Vercel & Supabase Dashboard)

let cachedEnv = null;

const DEFAULT_SESSION_SECRET = 'sistem_ketidakhadiran_training_session_secret_default_key_2026_xyz_auth_32';
const DEFAULT_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    null;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    null;

  const sessionSecret = process.env.SESSION_SECRET;
  const encryptionKey = process.env.ENCRYPTION_KEY;

  const isSupabaseConfigured = Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('http') &&
    supabaseKey &&
    supabaseKey.length >= 20
  );

  const finalSessionSecret = sessionSecret && sessionSecret.length >= 32
    ? sessionSecret
    : DEFAULT_SESSION_SECRET;

  const finalEncryptionKey = encryptionKey && /^[0-9a-fA-F]{64}$/.test(encryptionKey)
    ? encryptionKey
    : DEFAULT_ENCRYPTION_KEY;

  cachedEnv = {
    SUPABASE_URL: isSupabaseConfigured ? supabaseUrl : null,
    SUPABASE_SERVICE_ROLE_KEY: isSupabaseConfigured ? supabaseKey : null,
    SESSION_SECRET: finalSessionSecret,
    ENCRYPTION_KEY: finalEncryptionKey,
    isSupabaseConfigured,
  };

  return cachedEnv;
}
