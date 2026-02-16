# คู่มือการใช้งาน Supabase Authentication

## ✅ สิ่งที่ทำเสร็จแล้ว

1. ✅ ติดตั้ง Supabase client (`@supabase/supabase-js`)
2. ✅ สร้าง Supabase client configuration (`app/src/lib/supabase.ts`)
3. ✅ สร้าง Database schema (`supabase-schema.sql`)
4. ✅ สร้าง Auth hooks (`app/src/hooks/useAuth.ts`)
5. ✅ สร้าง Login/SignUp components พร้อม Social Login
6. ✅ สร้าง ProtectedRoute component
7. ✅ แก้ไข App.tsx เพื่อเพิ่ม Auth protection
8. ✅ สร้าง environment variables template

## 📁 ไฟล์ที่สร้างใหม่

### Frontend Components
- `app/src/lib/supabase.ts` - Supabase client configuration
- `app/src/hooks/useAuth.ts` - Authentication hook
- `app/src/components/auth/LoginForm.tsx` - Login form component
- `app/src/components/auth/SignUpForm.tsx` - Sign up form component
- `app/src/components/auth/AuthPage.tsx` - Auth page wrapper
- `app/src/components/auth/ProtectedRoute.tsx` - Route protection component
- `app/src/pages/AuthCallback.tsx` - OAuth callback handler

### Database & Configuration
- `supabase-schema.sql` - Database schema สำหรับ Supabase
- `app/.env.example` - Environment variables template
- `SUPABASE_SETUP.md` - คู่มือการตั้งค่า Supabase

## 🚀 ขั้นตอนการใช้งาน

### 1. สร้าง Supabase Project

1. ไปที่ [supabase.com](https://supabase.com)
2. สร้างบัญชีใหม่ (ถ้ายังไม่มี)
3. สร้าง Project ใหม่
4. รอให้ project สร้างเสร็จ

### 2. ตั้งค่า Database

1. ไปที่ Supabase Dashboard → **SQL Editor**
2. Copy เนื้อหาจากไฟล์ `supabase-schema.sql`
3. Paste และ Run SQL

### 3. ตั้งค่า Authentication Providers

#### Email/Password (เปิดอยู่แล้ว)
- ไปที่ **Authentication** → **Providers** → **Email**
- ตรวจสอบว่าเปิดอยู่

#### Google OAuth
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง OAuth 2.0 Client ID
3. ตั้งค่า Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID และ Client Secret
5. ไปที่ Supabase → **Authentication** → **Providers** → **Google**
6. เปิดใช้งานและใส่ Client ID และ Secret

#### Facebook OAuth
1. ไปที่ [Facebook Developers](https://developers.facebook.com/)
2. สร้าง App และเพิ่ม Facebook Login
3. ตั้งค่า Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy App ID และ App Secret
5. ไปที่ Supabase → **Authentication** → **Providers** → **Facebook**
6. เปิดใช้งานและใส่ App ID และ Secret

#### Line OAuth
**หมายเหตุ**: Supabase อาจไม่รองรับ Line โดยตรง
- ต้องใช้ Custom OAuth หรือใช้ Google/Facebook แทน
- หรือใช้วิธีอื่นในการล็อกอินด้วย Line

### 4. ตั้งค่า Environment Variables

1. Copy `.env.example` เป็น `.env`:
   ```bash
   cp app/.env.example app/.env
   ```

2. แก้ไข `app/.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. หา API Keys จาก Supabase Dashboard → **Settings** → **API**

### 5. ตั้งค่า Redirect URLs

1. ไปที่ Supabase Dashboard → **Authentication** → **URL Configuration**
2. เพิ่ม Redirect URLs:
   ```
   http://localhost:5173/auth/callback
   http://localhost:5173/*
   https://your-domain.com/auth/callback
   https://your-domain.com/*
   ```

### 6. รันโปรเจกต์

```bash
cd app
npm install
npm run dev
```

## 🔐 Security Features

- ✅ Row Level Security (RLS) - ผู้ใช้เห็นเฉพาะข้อมูลของตัวเอง
- ✅ JWT Tokens - Secure authentication
- ✅ Password Hashing - bcrypt
- ✅ Email Verification - (แนะนำให้เปิดใช้งาน)
- ✅ Session Management - Auto refresh tokens

## 📝 หมายเหตุสำคัญ

1. **Line OAuth**: Supabase อาจไม่รองรับ Line โดยตรง ต้องใช้วิธีอื่นหรือใช้ Google/Facebook แทน
2. **Environment Variables**: ต้องตั้งค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`
3. **Database Schema**: ต้องรัน SQL schema ก่อนใช้งาน
4. **RLS Policies**: ตั้งค่าให้ผู้ใช้เห็นเฉพาะข้อมูลของตัวเองแล้ว

## 🆘 Troubleshooting

### Error: Missing Supabase environment variables
- ตรวจสอบว่าไฟล์ `.env` มีอยู่และตั้งค่าถูกต้อง
- ตรวจสอบว่า environment variables ขึ้นต้นด้วย `VITE_`

### OAuth ไม่ทำงาน
- ตรวจสอบว่า Redirect URL ตั้งค่าถูกต้อง
- ตรวจสอบว่า Client ID และ Secret ถูกต้อง
- ตรวจสอบว่า Provider เปิดใช้งานแล้ว

### Database Error
- ตรวจสอบว่า SQL schema รันเสร็จแล้ว
- ตรวจสอบว่า RLS Policies ตั้งค่าถูกต้อง

## 📚 เอกสารเพิ่มเติม

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
