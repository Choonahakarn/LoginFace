-- อัปเดตชื่อผู้ใช้ทดสอบ (teacher@school.edu) เป็น "บัญชีทดสอบระบบ"
-- วิธีใช้: ไปที่ Supabase Dashboard → SQL Editor → วาง script นี้ → Run

-- อัปเดตใน user_profiles (ชื่อที่แสดงในแอป)
UPDATE public.user_profiles
SET
  first_name = 'บัญชีทดสอบระบบ',
  last_name = '',
  updated_at = NOW()
WHERE email = 'teacher@school.edu';

-- อัปเดตใน auth.users (metadata เพื่อให้ sync กับ session)
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"first_name": "บัญชีทดสอบระบบ", "last_name": ""}'::jsonb
WHERE email = 'teacher@school.edu';
