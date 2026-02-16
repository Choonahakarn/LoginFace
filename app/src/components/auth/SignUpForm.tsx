/**
 * Sign Up Form Component
 * รองรับ Email/Password และ Social Login
 */
import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, User, Loader2, Clock } from 'lucide-react';

interface SignUpFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function SignUpForm({ onSuccess, onSwitchToLogin }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // ป้องกัน double submit
    if (loading || rateLimitCooldown !== null) {
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting sign up with email:', email);
      
      // ลองใช้ email ที่ clean ก่อน (trim whitespace)
      const cleanEmail = email.trim().toLowerCase();
      
      // เพิ่ม timeout เพื่อป้องกันการค้าง
      const signUpPromise = getSupabase().auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            first_name: firstName || '',
            last_name: lastName || '',
          },
          // ไม่ใส่ emailRedirectTo เพื่อไม่ให้ Supabase พยายามส่ง email
          // ถ้า email verification ปิดอยู่ Supabase จะไม่ส่ง email อัตโนมัติ
        },
      });

      // เพิ่ม timeout 10 วินาที
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Signup timeout - please try again')), 10000);
      });

      const { data, error } = await Promise.race([signUpPromise, timeoutPromise]) as any;

      if (error) {
        console.error('Sign up error details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
          error: error,
        });
        throw error;
      }

      // ตรวจสอบ duplicate email: Supabase อาจ return user โดยไม่มี error แต่ identities ว่าง
      const identities = (data?.user as any)?.identities ?? [];
      if (data?.user && identities.length === 0) {
        toast.error('อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบแทน', { duration: 5000 });
        setTimeout(() => onSwitchToLogin?.(), 2000);
        setLoading(false);
        return;
      }

      console.log('Sign up successful:', data);
      
      // ตรวจสอบว่าต้องยืนยันอีเมลหรือไม่
      if (data.user && !data.session) {
        // ถ้ายังต้องยืนยันอีเมล (email verification เปิดอยู่)
        toast.success('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี');
        setTimeout(() => {
          setLoading(false);
          onSwitchToLogin?.();
        }, 1000);
      } else if (data.user && data.session) {
        // ถ้าไม่ต้องยืนยันอีเมล (email verification ปิดอยู่) - login ทันที
        toast.success('สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...');
        setLoading(false);
        setTimeout(() => {
          onSuccess?.();
          // ใช้ window.location.href แทน reload เพื่อให้แน่ใจว่า navigate
          window.location.href = window.location.origin;
        }, 300);
      } else {
        // Fallback
        toast.success('สมัครสมาชิกสำเร็จ!');
        setLoading(false);
        setTimeout(() => {
          onSuccess?.();
          // ใช้ window.location.href แทน reload เพื่อให้แน่ใจว่า navigate
          window.location.href = window.location.origin;
        }, 300);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // ใช้ error.code เป็นหลัก (แนะนำโดย Supabase) รองรับ error.message สำหรับ legacy
      let errorMessage = 'สมัครสมาชิกล้มเหลว';
      const code = error?.code ?? '';
      const msg = error?.message ?? '';
      
      if (code === 'user_already_exists' || code === 'email_exists' || 
          (msg && (msg.includes('User already registered') || msg.includes('already registered'))) ||
          error?.status === 422) {
        errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบแทน';
        setTimeout(() => onSwitchToLogin?.(), 2000);
      } else if (code === 'weak_password' || (msg && msg.includes('Password'))) {
        errorMessage = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และตรงตามเงื่อนไขความปลอดภัย';
      } else if (code === 'over_request_rate_limit' || error?.status === 429 || msg.includes('rate limit')) {
        errorMessage = 'ส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง (ประมาณ 1-2 นาที)';
      } else if (code === 'email_address_invalid' || (msg && msg.includes('invalid') && msg.includes('email'))) {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง กรุณาใช้อีเมลที่ถูกต้อง';
      } else if (msg?.includes('timeout')) {
        errorMessage = 'การสมัครสมาชิกใช้เวลานานเกินไป กรุณาลองอีกครั้ง';
      } else if (msg?.includes('Error sending confirmation email')) {
        errorMessage = 'เกิดข้อผิดพลาดในการส่งอีเมล กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
      } else if (msg) {
        errorMessage = msg;
      }
      
      if (code === 'over_request_rate_limit' || error?.status === 429 || msg.includes('rate limit')) {
        setRateLimitCooldown(120);
        toast.error(errorMessage, { duration: 8000 });
      } else if (code === 'user_already_exists' || code === 'email_exists' || msg?.includes('already registered')) {
        toast.error(errorMessage, { duration: 6000 });
      } else {
        toast.error(errorMessage, { duration: 6000 });
      }
    } finally {
      // สำคัญ: ต้อง set loading = false เสมอ
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'line') => {
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error(`${provider} sign up error:`, error);
      toast.error(`สมัครสมาชิกด้วย ${provider} ล้มเหลว`);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">สมัครสมาชิก</h1>
        <p className="text-gray-600 mt-2">สร้างบัญชีใหม่เพื่อเริ่มใช้งาน</p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">ชื่อ</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="firstName"
                type="text"
                placeholder="ชื่อ"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">นามสกุล</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="นามสกุล"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

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
              minLength={6}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
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
              กำลังสมัครสมาชิก...
            </>
          ) : rateLimitCooldown !== null ? (
            <>
              <Clock className="mr-2 h-4 w-4" />
              กรุณารอ {Math.floor(rateLimitCooldown / 60)}:{(rateLimitCooldown % 60).toString().padStart(2, '0')}
            </>
          ) : (
            'สมัครสมาชิก'
          )}
        </Button>
        
        {rateLimitCooldown !== null && (
          <p className="text-sm text-center text-amber-600 mt-2">
            ⚠️ ส่งคำขอมากเกินไป กรุณารอสักครู่
          </p>
        )}
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
          สมัครสมาชิกด้วย Line
        </Button>
      </div>

      <div className="text-center text-sm">
        <span className="text-gray-600">มีบัญชีอยู่แล้ว? </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-blue-600 hover:underline font-medium"
        >
          เข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}
