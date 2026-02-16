/**
 * Auth Page Component
 * หน้า Login/SignUp แบบรวม
 */
import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {isLogin ? (
          <LoginForm
            onSwitchToSignUp={() => setIsLogin(false)}
            onSuccess={() => {
              // จะ redirect โดย useAuth hook
            }}
          />
        ) : (
          <SignUpForm
            onSwitchToLogin={() => setIsLogin(true)}
            onSuccess={() => {
              // จะ redirect โดย useAuth hook
            }}
          />
        )}
      </div>
    </div>
  );
}
