/**
 * ระบบเช็คชื่อนักเรียนด้วยใบหน้า
 * Face-based student attendance system
 */
import React, { useState, useEffect } from 'react';
import { ClassRoomSection } from '@/sections/ClassRoomSection';
import { DashboardSection } from '@/sections/DashboardSection';
import { StudentManagementSection } from '@/sections/StudentManagementSection';
import { FaceEnrollmentSection } from '@/sections/FaceEnrollmentSection';
import { AttendanceScanningSection } from '@/sections/AttendanceScanningSection';
import { ReportsSection } from '@/sections/ReportsSection';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ConfigErrorPage } from '@/components/auth/ConfigErrorPage';
import { ResetPasswordPage } from '@/pages/ResetPassword';
import { PrivacyPolicy } from '@/pages/PrivacyPolicy';
import { isSupabaseConfigured } from '@/lib/supabase';

import type { AppPage } from '@/types';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<AppPage>('classroom');
  const [enrollTargetStudentId, setEnrollTargetStudentId] = useState<string | null>(null);
  const [hash, setHash] = useState('');

  useEffect(() => {
    const checkHash = () => {
      const currentHash = window.location.hash;
      setHash(currentHash);
    };
    
    // ตรวจสอบทันทีเมื่อ component mount
    checkHash();
    
    // ฟัง hashchange event
    const handler = () => checkHash();
    window.addEventListener('hashchange', handler);
    
    // ตรวจสอบซ้ำหลังจาก mount เพื่อให้แน่ใจ (สำหรับกรณีที่ hash ยังไม่พร้อมตอน initial render)
    const timeoutId = setTimeout(checkHash, 100);
    
    return () => {
      window.removeEventListener('hashchange', handler);
      clearTimeout(timeoutId);
    };
  }, []);

  if (hash === '#privacy') {
    return <PrivacyPolicy onBack={() => { window.location.hash = ''; setHash(''); }} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'classroom':
        return <ClassRoomSection onEnter={() => setCurrentPage('dashboard')} />;
      case 'dashboard':
        return <DashboardSection onNavigate={setCurrentPage} />;
      case 'students':
        return (
          <StudentManagementSection
            onBack={() => setCurrentPage('dashboard')}
            onNavigateToEnroll={(studentId) => {
              setEnrollTargetStudentId(studentId);
              setCurrentPage('enroll');
            }}
          />
        );
      case 'enroll':
        return (
          <FaceEnrollmentSection
            onBack={() => {
              setEnrollTargetStudentId(null);
              setCurrentPage('dashboard');
            }}
            initialStudentId={enrollTargetStudentId}
          />
        );
      case 'attendance':
        return <AttendanceScanningSection onBack={() => setCurrentPage('dashboard')} />;
      case 'reports':
        return <ReportsSection onBack={() => setCurrentPage('dashboard')} />;
      default:
        return <ClassRoomSection onEnter={() => setCurrentPage('dashboard')} />;
    }
  };

  return <>{renderPage()}</>;
}

function App() {
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    // ตรวจสอบว่ามี hash fragment สำหรับ reset password หรือไม่
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type === 'recovery') {
      setShowResetPassword(true);
    }
  }, []);

  if (!isSupabaseConfigured) {
    return <ConfigErrorPage />;
  }

  // แสดงหน้า reset password ถ้ามี hash fragment สำหรับ recovery
  if (showResetPassword) {
    return <ResetPasswordPage />;
  }

  return (
    <ProtectedRoute>
      <AppContent />
    </ProtectedRoute>
  );
}

export default App;
