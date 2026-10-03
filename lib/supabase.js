// lib/supabase.js
// Client Supabase untuk akses server-side dengan Service Role Key atau Mock Client fallback
import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env.js';
import { createMockSupabaseClient } from './mock-supabase.js';

let supabaseServerClient = null;

export function getSupabaseAdmin() {
  if (supabaseServerClient) {
    return supabaseServerClient;
  }

  const env = getEnv();

  if (!env.isSupabaseConfigured) {
    console.log('[AI Studio] Supabase belum dikonfigurasi, menggunakan simulasi database in-memory.');
    supabaseServerClient = createMockSupabaseClient();
    return supabaseServerClient;
  }

  try {
    supabaseServerClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    return supabaseServerClient;
  } catch (err) {
    console.warn('[AI Studio] Gagal inisialisasi Supabase client, beralih ke mock:', err.message);
    supabaseServerClient = createMockSupabaseClient();
    return supabaseServerClient;
  }
}
