import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _db: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!_db) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _db = createClient(url, key, { auth: { persistSession: false } });
  }
  return _db;
}

// Convenience proxy — only resolves the client at call time, never at import time
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getDb();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
