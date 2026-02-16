/**
 * Auth Page Component
 * หน้า Login/SignUp/Forgot Password แบบรวม
 */
import { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type AuthView = 'login' | 'signup' | 'forgot-password';

export function AuthPage() {
  const [currentView, setCurrentView] = useState<AuthView>('login');

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
