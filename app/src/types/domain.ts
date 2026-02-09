export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'platform_admin' | 'school_admin' | 'teacher';
  schoolId?: string;
}

export interface School {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  settings: SchoolSettings;
}

export interface SchoolSettings {
  faceMatchThreshold: number;
  maxEmbeddingsPerStudent: number;
  lateGraceMinutes: number;
}

export interface Class {
  id: string;
  name: string;
  code?: string;
  gradeLevel?: string;
  primaryTeacherId?: string;
  studentCount: number;
  schedule?: ClassSchedule;
  /** จำนวน “นาทีผ่อนผัน” ก่อนนับเป็นมาสาย (ต่อห้อง) */
  lateGraceMinutes?: number;
}

export interface ClassSchedule {
  [day: string]: { start: string; end: string }[];
}

export interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  status: 'active' | 'inactive' | 'graduated' | 'transferred';
  faceEnrolled: boolean;
  faceEnrollmentCount: number;
  classIds: string[];
}
