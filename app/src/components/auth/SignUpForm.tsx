/**
 * Sign Up Form Component
 * รองรับ Email/Password และ Social Login
 */
import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Mail, Lock, User, Loader2, Clock, CheckCircle } from 'lucide-react';

interface SignUpFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

// Storage key สำหรับเก็บจำนวนครั้งที่พยายามสมัคร
const SIGNUP_ATTEMPTS_KEY = 'signup_attempts';
const SIGNUP_COOLDOWN_UNTIL_KEY = 'signup_cooldown_until';
const EMAIL_SIGNUP_TRACKING_KEY = 'email_signup_tracking'; // Track การสมัครด้วยอีเมลเดียวกัน

interface EmailSignupTracking {
  email: string;
  attempts: number;
  lastAttempt: number;
  cooldownUntil?: number;
}

// ฟังก์ชันสำหรับจัดการ email signup tracking
function getEmailSignupTracking(email: string): EmailSignupTracking | null {
  try {
    const stored = localStorage.getItem(EMAIL_SIGNUP_TRACKING_KEY);
    if (!stored) return null;
    const tracking: Record<string, EmailSignupTracking> = JSON.parse(stored);
    return tracking[email.toLowerCase()] || null;
  } catch {
    return null;
  }
}

function setEmailSignupTracking(email: string, tracking: EmailSignupTracking): void {
  try {
    const stored = localStorage.getItem(EMAIL_SIGNUP_TRACKING_KEY);
    const allTracking: Record<string, EmailSignupTracking> = stored ? JSON.parse(stored) : {};
    allTracking[email.toLowerCase()] = tracking;
    localStorage.setItem(EMAIL_SIGNUP_TRACKING_KEY, JSON.stringify(allTracking));
  } catch (e) {
    console.error('Error saving email signup tracking:', e);
  }
}

function clearEmailSignupTracking(email: string): void {
  try {
    const stored = localStorage.getItem(EMAIL_SIGNUP_TRACKING_KEY);
    if (!stored) return;
    const allTracking: Record<string, EmailSignupTracking> = JSON.parse(stored);
    delete allTracking[email.toLowerCase()];
    localStorage.setItem(EMAIL_SIGNUP_TRACKING_KEY, JSON.stringify(allTracking));
  } catch (e) {
    console.error('Error clearing email signup tracking:', e);
  }
}

