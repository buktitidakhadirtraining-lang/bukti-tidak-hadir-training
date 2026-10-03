// lib/audit.js
import { getSupabaseAdmin } from './supabase.js';

/**
 * Mencatat aktivitas pengguna ke tabel audit_logs
 */
export async function auditLog({
  userId,
  action,
  entityType,
  entityId = null,
  details = {},
  ipAddress = '127.0.0.1',
}) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('audit_logs').insert([
      {
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        ip_address: ipAddress,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.error('Gagal mencatat audit log:', err?.message);
  }
}
