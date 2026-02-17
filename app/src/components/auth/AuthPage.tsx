/**
 * Auth Page Component
 * หน้า Login/SignUp/Forgot Password แบบรวม
 */
import { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { PrivacyPolicy } from '@/pages/PrivacyPolicy';

type AuthView = 'login' | 'signup' | 'forgot-password';

export function AuthPage() {
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [showPrivacy, setShowPrivacy] = useState(false);

  // ฟัง event สำหรับแสดง forgot password form
  useEffect(() => {
    const handleShowForgotPassword = () => {
      setCurrentView('forgot-password');
    };

    window.addEventListener('showForgotPassword', handleShowForgotPassword);
    return () => {
      window.removeEventListener('showForgotPassword', handleShowForgotPassword);
    };
  }, []);

  // ฟัง hash สำหรับแสดงนโยบายความเป็นส่วนตัว - ตรวจสอบทั้งตอน mount และเมื่อ hash เปลี่ยน
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      setShowPrivacy(hash === '#privacy');
    };
    
    // ตรวจสอบทันทีเมื่อ component mount (สำหรับกรณีที่ URL มี #privacy อยู่แล้ว)
    checkHash();
    
    // ฟัง hashchange event
    window.addEventListener('hashchange', checkHash);
    
    // ตรวจสอบซ้ำหลังจาก mount เพื่อให้แน่ใจ (สำหรับกรณีที่ hash ยังไม่พร้อมตอน initial render)
    const timeoutId = setTimeout(checkHash, 100);
    
    return () => {
      window.removeEventListener('hashchange', checkHash);
      clearTimeout(timeoutId);
    };
  }, []);

  const handlePrivacyBack = () => {
    window.location.hash = '';
    setShowPrivacy(false);
  };

  if (showPrivacy) {
    return <PrivacyPolicy onBack={handlePrivacyBack} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {currentView === 'login' ? (
          <LoginForm
            onSwitchToSignUp={() => setCurrentView('signup')}
            onSuccess={() => {
              // จะ redirect โดย useAuth hook
            }}
          />
        ) : currentView === 'signup' ? (
          <SignUpForm
            onSwitchToLogin={() => setCurrentView('login')}
            onSuccess={() => {
              // จะ redirect โดย useAuth hook
            }}
          />
        ) : (
          <ForgotPasswordForm
            onBack={() => setCurrentView('login')}
            onSwitchToLogin={() => setCurrentView('login')}
          />
        )}
      </div>
    </div>
  );
}
