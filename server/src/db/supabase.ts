import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error(
        'Missing Supabase credentials: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env'
      );
    }
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}