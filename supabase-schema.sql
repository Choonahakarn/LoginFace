-- ============================================
-- Supabase Database Schema สำหรับ Face Attendance System
-- ============================================
-- 
-- คำแนะนำ:
-- 1. ไปที่ Supabase Dashboard → SQL Editor
-- 2. Copy และ Paste SQL นี้ทั้งหมด
-- 3. Run SQL
-- 4. ตั้งค่า Authentication Providers ใน Authentication → Providers
--
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Vector extension สำหรับ face embeddings (ถ้าต้องการ)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- ตาราง: users (เก็บข้อมูลผู้ใช้จาก Supabase Auth)
-- ============================================
-- Note: Supabase Auth จะสร้างตาราง auth.users อัตโนมัติ
-- ตารางนี้ใช้เก็บข้อมูลเพิ่มเติมของผู้ใช้

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'teacher' CHECK (role IN ('platform_admin', 'school_admin', 'teacher')),
  school_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ตาราง: classrooms (ห้องเรียน)
-- ============================================
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  student_count INTEGER DEFAULT 0,
  late_grace_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ตาราง: students (นักเรียน)
-- ============================================
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
  face_enrolled BOOLEAN DEFAULT FALSE,
  face_enrollment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, student_id)
);

-- ============================================
-- ตาราง: student_classrooms (ความสัมพันธ์ many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS public.student_classrooms (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, classroom_id)
);

-- ============================================
-- ตาราง: attendance (การเช็คชื่อ)
-- ============================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  face_recognized BOOLEAN DEFAULT FALSE,
  match_score FLOAT,
  is_manual BOOLEAN DEFAULT FALSE,
  UNIQUE(student_id, classroom_id, date)
);

-- ============================================
-- ตาราง: face_embeddings (เก็บ face embeddings)
-- ============================================
CREATE TABLE IF NOT EXISTS public.face_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  embedding JSONB NOT NULL, -- เก็บเป็น JSON array ของ numbers
  confidence FLOAT NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes สำหรับ Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_classrooms_user_id ON classrooms(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_student_id ON students(user_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date ON attendance(classroom_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_user_id ON face_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_classroom_student ON face_embeddings(classroom_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_classrooms_student ON student_classrooms(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classrooms_classroom ON student_classrooms(classroom_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_classrooms ENABLE ROW LEVEL SECURITY;

-- Policy: ผู้ใช้เห็นและจัดการเฉพาะข้อมูลของตัวเอง
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view their own classrooms"
  ON public.classrooms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own classrooms"
  ON public.classrooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own classrooms"
  ON public.classrooms FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own classrooms"
  ON public.classrooms FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own students"
  ON public.students FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own students"
  ON public.students FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own students"
  ON public.students FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own students"
  ON public.students FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own attendance"
  ON public.attendance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance"
  ON public.attendance FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attendance"
  ON public.attendance FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own face embeddings"
  ON public.face_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own face embeddings"
  ON public.face_embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own face embeddings"
  ON public.face_embeddings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own student_classrooms"
  ON public.student_classrooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_classrooms.student_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own student_classrooms"
  ON public.student_classrooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_classrooms.student_id
      AND students.user_id = auth.uid()
    )
  );

-- ============================================
-- Functions สำหรับ Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classrooms_updated_at
  BEFORE UPDATE ON public.classrooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Function สำหรับสร้าง user_profile เมื่อ user sign up
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
