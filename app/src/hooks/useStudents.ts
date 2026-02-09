import { useState, useCallback } from 'react';
import type { Student } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';

const MOCK_STUDENTS: Student[] = [
  { id: '1', studentId: 'STD001', firstName: 'สมศักดิ์', lastName: 'รักเรียน', status: 'active', faceEnrolled: false, faceEnrollmentCount: 0, classIds: ['class-1'] },
  { id: '2', studentId: 'STD002', firstName: 'มานี', lastName: 'ใจดี', status: 'active', faceEnrolled: false, faceEnrollmentCount: 0, classIds: ['class-1'] },
  { id: '3', studentId: 'STD003', firstName: 'ประเสริฐ', lastName: 'ตั้งใจ', status: 'active', faceEnrolled: false, faceEnrollmentCount: 0, classIds: ['class-1'] },
  { id: '4', studentId: 'STD004', firstName: 'วันดี', lastName: 'สุขสันต์', status: 'active', faceEnrolled: false, faceEnrollmentCount: 0, classIds: ['class-1'] },
  { id: '5', studentId: 'STD005', firstName: 'ประทีป', lastName: 'แสงสว่าง', status: 'active', faceEnrolled: false, faceEnrollmentCount: 0, classIds: ['class-1'] },
];

type StudentPersist = Pick<Student, 'id' | 'studentId' | 'firstName' | 'lastName' | 'status' | 'classIds'> & { email?: string };

function persistStudents(list: Student[]) {
  const toSave: StudentPersist[] = list.map(({ id, studentId, firstName, lastName, email, status, classIds }) => ({
    id, studentId, firstName, lastName, email, status, classIds
  }));
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(toSave));
}

function loadStudents(): Student[] {
  const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  let list: StudentPersist[];
  if (saved) {
    try {
      list = JSON.parse(saved);
      if (!Array.isArray(list) || list.length === 0) list = MOCK_STUDENTS as unknown as StudentPersist[];
    } catch {
      list = MOCK_STUDENTS as unknown as StudentPersist[];
    }
  } else {
    list = MOCK_STUDENTS as unknown as StudentPersist[];
  }
  return list.map(s => ({
    ...s,
    id: String(s.id),
    faceEnrolled: false,
    faceEnrollmentCount: 0
  }));
}

export function useStudents() {
  const [students, setStudents] = useState<Student[]>(() => loadStudents());

  const getStudentsByClass = useCallback((classId: string) => {
    return students.filter(s => s.classIds.includes(classId));
  }, [students]);

  const getStudentById = useCallback((id: string) => {
    return students.find(s => s.id === id);
  }, [students]);

  const addStudent = useCallback((student: Omit<Student, 'id' | 'faceEnrolled' | 'faceEnrollmentCount'>) => {
    const newStudent: Student = {
      ...student,
      id: `student-${Date.now()}`,
      faceEnrolled: false,
      faceEnrollmentCount: 0
    };
    setStudents(prev => {
      const next = [...prev, newStudent];
      persistStudents(next);
      return next;
    });
    return newStudent;
  }, []);

  const updateStudent = useCallback((id: string, updates: Partial<Pick<Student, 'studentId' | 'firstName' | 'lastName' | 'email' | 'status' | 'classIds'>>) => {
    setStudents(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updates } : s);
      persistStudents(next);
      return next;
    });
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents(prev => {
      const next = prev.filter(s => s.id !== id);
      persistStudents(next);
      return next;
    });
  }, []);

  return {
    students,
    getStudentsByClass,
    getStudentById,
    addStudent,
    updateStudent,
    deleteStudent,
  };
}
