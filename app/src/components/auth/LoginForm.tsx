/**
 * Login Form Component
 * รองรับ Email/Password และ Social Login (Line)
 */
import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, Clock, ScanLine, Info, AlertCircle } from 'lucide-react';
import { Logo } from './Logo';
import { FeaturesInfo } from './FeaturesInfo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignUp?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignUp }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showLineLoginDialog, setShowLineLoginDialog] = useState(false);

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
      
      const { data, error } = await getSupabase().auth.signInWithPassword({
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
      
      // ไม่ต้องใช้ window.location.href เพราะ ProtectedRoute จะ detect session อัตโนมัติ
      // และจะแสดง AppContent โดยอัตโนมัติเมื่อ authenticated
      onSuccess?.();
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
    // แสดง Dialog popup แทนการ login จริง
    if (provider === 'line') {
      setShowLineLoginDialog(true);
      return;
    }

    // สำหรับ provider อื่นๆ (ถ้ามีในอนาคต)
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
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
    <>
      {/* Dialog สำหรับแจ้งเตือน Line Login */}
      <Dialog open={showLineLoginDialog} onOpenChange={setShowLineLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                เตรียมพร้อม Update เวอร์ชั่นหน้า
              </DialogTitle>
            </div>
            <DialogDescription className="text-gray-600 pt-2 space-y-3">
              <div>
                ตอนนี้ยังไม่สามารถ Login ด้วย Line ได้
              </div>
              <div className="font-medium text-gray-900">
                💡 กรุณาใช้ Email/Password เพื่อเข้าสู่ระบบ
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => setShowLineLoginDialog(false)}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              เข้าใจแล้ว
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
      {/* Header with Logo */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <Logo className="h-24 w-auto" useImage={true} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            ระบบเช็คชื่อด้วยใบหน้า
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Face Recognition Attendance System
          </p>
        </div>
      </div>

      {/* ปุ่มดูข้อมูลเพิ่มเติม */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowFeatures(true)}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
        >
          <Info className="w-4 h-4" />
          ดูข้อมูลเพิ่มเติมเกี่ยวกับระบบ
        </button>
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-700">อีเมล</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10 h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-gray-700">รหัสผ่าน</Label>
            <button
              type="button"
              onClick={() => {
                // จะเพิ่ม forgot password flow ใน AuthPage
                const event = new CustomEvent('showForgotPassword');
                window.dispatchEvent(event);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              ลืมรหัสผ่าน?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-10 h-11"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 text-sm" 
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

        <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200 text-center text-sm">
          <p className="font-medium text-gray-800 mb-2">บัญชีทดสอบระบบ</p>
          <div className="space-y-1 text-gray-600">
            <p>
              <span className="font-medium">อีเมล:</span>{' '}
              <code className="bg-white px-2 py-0.5 rounded text-gray-800 font-mono text-xs border border-gray-200">teacher@school.edu</code>
            </p>
            <p>
              <span className="font-medium">รหัสผ่าน:</span>{' '}
              <code className="bg-white px-2 py-0.5 rounded text-gray-800 font-mono text-xs border border-gray-200">password</code>
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ใช้บัญชีนี้เพื่อทดสอบระบบ
          </p>
        </div>
      </form>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">หรือ</span>
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

      <div className="text-center text-sm pt-2">
        <span className="text-gray-600">ยังไม่มีบัญชี? </span>
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-blue-600 hover:underline font-medium"
        >
          สมัครสมาชิก
        </button>
      </div>

      {/* Features Info Modal */}
      {showFeatures && (
        <FeaturesInfo onClose={() => setShowFeatures(false)} />
      )}
    </div>
    </>
  );
}
