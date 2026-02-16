/**
 * Auth Callback Page
 * หน้า callback สำหรับ OAuth redirects
 */
import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export function AuthCallback() {
  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await getSupabase().auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          window.location.href = '/';
          return;
        }

        if (data.session?.user) {
          // Clear email signup tracking เมื่อ user ยืนยันอีเมลสำเร็จแล้ว
          if (data.session.user.email_confirmed_at) {
            try {
              const EMAIL_SIGNUP_TRACKING_KEY = 'email_signup_tracking';
              const stored = localStorage.getItem(EMAIL_SIGNUP_TRACKING_KEY);
              if (stored) {
                const tracking: Record<string, any> = JSON.parse(stored);
                const email = data.session.user.email?.toLowerCase();
                if (email && tracking[email]) {
                  delete tracking[email];
                  localStorage.setItem(EMAIL_SIGNUP_TRACKING_KEY, JSON.stringify(tracking));
                  console.log('Cleared email signup tracking for:', email);
                }
              }
            } catch (e) {
              console.error('Error clearing email signup tracking:', e);
            }
          }
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
