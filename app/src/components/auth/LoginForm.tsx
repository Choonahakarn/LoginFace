/**
 * Login Form Component
 * รองรับ Email/Password และ Social Login (Line)
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, Clock } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignUp?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignUp }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number | null>(null);

  // Countdown timer สำหรับ rate limit
  useEffect(() => {
    if (rateLimitCooldown === null) return;

    const interval = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitCooldown]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ป้องกัน double submit
    if (loading || rateLimitCooldown !== null) {
      return;
    }
    
    setLoading(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error('รูปแบบอีเมลไม่ถูกต้อง');
        setLoading(false);
        return;
      }

      console.log('Attempting login with email:', email);
      
      // ลองใช้ email ที่ clean ก่อน (trim whitespace)
      const cleanEmail = email.trim().toLowerCase();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        console.error('Login error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          error: error,
        });
        throw error;
      }

      console.log('Login successful:', data);
      toast.success('เข้าสู่ระบบสำเร็จ');
      
      // รอสักครู่เพื่อให้ session ถูกตั้งค่า
      setLoading(false);
      setTimeout(() => {
        onSuccess?.();
        // ใช้ window.location.href แทน reload เพื่อให้แน่ใจว่า navigate
        window.location.href = window.location.origin;
      }, 300);
    } catch (error: any) {
      console.error('Login error:', error);
      
      // ใช้ error.code เป็นหลัก (แนะนำโดย Supabase) รองรับ error.message สำหรับ legacy
      let errorMessage = 'เข้าสู่ระบบล้มเหลว';
      const code = error?.code ?? '';
      const msg = error?.message ?? '';
      
      if (code === 'invalid_credentials' || (msg && (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials') || (msg.toLowerCase().includes('invalid') && msg.toLowerCase().includes('credential'))))) {
        errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง — กรุณาตรวจสอบว่าอีเมลและรหัสผ่านที่ใส่ถูกต้อง';
      } else if (code === 'email_not_confirmed' || (msg && msg.includes('Email not confirmed'))) {
        errorMessage = 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ';
      } else if (code === 'user_banned' || (msg && msg.includes('banned'))) {
        errorMessage = 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
      } else if (code === 'over_request_rate_limit' || error?.status === 429 || msg.includes('rate limit')) {
        errorMessage = 'ส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง (ประมาณ 1-2 นาที)';
      } else if (code === 'email_address_invalid' || (msg && msg.includes('invalid') && msg.includes('email'))) {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error?.status === 400) {
        // Login ล้มเหลวส่วนใหญ่มักเป็น invalid credentials
        errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง — กรุณาตรวจสอบว่าอีเมลและรหัสผ่านที่ใส่ถูกต้อง';
      } else if (msg) {
        errorMessage = msg;
      }
      
      if (code === 'over_request_rate_limit' || error?.status === 429 || msg.includes('rate limit')) {
        // ตั้ง cooldown 120 วินาที (2 นาที)
        setRateLimitCooldown(120);
        toast.error(errorMessage, {
          duration: 8000,
        });
      } else {
        toast.error(errorMessage, { duration: 5000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'line') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error(`${provider} login error:`, error);
      toast.error(`เข้าสู่ระบบด้วย ${provider} ล้มเหลว`);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="text-gray-600 mt-2">ระบบเช็คชื่อนักเรียนด้วยใบหน้า</p>
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">อีเมล</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">รหัสผ่าน</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-10"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={loading || rateLimitCooldown !== null}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              กำลังเข้าสู่ระบบ...
            </>
          ) : rateLimitCooldown !== null ? (
            <>
              <Clock className="mr-2 h-4 w-4" />
              กรุณารอ {Math.floor(rateLimitCooldown / 60)}:{(rateLimitCooldown % 60).toString().padStart(2, '0')}
            </>
          ) : (
            'เข้าสู่ระบบ'
          )}
        </Button>
        
        {rateLimitCooldown !== null && (
          <p className="text-sm text-center text-amber-600 mt-2">
            ⚠️ ส่งคำขอมากเกินไป กรุณารอสักครู่
          </p>
        )}

        <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100 text-center text-sm text-gray-700">
          <p className="font-medium text-blue-800 mb-1">ทดสอบระบบ</p>
          <p>Login: <code className="bg-blue-100 px-1 rounded">teacher@school.edu</code></p>
          <p>Password: <code className="bg-blue-100 px-1 rounded">password</code></p>
          <p className="text-xs text-gray-500 mt-2">สามารถใช้บัญชีนี้เพื่อทดสอบระบบได้</p>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">หรือ</span>
        </div>
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleSocialLogin('line')}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.028 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
          เข้าสู่ระบบด้วย Line
        </Button>
      </div>

      <div className="text-center text-sm">
        <span className="text-gray-600">ยังไม่มีบัญชี? </span>
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-blue-600 hover:underline font-medium"
        >
          สมัครสมาชิก
        </button>
      </div>
    </div>
  );
}
