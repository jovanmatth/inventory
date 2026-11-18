import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_SUPABASE_URL = 'https://hiezrrvpkwsegeexgwsf.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZXpycnZwa3dzZWdlZXhnd3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NzM3NjcsImV4cCI6MjExMDU0OTc2N30.1sJcxsL7hkg_gIfIqJpnNlWoAMdYNRJTW1RkruxFOvY';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
