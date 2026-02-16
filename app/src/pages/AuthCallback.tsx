/**
 * Auth Callback Page
 * หน้า callback สำหรับ OAuth redirects
 */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export function AuthCallback() {
  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          window.location.href = '/';
          return;
        }

        if (data.session) {
          window.location.href = '/';
        } else {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Error handling auth callback:', error);
        window.location.href = '/';
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-gray-600">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
}
