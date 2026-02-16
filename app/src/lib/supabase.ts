/**
 * Supabase Client Configuration
 * สำหรับเชื่อมต่อกับ Supabase Database และ Authentication
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Debug: แสดง environment variables ใน console (development only)
if (import.meta.env.DEV) {
  console.log('Supabase URL:', supabaseUrl || 'MISSING');
  console.log('Supabase Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');
}

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (or app/.env).'
  );
}

let _client: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/** Supabase client — จะเป็น null ถ้ายังไม่ได้ตั้งค่า env บน Vercel/ใน .env */
export const supabase = _client;

/** ใช้เมื่อรู้ว่า env ตั้งแล้ว (เช่น ภายในแอปหลังเช็ค isSupabaseConfigured) */
export function getSupabase(): NonNullable<typeof _client> {
  if (!_client) throw new Error('Supabase not configured');
  return _client;
}