export function SignUpForm({ onSuccess, onSwitchToLogin }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number | null>(null);
  const [showResendEmail, setShowResendEmail] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [signupAttempts, setSignupAttempts] = useState(0);

  // โหลดจำนวนครั้งที่พยายามสมัครจาก localStorage
  useEffect(() => {
    try {
      const storedAttempts = localStorage.getItem(SIGNUP_ATTEMPTS_KEY);
      const storedCooldownUntil = localStorage.getItem(SIGNUP_COOLDOWN_UNTIL_KEY);
      
      if (storedCooldownUntil) {
        const cooldownUntil = parseInt(storedCooldownUntil, 10);
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
        
        if (remaining > 0) {
          setRateLimitCooldown(remaining);
        } else {
          // Cooldown หมดแล้ว - reset attempts
          localStorage.removeItem(SIGNUP_ATTEMPTS_KEY);
          localStorage.removeItem(SIGNUP_COOLDOWN_UNTIL_KEY);
          setSignupAttempts(0);
        }
      } else if (storedAttempts) {
        setSignupAttempts(parseInt(storedAttempts, 10));
      }
    } catch (e) {
      console.error('Error loading signup attempts:', e);
    }
  }, []);

  // Countdown timer สำหรับ rate limit
  useEffect(() => {
    if (rateLimitCooldown === null) return;

    const interval = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev === null || prev <= 1) {
          // Cooldown หมดแล้ว - reset attempts
          try {
            localStorage.removeItem(SIGNUP_ATTEMPTS_KEY);
            localStorage.removeItem(SIGNUP_COOLDOWN_UNTIL_KEY);
          } catch (e) {
            console.error('Error clearing signup attempts:', e);
          }
          setSignupAttempts(0);
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
    if (loading) {
      return;
    }

    // ตรวจสอบ cooldown จากจำนวนครั้งที่พยายามสมัคร
    if (rateLimitCooldown !== null && rateLimitCooldown > 0) {
      toast.warning(`กรุณารอ ${Math.floor(rateLimitCooldown / 60)}:${(rateLimitCooldown % 60).toString().padStart(2, '0')} ก่อนสมัครอีกครั้ง`, { duration: 5000 });
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

    // ตรวจสอบการ spam ด้วยอีเมลเดียวกัน
    const cleanEmail = email.trim().toLowerCase();
    const emailTracking = getEmailSignupTracking(cleanEmail);
    const MAX_EMAIL_ATTEMPTS = 5;
    const EMAIL_COOLDOWN_SECONDS = 300; // 5 นาที

    if (emailTracking) {
      // ตรวจสอบ cooldown
      if (emailTracking.cooldownUntil && emailTracking.cooldownUntil > Date.now()) {
        const remaining = Math.ceil((emailTracking.cooldownUntil - Date.now()) / 1000);
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        toast.error(`⚠️ คุณได้สมัครด้วยอีเมลนี้ ${emailTracking.attempts} ครั้งแล้ว กรุณารอ ${minutes}:${seconds.toString().padStart(2, '0')} ก่อนลองอีกครั้ง`, { duration: 10000 });
        toast.warning('💡 กรุณาตรวจสอบอีเมลยืนยันที่ส่งไปก่อนหน้านี้ หรือรอให้ cooldown หมดก่อน', { duration: 12000 });
        setRateLimitCooldown(remaining);
        return;
      }

      // ตรวจสอบจำนวนครั้ง
      if (emailTracking.attempts >= MAX_EMAIL_ATTEMPTS) {
        // ตั้ง cooldown 5 นาที
        const cooldownUntil = Date.now() + (EMAIL_COOLDOWN_SECONDS * 1000);
        setEmailSignupTracking(cleanEmail, {
          ...emailTracking,
          cooldownUntil,
        });
        setRateLimitCooldown(EMAIL_COOLDOWN_SECONDS);
        toast.error(`⚠️ คุณได้สมัครด้วยอีเมลนี้ ${emailTracking.attempts} ครั้งแล้ว กรุณารอ 5 นาทีก่อนลองอีกครั้ง`, { duration: 10000 });
        toast.warning('💡 กรุณาตรวจสอบอีเมลยืนยันที่ส่งไปก่อนหน้านี้', { duration: 12000 });
        return;
      }
    }

    setLoading(true);

    try {
      console.log('Attempting sign up with email:', email);
      
      // ลองใช้ email ที่ clean ก่อน (trim whitespace)
      const cleanEmail = email.trim().toLowerCase();
      
      // อัปเดต email tracking ก่อนสมัคร
      const currentTracking = getEmailSignupTracking(cleanEmail);
      const newEmailAttempts = (currentTracking?.attempts || 0) + 1;
      setEmailSignupTracking(cleanEmail, {
        email: cleanEmail,
        attempts: newEmailAttempts,
        lastAttempt: Date.now(),
      });
      
      // เพิ่ม timeout เพื่อป้องกันการค้าง
      const signUpPromise = getSupabase().auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            first_name: firstName || '',
            last_name: lastName || '',
          },
          // บังคับให้ยืนยันอีเมลก่อนใช้งาน
          emailRedirectTo: `${window.location.origin}/auth/callback`,
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
        
        // ตรวจสอบ error ที่เกี่ยวข้องกับการส่งอีเมล
        const errorMsg = error.message?.toLowerCase() || '';
        if (errorMsg.includes('email') && (errorMsg.includes('send') || errorMsg.includes('smtp') || errorMsg.includes('mail'))) {
          toast.error('เกิดข้อผิดพลาดในการส่งอีเมล กรุณาตรวจสอบ SMTP Settings ใน Supabase Dashboard', { duration: 10000 });
          toast.warning('ตรวจสอบ: 1) SMTP credentials ถูกต้อง 2) Sender email ถูก verify แล้ว 3) Rate limit ไม่เกิน', { duration: 12000 });
        }
        
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
      console.log('User email_confirmed:', data?.user?.email_confirmed_at);
      console.log('Has session:', !!data?.session);
      
      // Reset signup attempts เมื่อสมัครสำเร็จ
      try {
        localStorage.removeItem(SIGNUP_ATTEMPTS_KEY);
        localStorage.removeItem(SIGNUP_COOLDOWN_UNTIL_KEY);
        setSignupAttempts(0);
        // ไม่ต้อง clear email tracking เพราะต้องให้ user ยืนยันอีเมลก่อน
        // จะ clear เมื่อ user ยืนยันอีเมลสำเร็จ (ใน AuthCallback หรือเมื่อ login สำเร็จ)
      } catch (e) {
        console.error('Error clearing signup attempts:', e);
      }
      
      // ตรวจสอบสถานะ email confirmation
      // email_confirmed_at อาจเป็น undefined, null, หรือ timestamp
      const emailConfirmed = data?.user?.email_confirmed_at != null && data?.user?.email_confirmed_at !== undefined;
      const hasSession = !!data?.session;
      
      // ถ้ามี user แต่ไม่มี session แสดงว่าต้องยืนยันอีเมล (email verification เปิดอยู่)
      if (data?.user && !hasSession) {
        // ถ้ายังต้องยืนยันอีเมล (email verification เปิดอยู่ แต่ยังไม่ยืนยัน)
        setLoading(false);
        // แสดงข้อความชัดเจนว่าต้องยืนยันอีเมล
        toast.success('✅ สมัครสมาชิกสำเร็จ!', { duration: 5000 });
        toast.info('📧 เราได้ส่งอีเมลยืนยันไปยัง ' + cleanEmail + ' แล้ว กรุณาตรวจสอบอีเมลของคุณ', { duration: 12000 });
        // แสดงปุ่ม resend email
        setShowResendEmail(true);
      } else if (data?.user && hasSession) {
        // ถ้ามี session แสดงว่าไม่ต้องยืนยันอีเมล (email verification ปิดอยู่) - แสดงคำเตือนชัดเจน
        toast.error('⚠️ Email Verification ยังไม่ได้เปิดใน Supabase Dashboard!', { duration: 10000 });
        toast.warning('กรุณาไปที่ Supabase Dashboard → Authentication → Settings → Email Auth → เปิด "Enable email confirmations"', { duration: 12000 });
        toast.success('สมัครสมาชิกสำเร็จ แต่ยังไม่มีการยืนยันอีเมล กำลังเข้าสู่ระบบ...');
        setLoading(false);
        
        // ไม่ต้องใช้ window.location.href เพราะ ProtectedRoute จะ detect session อัตโนมัติ
        // และจะแสดง AppContent โดยอัตโนมัติเมื่อ authenticated
        onSuccess?.();
      } else {
        // Fallback - ถ้าไม่มี user หรือ session (กรณีนี้ไม่ควรเกิดขึ้นถ้าสมัครสำเร็จ)
        console.warn('Unexpected signup result:', { hasUser: !!data?.user, hasSession, emailConfirmed });
        // ถ้ามี user แต่ไม่มี session แสดงว่าต้องยืนยันอีเมล
        if (data?.user) {
          setLoading(false);
          toast.success('✅ สมัครสมาชิกสำเร็จ!', { duration: 5000 });
          toast.info('📧 เราได้ส่งอีเมลยืนยันไปยัง ' + cleanEmail + ' แล้ว กรุณาตรวจสอบอีเมลของคุณ', { duration: 12000 });
          setShowResendEmail(true);
        } else {
          toast.error('เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองอีกครั้ง');
          setLoading(false);
        }
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // ใช้ error.code เป็นหลัก (แนะนำโดย Supabase) รองรับ error.message สำหรับ legacy
      let errorMessage = 'สมัครสมาชิกล้มเหลว';
      const code = error?.code ?? '';
      const msg = error?.message ?? '';
      
      // ตรวจสอบ Supabase rate limit (8 seconds) - แยกจากการนับจำนวนครั้ง
      // Supabase rate limit ไม่นับเป็น "attempt" เพราะเป็น rate limit ของ Supabase เอง
      if (code === 'over_request_rate_limit' || error?.status === 429 || 
          (msg && (msg.includes('rate limit') || msg.includes('8 seconds') || msg.includes('too many requests') || msg.includes('For security purposes')))) {
        // Supabase rate limit (8 วินาที) - แสดง cooldown และข้อความที่ชัดเจน
        const supabaseCooldown = 8; // Supabase rate limit คือ 8 วินาที
        setRateLimitCooldown(supabaseCooldown);
        errorMessage = `ส่งคำขอเร็วเกินไป กรุณารอ ${supabaseCooldown} วินาทีก่อนลองอีกครั้ง`;
        toast.error(errorMessage, { duration: 10000 });
        setLoading(false);
        return;
      }
      
      // นับจำนวนครั้งที่พยายามสมัคร (เฉพาะเมื่อเกิด error ที่ไม่ใช่ Supabase rate limit)
      const newAttempts = signupAttempts + 1;
      setSignupAttempts(newAttempts);
      
      // ตรวจสอบว่าพยายามสมัครเกิน 8 ครั้งหรือไม่
      const MAX_ATTEMPTS = 8;
      const COOLDOWN_SECONDS = 120; // 2 นาที
      
      if (newAttempts >= MAX_ATTEMPTS) {
        // เกิน 8 ครั้ง - ตั้ง cooldown 2 นาที
        const cooldownUntil = Date.now() + (COOLDOWN_SECONDS * 1000);
        try {
          localStorage.setItem(SIGNUP_ATTEMPTS_KEY, String(newAttempts));
          localStorage.setItem(SIGNUP_COOLDOWN_UNTIL_KEY, String(cooldownUntil));
        } catch (e) {
          console.error('Error saving signup attempts:', e);
        }
        setRateLimitCooldown(COOLDOWN_SECONDS);
        errorMessage = `พยายามสมัครมากเกินไป (${newAttempts} ครั้ง) กรุณารอ 2 นาทีก่อนลองอีกครั้ง`;
        toast.error(errorMessage, { duration: 10000 });
        setLoading(false);
        return;
      } else {
        // ยังไม่เกิน 8 ครั้ง - บันทึกจำนวนครั้ง
        try {
          localStorage.setItem(SIGNUP_ATTEMPTS_KEY, String(newAttempts));
        } catch (e) {
          console.error('Error saving signup attempts:', e);
        }
      }
      
      if (code === 'user_already_exists' || code === 'email_exists' || 
          (msg && (msg.includes('User already registered') || msg.includes('already registered'))) ||
          error?.status === 422) {
        errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบแทน';
        setTimeout(() => onSwitchToLogin?.(), 2000);
      } else if (code === 'weak_password' || (msg && msg.includes('Password'))) {
        errorMessage = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และตรงตามเงื่อนไขความปลอดภัย';
      } else if (code === 'email_address_invalid' || (msg && msg.includes('invalid') && msg.includes('email'))) {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง กรุณาใช้อีเมลที่ถูกต้อง';
      } else if (msg?.includes('timeout')) {
        errorMessage = 'การสมัครสมาชิกใช้เวลานานเกินไป กรุณาลองอีกครั้ง';
      } else if (msg?.includes('Error sending confirmation email') || msg?.includes('sending email') || msg?.includes('SMTP')) {
        errorMessage = 'เกิดข้อผิดพลาดในการส่งอีเมล กรุณาตรวจสอบ SMTP Settings ใน Supabase Dashboard';
        toast.error(errorMessage, { duration: 10000 });
        toast.warning('ตรวจสอบ: 1) SMTP Password ต้องเป็น API Key จาก Resend (re_...) 2) Sender email ถูก verify แล้ว', { duration: 12000 });
        setLoading(false);
        return;
      } else if (msg) {
        errorMessage = msg;
      }
      
      // แสดงข้อความเตือนถ้ายังไม่ถึง 8 ครั้ง (เฉพาะ error ที่ไม่ใช่ rate limit)
      if (newAttempts >= MAX_ATTEMPTS - 2 && newAttempts < MAX_ATTEMPTS) {
        toast.warning(`⚠️ คุณพยายามสมัคร ${newAttempts}/${MAX_ATTEMPTS} ครั้งแล้ว`, { duration: 5000 });
      }
      
      if (code === 'user_already_exists' || code === 'email_exists' || msg?.includes('already registered')) {
        toast.error(errorMessage, { duration: 6000 });
      } else {
        toast.error(errorMessage, { duration: 6000 });
      }
    } finally {
      // สำคัญ: ต้อง set loading = false เสมอ
      setLoading(false);
    }
  };

  const handleResendConfirmationEmail = async () => {
    if (resendLoading || !email) return;
    
    setResendLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await getSupabase().auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('Resend email error:', error);
        toast.error('ไม่สามารถส่งอีเมลยืนยันได้: ' + (error.message || 'เกิดข้อผิดพลาด'));
      } else {
        toast.success('ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจสอบอีเมลของคุณ', { duration: 8000 });
      }
    } catch (error: any) {
      console.error('Resend email error:', error);
      toast.error('ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองอีกครั้ง');
    } finally {
      setResendLoading(false);
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

      {/* Email Verification Popup */}
      <Dialog open={showResendEmail} onOpenChange={setShowResendEmail}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl font-bold text-blue-900">
              📧 กรุณายืนยันอีเมลของคุณ
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-blue-800 mt-2">
              เราได้ส่งอีเมลยืนยันไปยัง <strong className="text-blue-900">{email}</strong> แล้ว
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-semibold text-gray-800 mb-2">ขั้นตอนการยืนยัน:</p>
              <ol className="text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
                <li>เปิดกล่องจดหมายอีเมลของคุณ</li>
                <li>ค้นหาอีเมลจากเมล <strong>noreply@facein.co</strong></li>
                <li>คลิกลิงก์ยืนยันในอีเมล</li>
                <li>กลับมาหน้าเข้าสู่ระบบและลอง login อีกครั้ง</li>
              </ol>
            </div>

            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-xs text-amber-800 mb-1">
                <strong>💡 ไม่พบอีเมล?</strong>
              </p>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• ตรวจสอบโฟลเดอร์ <strong>Spam</strong> หรือ <strong>Junk Mail</strong></li>
                <li>• รอสักครู่ (อีเมลอาจมาช้า 1-2 นาที)</li>
                <li>• หรือกดปุ่มด้านล่างเพื่อส่งอีเมลยืนยันอีกครั้ง</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-blue-400 text-blue-700 hover:bg-blue-100 font-medium"
                onClick={handleResendConfirmationEmail}
                disabled={resendLoading}
              >
                {resendLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    ส่งอีเมลอีกครั้ง
                  </>
                )}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setShowResendEmail(false);
                  onSwitchToLogin?.();
                }}
              >
                ไปหน้าเข้าสู่ระบบ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
