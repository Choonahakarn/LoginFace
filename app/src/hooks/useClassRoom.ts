import { useState, useCallback, useEffect } from 'react';
import type { Class } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';

function loadClassrooms(): Class[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CLASSROOMS);
    if (saved) {
      const list = JSON.parse(saved);
      return Array.isArray(list) ? list : [];
    }
  } catch {
    // ignore
  }
  return [];
}

function saveClassrooms(list: Class[]) {
  localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(list));
}

function loadSelectedClassId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_CLASS);
  } catch {
    return null;
  }
}

export function useClassRoom() {
  const [classrooms, setClassrooms] = useState<Class[]>(loadClassrooms);
  const [selectedClassId, setSelectedClassIdState] = useState<string | null>(loadSelectedClassId);

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

  const addClassroom = useCallback((name: string): Class => {
    const id = `class-${Date.now()}`;
    const newClass: Class = {
      id,
      name: name.trim(),
      studentCount: 0,
      lateGraceMinutes: 15,
    };
    setClassrooms((prev) => {
      const next = [...prev, newClass];
      saveClassrooms(next);
      return next;
    });
    return newClass;
  }, []);

  const updateClassroomName = useCallback((classId: string, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    setClassrooms((prev) => {
      const next = prev.map((c) => (c.id === classId ? { ...c, name: nextName } : c));
      saveClassrooms(next);
      return next;
    });
  }, []);

  const updateLateGraceMinutes = useCallback((classId: string, minutes: number) => {
    const safe = Number.isFinite(minutes) ? Math.max(0, Math.min(180, Math.round(minutes))) : 15;
    setClassrooms((prev) => {
      const next = prev.map((c) => (c.id === classId ? { ...c, lateGraceMinutes: safe } : c));
      saveClassrooms(next);
      return next;
    });
  }, []);

  const deleteClassroom = useCallback((classId: string) => {
    // 1) remove from classrooms list
    setClassrooms((prev) => {
      const next = prev.filter((c) => c.id !== classId);
      saveClassrooms(next);
      return next;
    });

    // 2) clear selected class if deleting current selection
    setSelectedClassIdState((prev) => {
      if (prev === classId) {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_CLASS);
        return null;
      }
      return prev;
    });

    // 3) cleanup attendance records for this class
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          const next = list.filter((a: any) => a?.classId !== classId);
          localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(next));
        }
      }
    } catch {
      // ignore
    }

    // 4) remove this classId from students roster (keep students if they belong to other classes)
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          const next = list.map((s: any) => {
            const classIds: string[] = Array.isArray(s?.classIds) ? s.classIds : [];
            return { ...s, classIds: classIds.filter((id) => id !== classId) };
          });
          localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(next));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const getClassrooms = useCallback(() => classrooms, [classrooms]);
  const getSelectedClass = useCallback((): Class | null => {
    if (!selectedClassId) return null;
    return classrooms.find((c) => c.id === selectedClassId) ?? null;
  }, [classrooms, selectedClassId]);

  return {
    classrooms,
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
