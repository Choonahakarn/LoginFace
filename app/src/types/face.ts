/** ข้อมูลที่เก็บจริง = Face Embedding + metadata (ไม่เก็บรูป/วิดีโอ ตาม PDPA) */
export interface FaceEnrollmentRecord {
  /** เวกเตอร์ตัวเลข 128 มิติ แปลงย้อนกลับเป็นใบหน้าไม่ได้ ใช้ได้เฉพาะเทียบความเหมือน */
  embedding: number[];
  /** เวอร์ชันโมเดลที่ใช้สร้าง embedding */
  model_version: string;
  /** วันที่ลงทะเบียน (ISO) */
  enrolledAt: string;
  /** ความมั่นใจตอน enroll 0–1 (จาก face detection score) */
  confidence: number;
}

/** @deprecated ใช้ FaceEnrollmentRecord แทน */
export interface FaceEmbedding {
  id: string;
  studentId: string;
  qualityScore?: number;
  enrolledAt: string;
}
