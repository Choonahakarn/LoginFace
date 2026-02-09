/**
 * ค่าคงที่สำหรับระบบเช็คชื่อใบหน้า
 * Central constants for the face attendance system
 */

/** เวอร์ชันแอป */
export const APP_VERSION = 'v.1.0';

/** คีย์สำหรับเก็บข้อมูลใน localStorage */
export const STORAGE_KEYS = {
  ATTENDANCE: 'attendance_records',
  CLASSROOMS: 'attendance_classrooms',
  SELECTED_CLASS: 'attendance_selected_class_id',
  STUDENTS: 'attendance_students',
  FACE_DATABASE: 'face_database',
} as const;
