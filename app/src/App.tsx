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
import { isSupabaseConfigured } from '@/lib/supabase';

import type { AppPage } from '@/types';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<AppPage>('classroom');
  const [enrollTargetStudentId, setEnrollTargetStudentId] = useState<string | null>(null);

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

  return <React.Fragment key={currentPage}>{renderPage()}</React.Fragment>;
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
