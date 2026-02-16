import { useState, useCallback, useEffect } from 'react';
import type { AttendanceRecord, Student } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

/** ได้วันที่ในรูปแบบ YYYY-MM-DD ตาม timezone ปัจจุบัน (ไม่ใช่ UTC) */
function getLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Cache สำหรับ getStudentStatusTodaySync
let attendanceCache: AttendanceRecord[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

export function useAttendance() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Load attendance from Supabase
  useEffect(() => {
    if (!user) {
      setAttendance([]);
      setLoading(false);
      return;
    }

    const loadAttendance = async () => {
      try {
        // Load attendance records
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .order('recorded_at', { ascending: false });

        if (error) {
          console.error('Error loading attendance:', error);
          setAttendance([]);
          setLoading(false);
          return;
        }

        // Transform to AttendanceRecord format
        const transformedAttendance: AttendanceRecord[] = (data || []).map(a => ({
          id: a.id,
          studentId: a.student_id,
          studentName: a.student_name,
          classId: a.classroom_id,
          date: a.date,
          status: a.status as AttendanceRecord['status'],
          recordedAt: a.recorded_at,
          faceRecognized: a.face_recognized || false,
          matchScore: a.match_score || undefined,
          isManual: a.is_manual || false,
        }));

        setAttendance(transformedAttendance);
        attendanceCache = transformedAttendance;
        cacheTimestamp = Date.now();
      } catch (error) {
        console.error('Error loading attendance:', error);
        setAttendance([]);
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();

    // Subscribe to changes
    const subscription = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadAttendance();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  /** อ่านจาก cache โดยตรง — ใช้เมื่อต้องเช็คแบบ sync เพื่อกัน stale closure */
  const getStudentStatusTodaySync = useCallback((studentId: string, classId?: string): AttendanceRecord | undefined => {
    const now = Date.now();
    if (now - cacheTimestamp > CACHE_TTL) {
      // Cache expired, return undefined (caller should use async version)
      return undefined;
    }
    const today = getLocalDateString();
    return attendanceCache.find(a => a.studentId === studentId && a.date === today && (!classId || a.classId === classId));
  }, []);

  const recordAttendance = useCallback(
    async (
      student: Student,
      classId: string,
      status: 'present' | 'absent' | 'late' | 'excused',
      options: {
        faceRecognized?: boolean;
        matchScore?: number;
        isManual?: boolean;
      } = {}
    ): Promise<AttendanceRecord> => {
      if (!user) throw new Error('User not authenticated');

      const today = getLocalDateString();

      try {
        // Check if record exists
        const { data: existingData } = await supabase
          .from('attendance')
          .select('id')
          .eq('user_id', user.id)
          .eq('student_id', student.id)
          .eq('classroom_id', classId)
          .eq('date', today)
          .single();

        const recordData = {
          user_id: user.id,
          student_id: student.id,
          student_name: `${student.firstName} ${student.lastName}`,
          classroom_id: classId,
          date: today,
          status,
          face_recognized: options.faceRecognized ?? false,
          match_score: options.matchScore || null,
          is_manual: options.isManual ?? false,
        };

        let recordId: string;

        if (existingData) {
          // Update existing record
          const { data, error } = await supabase
            .from('attendance')
            .update(recordData)
            .eq('id', existingData.id)
            .select()
            .single();

          if (error) throw error;
          recordId = data.id;
        } else {
          // Insert new record
          const { data, error } = await supabase
            .from('attendance')
            .insert(recordData)
            .select()
            .single();

          if (error) throw error;
          recordId = data.id;
        }

        // Reload attendance
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .order('recorded_at', { ascending: false });

        if (!attendanceError && attendanceData) {
          const transformedAttendance: AttendanceRecord[] = attendanceData.map(a => ({
            id: a.id,
            studentId: a.student_id,
            studentName: a.student_name,
            classId: a.classroom_id,
            date: a.date,
            status: a.status as AttendanceRecord['status'],
            recordedAt: a.recorded_at,
            faceRecognized: a.face_recognized || false,
            matchScore: a.match_score || undefined,
            isManual: a.is_manual || false,
          }));

          setAttendance(transformedAttendance);
          attendanceCache = transformedAttendance;
          cacheTimestamp = Date.now();
        }

        return {
          id: recordId,
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          classId,
          date: today,
          status,
          recordedAt: new Date().toISOString(),
          faceRecognized: options.faceRecognized ?? false,
          matchScore: options.matchScore,
          isManual: options.isManual ?? false,
        };
      } catch (error) {
        console.error('Error recording attendance:', error);
        throw error;
      }
    },
    [user]
  );

  const getAttendanceByDate = useCallback(
    (date: string, classId?: string) => {
      return attendance.filter(a => {
        if (a.date !== date) return false;
        if (classId && a.classId !== classId) return false;
        return true;
      });
    },
    [attendance]
  );

  const getAttendanceByStudent = useCallback(
    (studentId: string) => {
      return attendance.filter(a => a.studentId === studentId);
    },
    [attendance]
  );

  const getTodayAttendance = useCallback(
    (classId?: string) => {
      const today = getLocalDateString();
      return getAttendanceByDate(today, classId);
    },
    [getAttendanceByDate]
  );

  const getStudentStatusToday = useCallback(
    (studentId: string): AttendanceRecord | undefined => {
      const today = getLocalDateString();
      return attendance.find(a => a.studentId === studentId && a.date === today);
    },
    [attendance]
  );

  const getAttendanceStats = useCallback(
    (classId?: string) => {
      const relevant = classId ? attendance.filter(a => a.classId === classId) : attendance;

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
        rate: total > 0 ? (present / total) * 100 : 0,
      };
    },
    [attendance]
  );

  const updateAttendance = useCallback(
    async (id: string, updates: Partial<AttendanceRecord>) => {
      if (!user) throw new Error('User not authenticated');

      try {
        const updateData: any = {};
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.faceRecognized !== undefined) updateData.face_recognized = updates.faceRecognized;
        if (updates.matchScore !== undefined) updateData.match_score = updates.matchScore;
        if (updates.isManual !== undefined) updateData.is_manual = updates.isManual;

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase
            .from('attendance')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user.id);

          if (error) throw error;

          // Reload attendance
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .order('recorded_at', { ascending: false });

          if (!attendanceError && attendanceData) {
            const transformedAttendance: AttendanceRecord[] = attendanceData.map(a => ({
              id: a.id,
              studentId: a.student_id,
              studentName: a.student_name,
              classId: a.classroom_id,
              date: a.date,
              status: a.status as AttendanceRecord['status'],
              recordedAt: a.recorded_at,
              faceRecognized: a.face_recognized || false,
              matchScore: a.match_score || undefined,
              isManual: a.is_manual || false,
            }));

            setAttendance(transformedAttendance);
            attendanceCache = transformedAttendance;
            cacheTimestamp = Date.now();
          }
        }
      } catch (error) {
        console.error('Error updating attendance:', error);
        throw error;
      }
    },
    [user]
  );

  const deleteAttendance = useCallback(
    async (id: string) => {
      if (!user) throw new Error('User not authenticated');

      try {
        const { error } = await supabase
          .from('attendance')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        // Reload attendance
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .order('recorded_at', { ascending: false });

        if (!attendanceError && attendanceData) {
          const transformedAttendance: AttendanceRecord[] = attendanceData.map(a => ({
            id: a.id,
            studentId: a.student_id,
            studentName: a.student_name,
            classId: a.classroom_id,
            date: a.date,
            status: a.status as AttendanceRecord['status'],
            recordedAt: a.recorded_at,
            faceRecognized: a.face_recognized || false,
            matchScore: a.match_score || undefined,
            isManual: a.is_manual || false,
          }));

          setAttendance(transformedAttendance);
          attendanceCache = transformedAttendance;
          cacheTimestamp = Date.now();
        }
      } catch (error) {
        console.error('Error deleting attendance:', error);
        throw error;
      }
    },
    [user]
  );

  /** ลบรายการเช็คชื่อของวันนี้ทั้งหมด — ใช้เมื่อต้องการเช็คชื่อวันนี้อีกรอบหรือรีเซ็ตข้อมูลวันใหม่ */
  const clearTodayAttendance = useCallback(
    async (classId?: string) => {
      if (!user) throw new Error('User not authenticated');

      const today = getLocalDateString();

      try {
        let query = supabase
          .from('attendance')
          .delete()
          .eq('user_id', user.id)
          .eq('date', today);

        if (classId) {
          query = query.eq('classroom_id', classId);
        }

        const { error } = await query;

        if (error) throw error;

        // Reload attendance
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .order('recorded_at', { ascending: false });

        if (!attendanceError && attendanceData) {
          const transformedAttendance: AttendanceRecord[] = attendanceData.map(a => ({
            id: a.id,
            studentId: a.student_id,
            studentName: a.student_name,
            classId: a.classroom_id,
            date: a.date,
            status: a.status as AttendanceRecord['status'],
            recordedAt: a.recorded_at,
            faceRecognized: a.face_recognized || false,
            matchScore: a.match_score || undefined,
            isManual: a.is_manual || false,
          }));

          setAttendance(transformedAttendance);
          attendanceCache = transformedAttendance;
          cacheTimestamp = Date.now();
        }
      } catch (error) {
        console.error('Error clearing today attendance:', error);
        throw error;
      }
    },
    [user]
  );

  return {
    attendance,
    loading,
    recordAttendance,
    getAttendanceByDate,
    getAttendanceByStudent,
    getTodayAttendance,
    getStudentStatusToday,
    getStudentStatusTodaySync,
    getAttendanceStats,
    updateAttendance,
    deleteAttendance,
    clearTodayAttendance,
  };
}
