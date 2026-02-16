/**
 * Reset Password Page
 * หน้าสำหรับรีเซ็ตรหัสผ่านหลังจากคลิกลิงก์จากอีเมล
 */
import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/auth/Logo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPasswordMismatch, setShowPasswordMismatch] = useState(false);
  const [showSamePasswordDialog, setShowSamePasswordDialog] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // ตรวจสอบว่ามี hash fragment จาก Supabase หรือไม่
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (!accessToken || type !== 'recovery') {
      toast.error('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว');
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
      return;
    }

    // ดึง email จาก session หรือ recovery token เพื่อใช้ตรวจสอบรหัสผ่านเดิม
    const getCurrentUserEmail = async () => {
      try {
        // เมื่อมี recovery token, Supabase จะ set session อัตโนมัติ
        // รอสักครู่เพื่อให้ session ถูก set
        await new Promise(resolve => setTimeout(resolve, 1000));

        // ลองดึงจาก session
        const { data: { session }, error: sessionError } = await getSupabase().auth.getSession();
        if (session?.user?.email) {
          console.log('[ResetPassword] ✓ Got email from session:', session.user.email);
          setUserEmail(session.user.email);
          return;
        }

        // ถ้าไม่มี session ลองดึงจาก user
        const { data: { user }, error: userError } = await getSupabase().auth.getUser();
        if (user?.email) {
          console.log('[ResetPassword] ✓ Got email from user:', user.email);
          setUserEmail(user.email);
          return;
        }

        console.warn('[ResetPassword] ⚠️ Could not get user email', {
          sessionError: sessionError?.message,
          userError: userError?.message,
        });
      } catch (error) {
        console.error('[ResetPassword] Error getting user email:', error);
      }
    };

    getCurrentUserEmail();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    // ตรวจสอบว่ารหัสผ่านไม่ตรงกัน
    if (password !== confirmPassword) {
      toast.error('⚠️ รหัสผ่านไม่ตรงกัน กรุณากรอกรหัสผ่านให้ตรงกัน', { duration: 5000 });
      setShowPasswordMismatch(true);
      return;
    }

    // ตรวจสอบความยาวรหัสผ่าน
    if (password.length < 6) {
      toast.error('⚠️ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', { duration: 5000 });
      return;
    }

    // ตรวจสอบว่ารหัสผ่านไม่ว่างเปล่า
    if (!password.trim()) {
      toast.error('⚠️ กรุณากรอกรหัสผ่าน', { duration: 5000 });
      return;
    }

    setLoading(true);

    try {
      // ตรวจสอบว่ารหัสผ่านใหม่เป็นรหัสผ่านเดิมหรือไม่ โดยลอง login ก่อน
      if (!userEmail) {
        // ถ้ายังไม่มี email ให้ลองดึงอีกครั้ง
        console.log('[ResetPassword] User email not available, trying to get it again...');
        try {
          const { data: { user } } = await getSupabase().auth.getUser();
          if (user?.email) {
            console.log('[ResetPassword] Got email from getUser:', user.email);
            setUserEmail(user.email);
          }
        } catch (err) {
          console.error('[ResetPassword] Failed to get user email:', err);
        }
      }

      if (userEmail) {
        console.log('[ResetPassword] Checking if new password is same as old password...', { email: userEmail });
        
        // ตรวจสอบว่ามี session อยู่แล้วหรือไม่ (จาก recovery token)
        const { data: { session: currentSession } } = await getSupabase().auth.getSession();
        
        if (currentSession) {
          // เก็บ session เดิมไว้เพื่อ restore กลับมาหลังตรวจสอบ
          const originalSession = currentSession;
          
          // ลอง login ด้วยรหัสผ่านใหม่เพื่อดูว่าเป็นรหัสผ่านเดิมหรือไม่
          try {
            const { data: loginData, error: loginError } = await getSupabase().auth.signInWithPassword({
              email: userEmail,
              password: password,
            });

            console.log('[ResetPassword] Login check result:', { 
              hasSession: !!loginData?.session, 
              error: loginError?.message,
              errorCode: loginError?.code
            });

            // ถ้า login สำเร็จ แสดงว่ารหัสผ่านใหม่เป็นรหัสผ่านเดิม
            if (loginData?.session && !loginError) {
              console.warn('[ResetPassword] ⚠️ New password is same as old password - blocking update');
              
              // Restore session เดิมกลับมา (จาก recovery token)
              await getSupabase().auth.setSession({
                access_token: originalSession.access_token,
                refresh_token: originalSession.refresh_token,
              });
              
              // แสดง Dialog popup
              setShowSamePasswordDialog(true);
              
              // แสดง toast เพิ่มเติม
              toast.error('⚠️ ไม่สามารถใช้รหัสผ่านเดิมได้', { 
                duration: 8000,
              });
              
              setLoading(false);
              return;
            } else if (loginError) {
              // ถ้า login ไม่สำเร็จ แสดงว่าเป็นรหัสผ่านใหม่ → restore session เดิมกลับมา
              await getSupabase().auth.setSession({
                access_token: originalSession.access_token,
                refresh_token: originalSession.refresh_token,
              });
              
              console.log('[ResetPassword] ✓ Password is different (login failed), proceeding with update...', {
                error: loginError?.message,
                errorCode: loginError?.code
              });
            }
          } catch (checkError: any) {
            // ถ้าเกิด error ให้ restore session เดิมกลับมา
            try {
              await getSupabase().auth.setSession({
                access_token: originalSession.access_token,
                refresh_token: originalSession.refresh_token,
              });
            } catch (restoreError) {
              console.error('[ResetPassword] Failed to restore session:', restoreError);
            }
            
            console.log('[ResetPassword] ✓ Password is different (exception), proceeding with update...', {
              error: checkError?.message
            });
          }
        } else {
          // ถ้าไม่มี session อาจจะยังไม่ได้ set จาก recovery token
          console.warn('[ResetPassword] ⚠️ No session available - skipping password check');
        }
      } else {
        console.warn('[ResetPassword] ⚠️ No user email available - cannot check if password is same as old password');
        toast.warning('⚠️ ไม่สามารถตรวจสอบรหัสผ่านเดิมได้ กรุณาใช้รหัสผ่านใหม่ที่แตกต่างจากรหัสผ่านเดิม', { 
          duration: 6000 
        });
      }

      // ตรวจสอบว่ามี session อยู่ก่อน update password
      const { data: { session: checkSession } } = await getSupabase().auth.getSession();
      if (!checkSession) {
        console.error('[ResetPassword] No session available for password update');
        toast.error('เกิดข้อผิดพลาด: ไม่พบ session กรุณาลองใหม่', { duration: 6000 });
        setLoading(false);
        return;
      }

      console.log('[ResetPassword] Updating password...', { hasSession: !!checkSession });
      const { data, error } = await getSupabase().auth.updateUser({
        password: password,
      });

      console.log('[ResetPassword] Update response:', { data, error });

      if (error) {
        console.error('[ResetPassword] Reset password error:', {
          code: error.code,
          message: error.message,
          status: error.status,
          fullError: error,
        });
        throw error;
      }

      setSuccess(true);
      toast.success('รีเซ็ตรหัสผ่านสำเร็จ! กำลังเข้าสู่ระบบ...', { duration: 3000 });

      // Redirect ไปหน้า login หลังจาก 2 วินาที
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: any) {
      console.error('Reset password error:', error);

      let errorMessage = 'ไม่สามารถรีเซ็ตรหัสผ่านได้';
      const msg = error?.message ?? '';
      const code = error?.code ?? '';
      const status = error?.status;

      // ตรวจสอบ error ต่างๆ
      if (msg.includes('expired') || msg.includes('invalid') || code === 'invalid_token') {
        errorMessage = 'ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว กรุณาขอลิงก์ใหม่';
      } else if (msg.includes('weak_password') || code === 'weak_password') {
        errorMessage = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และตรงตามเงื่อนไขความปลอดภัย';
      } else if (
        msg.includes('same') || 
        msg.includes('identical') || 
        msg.includes('ไม่สามารถใช้รหัสผ่านเดิม') ||
        msg.includes('duplicate') ||
        msg.includes('already') ||
        msg.toLowerCase().includes('new password should be different') ||
        msg.toLowerCase().includes('password unchanged') ||
        msg.toLowerCase().includes('same as current') ||
        msg.toLowerCase().includes('same as old') ||
        msg.toLowerCase().includes('cannot reuse') ||
        msg.toLowerCase().includes('must be different') ||
        code === 'same_password' ||
        code === 'password_reuse'
      ) {
        errorMessage = '⚠️ ไม่สามารถใช้รหัสผ่านเดิมได้ กรุณาตั้งรหัสผ่านใหม่ที่แตกต่างจากรหัสผ่านเดิม';
        toast.error(errorMessage, { duration: 8000 });
        toast.warning('💡 เพื่อความปลอดภัย กรุณาใช้รหัสผ่านใหม่ที่แตกต่างจากรหัสผ่านเดิม', { duration: 10000 });
        setLoading(false);
        return;
      } else if (msg) {
        errorMessage = msg;
      }

      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">รีเซ็ตรหัสผ่านสำเร็จ</h1>
                <p className="text-gray-600 mt-2">
                  รหัสผ่านของคุณถูกอัปเดตแล้ว กำลังเข้าสู่ระบบ...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Dialog สำหรับแจ้งเตือนรหัสผ่านเดิม */}
      <Dialog open={showSamePasswordDialog} onOpenChange={setShowSamePasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                ไม่สามารถใช้รหัสผ่านเดิมได้
              </DialogTitle>
            </div>
            <DialogDescription className="text-gray-600 pt-2 space-y-3">
              <div>
                รหัสผ่านที่คุณกรอกเป็นรหัสผ่านเดิมที่ใช้อยู่แล้ว
              </div>
              <div className="font-medium text-gray-900">
                💡 เพื่อความปลอดภัย กรุณาใช้รหัสผ่านใหม่ที่แตกต่างจากรหัสผ่านเดิม
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => {
                setShowSamePasswordDialog(false);
                setPassword('');
                setConfirmPassword('');
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              เข้าใจแล้ว
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          {/* Header with Logo */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <Logo className="h-16 w-auto" useImage={true} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                ตั้งรหัสผ่านใหม่
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                กรุณากรอกรหัสผ่านใหม่ของคุณ
              </p>
            </div>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">รหัสผ่านใหม่</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    // อัปเดตสถานะการไม่ตรงกัน
                    if (confirmPassword && e.target.value !== confirmPassword) {
                      setShowPasswordMismatch(true);
                    } else {
                      setShowPasswordMismatch(false);
                    }
                  }}
                  required
                  minLength={6}
                  className="pl-10 h-11"
                />
              </div>
              {password && password.length < 6 && (
                <p className="text-xs text-red-500 mt-1">⚠️ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-700">ยืนยันรหัสผ่าน</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    // อัปเดตสถานะการไม่ตรงกัน
                    if (password && e.target.value !== password) {
                      setShowPasswordMismatch(true);
                    } else {
                      setShowPasswordMismatch(false);
                    }
                  }}
                  required
                  minLength={6}
                  className={`pl-10 h-11 ${
                    showPasswordMismatch && password && confirmPassword
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : ''
                  }`}
                />
              </div>
              {showPasswordMismatch && password && confirmPassword && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>รหัสผ่านไม่ตรงกัน กรุณากรอกรหัสผ่านให้ตรงกัน</span>
                </p>
              )}
              {!showPasswordMismatch && password && confirmPassword && password === confirmPassword && password.length >= 6 && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <span>✓</span>
                  <span>รหัสผ่านตรงกัน</span>
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 text-sm" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังอัปเดตรหัสผ่าน...
                </>
              ) : (
                'ตั้งรหัสผ่านใหม่'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
