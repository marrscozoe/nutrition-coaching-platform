import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy initialization to avoid build-time errors
let _supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[Supabase] Missing env vars - using placeholder client');
      _supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-anon-key');
    } else {
      _supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return _supabaseClient;
}

// For backwards compatibility - proxy object that delegates to lazy client
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabase();
    const value = client[prop as keyof SupabaseClient];
    // If it's a function, bind it to the client
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export default supabase;
