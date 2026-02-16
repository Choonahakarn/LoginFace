# คู่มือการตั้งค่า Supabase สำหรับ Face Attendance System

## 📋 ขั้นตอนการตั้งค่า

### 1. สร้าง Supabase Project

1. ไปที่ [supabase.com](https://supabase.com)
2. สร้างบัญชีใหม่ (ถ้ายังไม่มี)
3. คลิก **New Project**
4. ตั้งค่า:
   - **Name**: Face Attendance System
   - **Database Password**: ตั้งรหัสผ่านที่แข็งแรง
   - **Region**: เลือก region ที่ใกล้ที่สุด (เช่น Southeast Asia)
5. คลิก **Create new project**
6. รอให้ project สร้างเสร็จ (ประมาณ 2-3 นาที)

### 2. ตั้งค่า Database Schema

1. ไปที่ Supabase Dashboard → **SQL Editor**
2. คลิก **New Query**
3. Copy เนื้อหาจากไฟล์ `supabase-schema.sql` ทั้งหมด
4. Paste ลงใน SQL Editor
5. คลิก **Run** (หรือกด Ctrl+Enter)
6. ตรวจสอบว่าไม่มี error

### 3. ตั้งค่า Authentication Providers

#### A. Email/Password (เปิดอยู่แล้ว)
- ไปที่ **Authentication** → **Providers**
- ตรวจสอบว่า **Email** เปิดอยู่

#### B. Google OAuth

1. ไปที่ **Authentication** → **Providers**
2. คลิก **Google**
3. เปิดใช้งาน Google Provider
4. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
5. สร้าง OAuth 2.0 Client ID:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```
6. Copy **Client ID** และ **Client Secret**
7. ใส่ใน Supabase Dashboard:
   - **Client ID (for OAuth)**: ใส่ Client ID
   - **Client Secret (for OAuth)**: ใส่ Client Secret
8. คลิก **Save**

#### C. Facebook OAuth

1. ไปที่ [Facebook Developers](https://developers.facebook.com/)
2. สร้าง App ใหม่
3. เพิ่ม **Facebook Login** product
4. ตั้งค่า:
   - **Valid OAuth Redirect URIs**: 
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```
5. Copy **App ID** และ **App Secret**
6. ไปที่ Supabase Dashboard → **Authentication** → **Providers** → **Facebook**
7. เปิดใช้งานและใส่:
   - **Client ID (for OAuth)**: App ID
   - **Client Secret (for OAuth)**: App Secret
8. คลิก **Save**

#### D. Line OAuth

1. ไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง Provider และ Channel
3. ตั้งค่า:
   - **Callback URL**: 
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```
4. Copy **Channel ID** และ **Channel Secret**
5. ไปที่ Supabase Dashboard → **Authentication** → **Providers**
6. **หมายเหตุ**: Supabase อาจไม่รองรับ Line โดยตรง
   - ต้องใช้ Custom OAuth หรือใช้วิธีอื่น
   - หรือใช้ Google/Facebook แทน

### 4. ตั้งค่า Environment Variables

#### Frontend (app/.env)

1. Copy ไฟล์ `.env.example` เป็น `.env`:
   ```bash
   cp app/.env.example app/.env
   ```

2. แก้ไขไฟล์ `app/.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. หา API Keys:
   - ไปที่ Supabase Dashboard → **Settings** → **API**
   - Copy **Project URL** → ใส่ใน `VITE_SUPABASE_URL`
   - Copy **anon public** key → ใส่ใน `VITE_SUPABASE_ANON_KEY`

#### Backend (backend/.env)

1. แก้ไขไฟล์ `backend/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

2. หา Service Role Key:
   - ไปที่ Supabase Dashboard → **Settings** → **API**
   - Copy **Project URL** → ใส่ใน `SUPABASE_URL`
   - Copy **service_role** key (secret) → ใส่ใน `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ **ห้าม** นำ service_role key ไปใช้ใน Frontend หรือ commit ลง git

### 5. ตั้งค่า Redirect URLs

1. ไปที่ Supabase Dashboard → **Authentication** → **URL Configuration**
2. เพิ่ม **Redirect URLs**:
   ```
   http://localhost:5173/auth/callback
   http://localhost:5173/*
   https://your-domain.com/auth/callback
   https://your-domain.com/*
   ```

### 6. ทดสอบระบบ

1. รัน Frontend:
   ```bash
   cd app
   npm run dev
   ```

2. เปิดเบราว์เซอร์ไปที่ `http://localhost:5173`
3. ทดสอบ:
   - สมัครสมาชิกด้วย Email/Password
   - Login ด้วย Email/Password
   - Login ด้วย Google (ถ้าตั้งค่าแล้ว)
   - Login ด้วย Facebook (ถ้าตั้งค่าแล้ว)

## 🔒 Security Checklist

- [ ] ตั้งค่า RLS Policies แล้ว (ใน SQL schema)
- [ ] ใช้ Anon Key ใน Frontend เท่านั้น
- [ ] เก็บ Service Role Key เป็นความลับ (ไม่ใส่ใน Frontend)
- [ ] ตั้งค่า Redirect URLs ให้ถูกต้อง
- [ ] เปิดใช้งาน Email Verification (แนะนำ)
- [ ] ตั้งค่า Password Policy (แนะนำ)

## 📝 หมายเหตุ

- **Line OAuth**: Supabase อาจไม่รองรับ Line โดยตรง ต้องใช้วิธีอื่นหรือใช้ Google/Facebook แทน
- **Email Verification**: แนะนำให้เปิดใช้งานเพื่อความปลอดภัย
- **Password Policy**: แนะนำให้ตั้งค่ารหัสผ่านขั้นต่ำ 8 ตัวอักษร

## 🆘 Troubleshooting

### Error: Missing Supabase environment variables
- ตรวจสอบว่าไฟล์ `.env` มีอยู่และตั้งค่าถูกต้อง
- ตรวจสอบว่า environment variables ขึ้นต้นด้วย `VITE_`

### Error: Invalid API key
- ตรวจสอบว่าใช้ Anon Key (ไม่ใช่ Service Role Key)
- ตรวจสอบว่า copy key มาเต็ม (ไม่มี space)

### OAuth ไม่ทำงาน
- ตรวจสอบว่า Redirect URL ตั้งค่าถูกต้อง
- ตรวจสอบว่า Client ID และ Secret ถูกต้อง
- ตรวจสอบว่า Provider เปิดใช้งานแล้ว

## 📚 เอกสารเพิ่มเติม

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
