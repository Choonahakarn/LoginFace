/**
 * Supabase Client Configuration
 * สำหรับเชื่อมต่อกับ Supabase Database และ Authentication
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug: แสดง environment variables ใน console (development only)
if (import.meta.env.DEV) {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');
}

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing Supabase environment variables!
  
Please check:
1. File app/.env exists
2. VITE_SUPABASE_URL is set
3. VITE_SUPABASE_ANON_KEY is set
4. Restart dev server after creating/editing .env file

Current values:
- VITE_SUPABASE_URL: ${supabaseUrl || 'MISSING'}
- VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'MISSING'}
`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
