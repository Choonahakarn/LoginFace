export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  recordedAt: string;
  faceRecognized: boolean;
  matchScore?: number;
  isManual: boolean;
}

export interface ScanResult {
  matchFound: boolean;
  studentId?: string;
  studentName?: string;
  similarity?: number;
  status?: string;
  message: string;
}
