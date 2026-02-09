import { useState, useCallback } from 'react';
import type { AttendanceRecord, Student } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';

/** ได้วันที่ในรูปแบบ YYYY-MM-DD ตาม timezone ปัจจุบัน (ไม่ใช่ UTC) */
function getLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** อ่านจาก localStorage โดยตรง — ใช้เมื่อต้องเช็คแบบ sync เพื่อกัน stale closure */
function getStudentStatusTodaySync(studentId: string, classId?: string): AttendanceRecord | undefined {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (!saved) return undefined;
    const list = JSON.parse(saved) as AttendanceRecord[];
    const today = getLocalDateString();
    return list.find(a => a.studentId === studentId && a.date === today && (!classId || a.classId === classId));
  } catch {
    return undefined;
  }
}

function loadAttendance(): AttendanceRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (saved) {
      const list = JSON.parse(saved);
      return Array.isArray(list) ? list : [];
    }
  } catch {
    // ignore
  }
  return [];
}

function persistAttendance(list: AttendanceRecord[]) {
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(list));
}

export function useAttendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(loadAttendance);

  const recordAttendance = useCallback((
    student: Student,
    classId: string,
    status: 'present' | 'absent' | 'late' | 'excused',
    options: {
      faceRecognized?: boolean;
      matchScore?: number;
      isManual?: boolean;
    } = {}
  ): AttendanceRecord => {
    const today = getLocalDateString();

    setAttendance(prev => {
      const existingIndex = prev.findIndex(
        a => a.studentId === student.id && a.date === today
      );

      const record: AttendanceRecord = {
        id: existingIndex >= 0 ? prev[existingIndex].id : `att-${Date.now()}`,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        classId,
        date: today,
        status,
        recordedAt: new Date().toISOString(),
        faceRecognized: options.faceRecognized ?? false,
        matchScore: options.matchScore,
        isManual: options.isManual ?? false
      };

      const next = existingIndex >= 0
        ? prev.map((a, i) => (i === existingIndex ? record : a))
        : [...prev, record];
      persistAttendance(next);
      return next;
    });

    const existing = attendance.find(a => a.studentId === student.id && a.date === today);
    return {
      id: existing?.id ?? `att-${Date.now()}`,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      classId,
      date: today,
      status,
      recordedAt: new Date().toISOString(),
      faceRecognized: options.faceRecognized ?? false,
      matchScore: options.matchScore,
      isManual: options.isManual ?? false
    };
  }, []);

  const getAttendanceByDate = useCallback((date: string, classId?: string) => {
    return attendance.filter(a => {
      if (a.date !== date) return false;
      if (classId && a.classId !== classId) return false;
      return true;
    });
  }, [attendance]);

  const getAttendanceByStudent = useCallback((studentId: string) => {
    return attendance.filter(a => a.studentId === studentId);
  }, [attendance]);

  const getTodayAttendance = useCallback((classId?: string) => {
    const today = getLocalDateString();
    return getAttendanceByDate(today, classId);
  }, [getAttendanceByDate]);

  const getStudentStatusToday = useCallback((studentId: string): AttendanceRecord | undefined => {
    const today = getLocalDateString();
    return attendance.find(a => a.studentId === studentId && a.date === today);
  }, [attendance]);

  const getAttendanceStats = useCallback((classId?: string) => {
    const relevant = classId 
      ? attendance.filter(a => a.classId === classId)
      : attendance;

    const total = relevant.length;
    const present = relevant.filter(a => a.status === 'present').length;
    const absent = relevant.filter(a => a.status === 'absent').length;
    const late = relevant.filter(a => a.status === 'late').length;
    const excused = relevant.filter(a => a.status === 'excused').length;

    return {
      total,
      present,
      absent,
      late,
      excused,
      rate: total > 0 ? (present / total) * 100 : 0
    };
  }, [attendance]);

  const updateAttendance = useCallback((id: string, updates: Partial<AttendanceRecord>) => {
    setAttendance(prev => {
      const next = prev.map(a => (a.id === id ? { ...a, ...updates } : a));
      persistAttendance(next);
      return next;
    });
  }, []);

  const deleteAttendance = useCallback((id: string) => {
    setAttendance(prev => {
      const next = prev.filter(a => a.id !== id);
      persistAttendance(next);
      return next;
    });
  }, []);

  /** ลบรายการเช็คชื่อของวันนี้ทั้งหมด — ใช้เมื่อต้องการเช็คชื่อวันนี้อีกรอบหรือรีเซ็ตข้อมูลวันใหม่ */
  const clearTodayAttendance = useCallback((classId?: string) => {
    const today = getLocalDateString();
    setAttendance(prev => {
      const next = prev.filter(a => {
        if (a.date !== today) return true;
        if (classId && a.classId !== classId) return true;
        return false;
      });
      persistAttendance(next);
      return next;
    });
  }, []);

  return {
    attendance,
    recordAttendance,
    getAttendanceByDate,
    getAttendanceByStudent,
    getTodayAttendance,
    getStudentStatusToday,
    getStudentStatusTodaySync,
    getAttendanceStats,
    updateAttendance,
    deleteAttendance,
    clearTodayAttendance
  };
}
