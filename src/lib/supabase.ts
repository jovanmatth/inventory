import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://hiezrrvpkwsegeexgwsf.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZXpycnZwa3dzZWdlZXhnd3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NzM3NjcsImV4cCI6MjExMDU0OTc2N30.1sJcxsL7hkg_gIfIqJpnNlWoAMdYNRJTW1RkruxFOvY';
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZXpycnZwa3dzZWdlZXhnd3NmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDk3Mzc2NywiZXhwIjoyMTEwNTQ5NzY3fQ.msifsCaVNeLJGczFmFK-3oaBizO_fMI6PzypEBtc7Zk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseUrl !== '' &&
    supabaseAnonKey &&
    supabaseAnonKey.trim() !== '' &&
    supabaseAnonKey !== 'your_supabase_anon_key_here'
  );
};

// Public client for browser / client components
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Admin / Server client with elevated service role privileges if available
export const supabaseAdmin: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
