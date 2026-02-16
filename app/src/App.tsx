/**
 * ระบบเช็คชื่อนักเรียนด้วยใบหน้า
 * Face-based student attendance system
 */
import React, { useState } from 'react';
import { ClassRoomSection } from '@/sections/ClassRoomSection';
import { DashboardSection } from '@/sections/DashboardSection';
import { StudentManagementSection } from '@/sections/StudentManagementSection';
import { FaceEnrollmentSection } from '@/sections/FaceEnrollmentSection';
import { AttendanceScanningSection } from '@/sections/AttendanceScanningSection';
import { ReportsSection } from '@/sections/ReportsSection';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ConfigErrorPage } from '@/components/auth/ConfigErrorPage';
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
  if (!isSupabaseConfigured) {
    return <ConfigErrorPage />;
  }
  return (
    <ProtectedRoute>
      <AppContent />
    </ProtectedRoute>
  );
}

export default App;
