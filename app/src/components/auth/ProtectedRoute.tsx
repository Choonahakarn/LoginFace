/**
 * Protected Route Component
 * ป้องกัน routes ที่ต้อง login
 */
import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from './AuthPage';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();

  // ถ้า loading นานเกินไป (มากกว่า 2 วินาที) ให้แสดง login page
  const [showLogin, setShowLogin] = React.useState(false);
  
  React.useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('ProtectedRoute: Loading timeout - showing login page');
        setShowLogin(true);
      }, 2000); // 2 วินาที
      return () => clearTimeout(timer);
    } else {
      setShowLogin(false);
    }
  }, [loading]);

  // Debug logs
  React.useEffect(() => {
    console.log('ProtectedRoute state:', { loading, isAuthenticated, hasUser: !!user, showLogin });
  }, [loading, isAuthenticated, user, showLogin]);

  // ถ้า loading เสร็จแล้วและ authenticated แล้ว แสดง content
  if (!loading && isAuthenticated && user) {
    return <><Toaster />{children}</>;
  }

  // ถ้า loading เสร็จแล้วแต่ไม่ authenticated ให้แสดง login
  if (!loading && !isAuthenticated) {
    console.log('Not authenticated - showing login page');
    return <><Toaster /><AuthPage /></>;
  }

  // ถ้า loading timeout ให้แสดง login
  if (showLogin) {
    console.log('Loading timeout - showing login page');
    return <><Toaster /><AuthPage /></>;
  }

  // กำลัง loading
  return (
    <>
      <Toaster />
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-3 text-gray-600">กำลังโหลด...</p>
      </div>
    </>
  );
}
