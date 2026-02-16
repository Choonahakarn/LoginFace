# คู่มือแก้ไขปัญหา Reset Password Email ไม่ถูกส่ง

## ปัญหา
เมื่อกด "ลืมรหัสผ่าน" และกรอกอีเมลแล้ว ไม่ได้รับอีเมลรีเซ็ตรหัสผ่าน

## สาเหตุที่เป็นไปได้

### 1. ไม่ได้ตั้งค่า Redirect URL ใน Supabase Dashboard

**วิธีแก้ไข:**
1. เข้า **Supabase Dashboard** → [https://app.supabase.com](https://app.supabase.com)
2. เลือกโปรเจคของคุณ
3. ไปที่ **Authentication** → **URL Configuration**
4. ในส่วน **"Redirect URLs"** ให้เพิ่ม:
   - `https://facein.co/` (สำหรับ production)
   - `http://localhost:5173/` (สำหรับ localhost)
   - `https://login-face-nu.vercel.app/` (สำหรับ Vercel preview)

5. **สำคัญ:** ต้องมี `/` ต่อท้าย URL (root path)

### 2. SMTP Settings ไม่ถูกต้อง

**ตรวจสอบ:**
1. ไปที่ **Authentication** → **Settings** → **SMTP Settings**
2. ตรวจสอบว่า:
   - ✅ **Enable Custom SMTP** ถูกเปิด
   - ✅ **Host, Port, Username, Password** ถูกต้อง
   - ✅ **Sender email** ถูก verify แล้ว (สำหรับ Resend.com)

**สำหรับ Resend.com:**
- **Host**: `smtp.resend.com`
- **Port**: `587` หรือ `465`
- **Username**: `resend`
- **Password**: API Key จาก Resend Dashboard (ไม่ใช่ password จริง)
- **Sender email**: ต้องเป็น verified email ใน Resend (เช่น `noreply@facein.co`)

### 3. Email Template ไม่ถูกต้อง

**ตรวจสอบ:**
1. ไปที่ **Authentication** → **Email Templates**
2. เลือก **"Reset password"** template
3. ตรวจสอบว่า:
   - ✅ มี `{{ .ConfirmationURL }}` ใน template
   - ✅ URL ไม่ถูก hardcode เป็น localhost

**ตัวอย่าง Template ที่ถูกต้อง:**
```
คลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่านของคุณ:

{{ .ConfirmationURL }}

ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง
```

### 4. Rate Limit

Supabase มี rate limit สำหรับการส่งอีเมล:
- **Free Tier**: ~3 อีเมล/ชั่วโมง
- ถ้าส่งมากเกินไป จะต้องรอ

**วิธีแก้ไข:**
- รอสักครู่แล้วลองใหม่
- ตรวจสอบ **Logs** → **Auth Logs** ใน Supabase Dashboard

### 5. อีเมลไปตก Spam/Junk Mail

**วิธีแก้ไข:**
- ตรวจสอบโฟลเดอร์ Spam/Junk Mail
- เพิ่ม sender email เป็น contact ในอีเมลของคุณ
- ตรวจสอบ SPF/DKIM records ใน DNS (สำหรับ custom domain)

## วิธีตรวจสอบว่า Supabase ส่งอีเมลหรือไม่

### 1. ตรวจสอบ Auth Logs
1. ไปที่ **Supabase Dashboard** → **Logs** → **Auth Logs**
2. ค้นหาการเรียก `resetPasswordForEmail`
3. ดู error message (ถ้ามี)

### 2. ตรวจสอบ Console Logs
1. เปิด Browser DevTools (F12)
2. ไปที่ Console tab
3. ดู error messages เมื่อกด "ส่งลิงก์รีเซ็ตรหัสผ่าน"

### 3. ทดสอบด้วย Supabase CLI (ถ้ามี)
```bash
supabase auth reset-password --email your@email.com
```

## ขั้นตอนการแก้ไขแบบละเอียด

### Step 1: ตั้งค่า Redirect URL
```
1. Supabase Dashboard → Authentication → URL Configuration
2. เพิ่ม Redirect URLs:
   - https://facein.co/
   - http://localhost:5173/
3. บันทึก
```

### Step 2: ตรวจสอบ SMTP Settings
```
1. Supabase Dashboard → Authentication → Settings → SMTP Settings
2. ตรวจสอบ:
   - Enable Custom SMTP: ✅ ON
   - Host: smtp.resend.com
   - Port: 587
   - Username: resend
   - Password: [Resend API Key]
   - Sender email: noreply@facein.co (verified)
3. ทดสอบส่งอีเมล (ถ้ามีฟีเจอร์)
```

### Step 3: ตรวจสอบ Email Template
```
1. Supabase Dashboard → Authentication → Email Templates
2. เลือก "Reset password"
3. ตรวจสอบว่าใช้ {{ .ConfirmationURL }}
4. บันทึก
```

### Step 4: ทดสอบอีกครั้ง
```
1. เปิดเว็บไซต์
2. กด "ลืมรหัสผ่าน"
3. กรอกอีเมล
4. ตรวจสอบอีเมล (Inbox และ Spam)
5. ตรวจสอบ Auth Logs ใน Supabase
```

## Error Messages ที่พบบ่อย

### "Error sending email"
- **สาเหตุ**: SMTP settings ไม่ถูกต้อง หรือ sender email ไม่ถูก verify
- **วิธีแก้**: ตรวจสอบ SMTP credentials และ verify sender email ใน Resend Dashboard

### "Invalid redirect URL"
- **สาเหตุ**: Redirect URL ไม่ได้ถูกเพิ่มใน Supabase Dashboard
- **วิธีแก้**: เพิ่ม URL ใน Authentication → URL Configuration

### "Rate limit exceeded"
- **สาเหตุ**: ส่งอีเมลมากเกินไป
- **วิธีแก้**: รอสักครู่แล้วลองใหม่

### "Email not found"
- **สาเหตุ**: อีเมลนี้ยังไม่ได้สมัครสมาชิก
- **วิธีแก้**: ตรวจสอบว่าอีเมลถูกต้อง หรือสมัครสมาชิกก่อน

## หมายเหตุ

- **Production**: ต้องใช้ Custom SMTP (ไม่ใช่ Supabase Email)
- **Testing**: สามารถใช้ Supabase Email สำหรับทดสอบได้
- **Security**: Reset password link จะหมดอายุใน 1 ชั่วโมง (default)

## ลิงก์ที่เกี่ยวข้อง

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Password Reset](https://supabase.com/docs/guides/auth/auth-password-reset)
- [Supabase SMTP Settings](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend.com Documentation](https://resend.com/docs)
