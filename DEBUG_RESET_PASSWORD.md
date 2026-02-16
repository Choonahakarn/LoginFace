# คู่มือ Debug ปัญหา Reset Password Email ไม่ถูกส่ง

## ขั้นตอนการตรวจสอบ

### 1. ตรวจสอบ Browser Console

1. เปิด Browser DevTools (กด `F12`)
2. ไปที่ **Console** tab
3. กด "ส่งลิงก์รีเซ็ตรหัสผ่าน"
4. ดู log messages ที่ขึ้นต้นด้วย `[ForgotPassword]`:
   - `[ForgotPassword] Requesting password reset:` - แสดง email และ redirect URL
   - `[ForgotPassword] Response:` - แสดง response จาก Supabase
   - `[ForgotPassword] Reset password error:` - แสดง error details (ถ้ามี)

### 2. ตรวจสอบ Supabase Auth Logs

1. เข้า **Supabase Dashboard** → [https://app.supabase.com](https://app.supabase.com)
2. เลือกโปรเจคของคุณ
3. ไปที่ **Logs** → **Auth Logs**
4. ค้นหาการเรียก `resetPasswordForEmail` หรือ `password_reset`
5. ดู:
   - **Status**: สำเร็จ (200) หรือ error (4xx/5xx)
   - **Error Message**: ถ้ามี error จะแสดงรายละเอียด
   - **Timestamp**: ตรวจสอบว่า request ถูกส่งไปจริงหรือไม่

### 3. ตรวจสอบ SMTP Settings

1. ไปที่ **Authentication** → **Settings** → **SMTP Settings**
2. ตรวจสอบว่า:
   - ✅ **Enable Custom SMTP** ถูกเปิด
   - ✅ **Host**: `smtp.resend.com` (สำหรับ Resend)
   - ✅ **Port**: `587` หรือ `465`
   - ✅ **Username**: `resend`
   - ✅ **Password**: API Key จาก Resend Dashboard (ไม่ใช่ password จริง)
   - ✅ **Sender email**: ต้องเป็น verified email ใน Resend

### 4. ตรวจสอบ Email Template

1. ไปที่ **Authentication** → **Email Templates**
2. เลือก **"Reset password"** template
3. ตรวจสอบว่า:
   - ✅ มี `{{ .ConfirmationURL }}` ใน template
   - ✅ ไม่มี hardcoded URL ที่ผิด (เช่น localhost ใน production)
   - ✅ Template ถูก save แล้ว

### 5. ตรวจสอบ Redirect URLs

1. ไปที่ **Authentication** → **URL Configuration**
2. ตรวจสอบว่า:
   - ✅ `http://localhost:5173/` อยู่ใน Redirect URLs (สำหรับ localhost)
   - ✅ `https://facein.co/` อยู่ใน Redirect URLs (สำหรับ production)
   - ✅ Site URL ถูกต้อง (`http://localhost:5173` สำหรับ localhost)

## ปัญหาที่พบบ่อย

### ปัญหา 1: "Email sent successfully" แต่ไม่ได้รับอีเมล

**สาเหตุที่เป็นไปได้:**
- อีเมลไปตก Spam/Junk Mail
- SMTP settings ไม่ถูกต้อง (แต่ Supabase ไม่ error)
- Email template ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบโฟลเดอร์ Spam/Junk Mail
2. ตรวจสอบ Auth Logs ใน Supabase ว่ามี error หรือไม่
3. ทดสอบส่งอีเมลด้วย email อื่น
4. ตรวจสอบ SMTP settings อีกครั้ง

### ปัญหา 2: Error "user not found" หรือ "email not found"

**สาเหตุ:**
- อีเมลนี้ยังไม่ได้สมัครสมาชิกในระบบ

**วิธีแก้:**
- สมัครสมาชิกด้วยอีเมลนี้ก่อน หรือใช้อีเมลที่สมัครแล้ว

### ปัญหา 3: Error "SMTP" หรือ "Email sending failed"

**สาเหตุ:**
- SMTP settings ไม่ถูกต้อง
- Sender email ไม่ถูก verify
- API Key ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบ SMTP credentials ใน Supabase
2. ตรวจสอบว่า sender email ถูก verify ใน Resend Dashboard
3. ตรวจสอบ API Key ใน Resend Dashboard

### ปัญหา 4: Error "Rate limit exceeded"

**สาเหตุ:**
- ส่งคำขอมากเกินไป

**วิธีแก้:**
- รอสักครู่แล้วลองใหม่

## การทดสอบ

### ทดสอบด้วย Console Commands

เปิด Browser Console และรัน:

```javascript
// ทดสอบ reset password
const supabase = window.__SUPABASE_CLIENT__; // หรือ import จาก lib/supabase
const email = 'your@email.com';
const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: window.location.origin + '/',
});
console.log('Result:', { data, error });
```

### ทดสอบด้วย Supabase Dashboard

1. ไปที่ **Authentication** → **Users**
2. คลิกที่ user ที่ต้องการ
3. คลิก **"Send password reset email"** (ถ้ามี)
4. ตรวจสอบว่าอีเมลถูกส่งหรือไม่

## Checklist

- [ ] Browser Console ไม่มี error
- [ ] Auth Logs ใน Supabase แสดง request สำเร็จ
- [ ] SMTP Settings ถูกต้อง
- [ ] Email Template มี `{{ .ConfirmationURL }}`
- [ ] Redirect URLs ถูกต้อง
- [ ] Site URL ถูกต้อง
- [ ] ตรวจสอบ Spam/Junk Mail แล้ว
- [ ] อีเมลที่ใช้สมัครสมาชิกแล้ว

## หมายเหตุ

- Supabase Free Tier มี rate limit สำหรับการส่งอีเมล (~3 อีเมล/ชั่วโมง)
- ถ้าใช้ Custom SMTP (Resend) จะไม่มี rate limit จาก Supabase แต่มี limit จาก Resend
- อีเมล reset password จะหมดอายุใน 1 ชั่วโมง (default)
