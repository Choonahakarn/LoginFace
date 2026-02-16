import { useState, useCallback, useEffect, useRef } from 'react';
import type { Class } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

function loadSelectedClassId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_CLASS);
  } catch {
    return null;
  }
}

export function useClassRoom() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassIdState] = useState<string | null>(loadSelectedClassId);
  const [loading, setLoading] = useState(true);

  // Track if we've already loaded data for this user to prevent refetch on reconnect
  const hasLoadedRef = useRef<{ userId: string | null; hasLoaded: boolean }>({ userId: null, hasLoaded: false });

  // Load classrooms from Supabase
  useEffect(() => {
    if (!user) {
      setClassrooms([]);
      setLoading(false);
      hasLoadedRef.current = { userId: null, hasLoaded: false };
      return;
    }

    // Reset flag if user changed (not just reconnect)
    if (hasLoadedRef.current.userId !== null && hasLoadedRef.current.userId !== user.id) {
      console.log('[useClassRoom] User changed, resetting cache');
      hasLoadedRef.current = { userId: null, hasLoaded: false };
    }

    // If we've already loaded data for this user, don't reload
    if (hasLoadedRef.current.userId === user.id && hasLoadedRef.current.hasLoaded) {
      console.log('[useClassRoom] Using cached data for user:', user.id);
      return;
    }

    const loadClassrooms = async () => {
      try {
        // Start loading immediately - don't wait
        setLoading(true);
        
        const { data, error } = await supabase
          .from('classrooms')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading classrooms:', error);
          setClassrooms([]);
          setLoading(false);
          return;
        }

        // Transform to Class format
        const transformedClassrooms: Class[] = (data || []).map(c => ({
          id: c.id,
          name: c.name,
          code: c.code || undefined,
          studentCount: c.student_count || 0,
          lateGraceMinutes: c.late_grace_minutes || 15,
        }));

        setClassrooms(transformedClassrooms);
        setLoading(false);
        // Mark as loaded for this user
        hasLoadedRef.current = { userId: user.id, hasLoaded: true };
        return Promise.resolve(); // Return promise for tracking
      } catch (error) {
        console.error('Error loading classrooms:', error);
        setClassrooms([]);
        setLoading(false);
        return Promise.resolve(); // Return promise even on error
      }
    };

    const initialLoad = loadClassrooms();

    // Subscribe to changes
    // IMPORTANT: Do NOT refetch automatically - use existing data
    // The subscription is kept for future use, but we don't refetch on events
    // Data will be refetched only when user performs actions (add/update/delete)
    // This prevents unnecessary refetching when switching tabs or on reconnect
    const subscription = supabase
      .channel('classrooms_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'classrooms',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Do nothing - use existing data
          // Data will be updated when user performs actions (addClassroom, updateClassroomName, etc.)
          // This prevents refetching when switching tabs or on reconnect
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const id = loadSelectedClassId();
    setSelectedClassIdState(id);
  }, []);

  const setSelectedClassId = useCallback((id: string | null) => {
    setSelectedClassIdState(id);
    if (id === null) {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_CLASS);
    } else {
      localStorage.setItem(STORAGE_KEYS.SELECTED_CLASS, id);
    }
  }, []);

  const addClassroom = useCallback(
    async (name: string): Promise<Class> => {
      // ตรวจสอบ user อีกครั้งก่อน insert
      if (!user) {
        console.error('addClassroom: user is null', { user });
        throw new Error('User not authenticated');
      }

      try {
        const { data, error } = await supabase
          .from('classrooms')
          .insert({
            user_id: user.id,
            name: name.trim(),
            student_count: 0,
            late_grace_minutes: 15,
          })
          .select()
          .single();

        if (error) throw error;

        const newClass: Class = {
          id: data.id,
          name: data.name,
          code: data.code || undefined,
          studentCount: data.student_count || 0,
          lateGraceMinutes: data.late_grace_minutes || 15,
        };

        // Reload classrooms
        const { data: classroomsData, error: classroomsError } = await supabase
          .from('classrooms')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!classroomsError && classroomsData) {
          const transformedClassrooms: Class[] = classroomsData.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code || undefined,
            studentCount: c.student_count || 0,
            lateGraceMinutes: c.late_grace_minutes || 15,
          }));
          setClassrooms(transformedClassrooms);
        }

        return newClass;
      } catch (error) {
        console.error('Error adding classroom:', error);
        throw error;
      }
    },
    [user]
  );

  const updateClassroomName = useCallback(
    async (classId: string, name: string) => {
      if (!user) throw new Error('User not authenticated');

      const nextName = name.trim();
      if (!nextName) return;

      try {
        const { error } = await supabase
          .from('classrooms')
          .update({ name: nextName })
          .eq('id', classId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Reload classrooms
        const { data: classroomsData, error: classroomsError } = await supabase
          .from('classrooms')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!classroomsError && classroomsData) {
          const transformedClassrooms: Class[] = classroomsData.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code || undefined,
            studentCount: c.student_count || 0,
            lateGraceMinutes: c.late_grace_minutes || 15,
          }));
          setClassrooms(transformedClassrooms);
        }
      } catch (error) {
        console.error('Error updating classroom name:', error);
        throw error;
      }
    },
    [user]
  );

  const updateLateGraceMinutes = useCallback(
    async (classId: string, minutes: number) => {
      if (!user) throw new Error('User not authenticated');

      const safe = Number.isFinite(minutes) ? Math.max(0, Math.min(180, Math.round(minutes))) : 15;

      try {
        const { error } = await supabase
          .from('classrooms')
          .update({ late_grace_minutes: safe })
          .eq('id', classId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Reload classrooms
        const { data: classroomsData, error: classroomsError } = await supabase
          .from('classrooms')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!classroomsError && classroomsData) {
          const transformedClassrooms: Class[] = classroomsData.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code || undefined,
            studentCount: c.student_count || 0,
            lateGraceMinutes: c.late_grace_minutes || 15,
          }));
          setClassrooms(transformedClassrooms);
        }
      } catch (error) {
        console.error('Error updating late grace minutes:', error);
        throw error;
      }
    },
    [user]
  );

  const deleteClassroom = useCallback(
    async (classId: string) => {
      if (!user) throw new Error('User not authenticated');

      try {
        // Delete classroom (cascade will delete student_classrooms and attendance)
        const { error } = await supabase
          .from('classrooms')
          .delete()
          .eq('id', classId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Clear selected class if deleting current selection
        setSelectedClassIdState((prev) => {
          if (prev === classId) {
            localStorage.removeItem(STORAGE_KEYS.SELECTED_CLASS);
            return null;
          }
          return prev;
        });

        // Reload classrooms
        const { data: classroomsData, error: classroomsError } = await supabase
          .from('classrooms')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!classroomsError && classroomsData) {
          const transformedClassrooms: Class[] = classroomsData.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code || undefined,
            studentCount: c.student_count || 0,
            lateGraceMinutes: c.late_grace_minutes || 15,
          }));
          setClassrooms(transformedClassrooms);
        }
      } catch (error) {
        console.error('Error deleting classroom:', error);
        throw error;
      }
    },
    [user]
  );

  const getClassrooms = useCallback(() => classrooms, [classrooms]);
  const getSelectedClass = useCallback((): Class | null => {
    if (!selectedClassId) return null;
    return classrooms.find((c) => c.id === selectedClassId) ?? null;
  }, [classrooms, selectedClassId]);

  return {
    classrooms,
    loading,
    selectedClassId,
    selectedClass: getSelectedClass(),
    setSelectedClassId,
    addClassroom,
    updateClassroomName,
    updateLateGraceMinutes,
    deleteClassroom,
    getClassrooms,
    getSelectedClass,
  };
}
