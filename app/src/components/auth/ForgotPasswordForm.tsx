/**
 * Forgot Password Form Component
 * สำหรับรีเซ็ตรหัสผ่านเมื่อลืมรหัสผ่าน
 */
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

interface ForgotPasswordFormProps {
  onBack: () => void;
  onSwitchToLogin?: () => void;
}

export function ForgotPasswordForm({ onBack, onSwitchToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const redirectUrl = `${window.location.origin}/`;
      
      console.log('[ForgotPassword] Requesting password reset:', {
        email: cleanEmail,
        redirectTo: redirectUrl,
        origin: window.location.origin,
      });
      
      const { data, error } = await getSupabase().auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      console.log('[ForgotPassword] Response:', { data, error });

      if (error) {
        console.error('[ForgotPassword] Reset password error:', {
          code: error.code,
          message: error.message,
          status: error.status,
          fullError: error,
        });
        throw error;
      }

      // สำเร็จ - แสดงข้อความยืนยัน
      console.log('[ForgotPassword] Email sent successfully');
      setEmailSent(true);
      toast.success('ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบอีเมลของคุณ', { duration: 8000 });
      
      // แสดงคำแนะนำเพิ่มเติม
      toast.info('💡 ไม่พบอีเมล? ตรวจสอบโฟลเดอร์ Spam หรือดู Auth Logs ใน Supabase Dashboard', { 
        duration: 10000 
      });
    } catch (error: any) {
      console.error('[ForgotPassword] Reset password error:', {
        code: error?.code,
        message: error?.message,
        status: error?.status,
        name: error?.name,
        fullError: error,
      });
      
      let errorMessage = 'ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้';
      const code = error?.code ?? '';
      const msg = error?.message ?? '';
      const status = error?.status;
      
      if (code === 'email_address_invalid' || (msg && msg.includes('invalid') && msg.includes('email'))) {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (code === 'over_request_rate_limit' || status === 429 || msg.includes('rate limit')) {
        errorMessage = 'ส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง';
      } else if (msg.includes('user not found') || msg.includes('email not found')) {
        errorMessage = 'ไม่พบอีเมลนี้ในระบบ กรุณาตรวจสอบอีเมลของคุณ';
      } else if (msg.includes('smtp') || msg.includes('email') || msg.includes('send')) {
        errorMessage = `เกิดข้อผิดพลาดในการส่งอีเมล: ${msg}\n\nกรุณาตรวจสอบ SMTP Settings ใน Supabase Dashboard`;
      } else if (msg) {
        errorMessage = `เกิดข้อผิดพลาด: ${msg}`;
      }
      
      toast.error(errorMessage, { duration: 8000 });
      
      // แสดงคำแนะนำให้ตรวจสอบ Auth Logs
      console.warn('[ForgotPassword] 💡 ตรวจสอบ Auth Logs ใน Supabase Dashboard:');
      console.warn('[ForgotPassword]   - ไปที่ Supabase Dashboard → Logs → Auth Logs');
      console.warn('[ForgotPassword]   - ค้นหาการเรียก resetPasswordForEmail');
      console.warn('[ForgotPassword]   - ดู error message ที่แท้จริง');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="w-full max-w-md mx-auto p-6 space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ส่งอีเมลแล้ว</h1>
            <p className="text-gray-600 mt-2">
              เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมล <strong>{email}</strong> แล้ว
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>ขั้นตอนต่อไป:</strong>
            </p>
            <ol className="text-sm text-blue-700 mt-2 space-y-1 list-decimal list-inside">
              <li>ตรวจสอบกล่องจดหมายอีเมลของคุณ</li>
              <li>คลิกลิงก์รีเซ็ตรหัสผ่านในอีเมล</li>
              <li>ตั้งรหัสผ่านใหม่</li>
            </ol>
            <p className="text-xs text-blue-600 mt-3">
              💡 ไม่พบอีเมล? ตรวจสอบโฟลเดอร์ Spam หรือ Junk Mail
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setEmailSent(false);
              setEmail('');
            }}
          >
            ส่งอีเมลอีกครั้ง
          </Button>

          <Button
            type="button"
            className="w-full"
            onClick={onSwitchToLogin || onBack}
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">ลืมรหัสผ่าน?</h1>
        <p className="text-gray-600 mt-2">
          กรุณากรอกอีเมลของคุณ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้คุณ
        </p>
      </div>

      <form onSubmit={handleResetPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email">อีเมล</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="reset-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              กำลังส่งอีเมล...
            </>
          ) : (
            'ส่งลิงก์รีเซ็ตรหัสผ่าน'
          )}
        </Button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}
