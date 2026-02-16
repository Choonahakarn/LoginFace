# คู่มือการตั้งค่า Email Verification ใน Supabase

## ปัญหา
เมื่อสมัครสมาชิกใหม่ ไม่มีการส่งอีเมลยืนยัน (OTP/Confirmation Email) ไปให้

## สาเหตุ
Email Verification ยังไม่ได้เปิดใน Supabase Dashboard

## วิธีแก้ไข

### ขั้นตอนที่ 1: เปิด Email Verification

1. เข้า **Supabase Dashboard** → [https://app.supabase.com](https://app.supabase.com)
2. เลือกโปรเจคของคุณ
3. ไปที่ **Authentication** → **Settings** (หรือ **Providers** → **Email**)
4. หา **"Enable email confirmations"** หรือ **"Confirm email"**
5. **เปิด (Enable)** การยืนยันอีเมล

### ขั้นตอนที่ 2: ตั้งค่า Email Provider

Supabase ใช้ Email Provider ในการส่งอีเมล:

#### ตัวเลือกที่ 1: ใช้ Supabase Email (ฟรี แต่มีข้อจำกัด)
- ใช้ได้ทันที ไม่ต้องตั้งค่าเพิ่มเติม
- จำกัดจำนวนอีเมลที่ส่งได้ต่อวัน
- เหมาะสำหรับการทดสอบ

#### ตัวเลือกที่ 2: ใช้ Custom SMTP (แนะนำสำหรับ Production)
1. ไปที่ **Authentication** → **Settings** → **SMTP Settings**
2. กรอกข้อมูล SMTP:
   - **Host**: smtp.gmail.com (สำหรับ Gmail) หรือ SMTP server ของคุณ
   - **Port**: 587 (TLS) หรือ 465 (SSL)
   - **Username**: อีเมลของคุณ
   - **Password**: App Password (สำหรับ Gmail) หรือรหัสผ่าน SMTP
   - **Sender email**: อีเมลที่ต้องการใช้เป็นผู้ส่ง
   - **Sender name**: ชื่อผู้ส่ง (เช่น "FaceIn System")

### ขั้นตอนที่ 3: ตั้งค่า Redirect URLs

1. ไปที่ **Authentication** → **URL Configuration**
2. เพิ่ม Redirect URLs:
   - `https://yourdomain.com/` (สำหรับ reset password - ใช้ root path)
   - `https://yourdomain.com/auth/callback` (สำหรับ email confirmation)
   - สำหรับ localhost: `http://localhost:5173/` และ `http://localhost:5173/auth/callback`
   
   **หมายเหตุ:** Reset password ใช้ root path (`/`) เพราะระบบตรวจสอบ hash fragment ที่ root URL

### ขั้นตอนที่ 4: ปรับแต่ง Email Templates (ตัวเลือก)

1. ไปที่ **Authentication** → **Email Templates**
2. ปรับแต่ง template:
   - **Confirm signup**: อีเมลยืนยันการสมัครสมาชิก
   - **Reset password**: อีเมลรีเซ็ตรหัสผ่าน
   - **Magic Link**: อีเมล magic link (ถ้าใช้)

### ขั้นตอนที่ 5: ทดสอบ

1. ลองสมัครสมาชิกใหม่ด้วยอีเมลที่ยังไม่เคยใช้
2. ตรวจสอบอีเมล (Inbox และ Spam/Junk)
3. คลิกลิงก์ยืนยันในอีเมล
4. ลองเข้าสู่ระบบ

## การตั้งค่า SMTP สำหรับ Gmail

### สร้าง App Password สำหรับ Gmail:

1. เข้า Google Account → [Security](https://myaccount.google.com/security)
2. เปิด **2-Step Verification** (ถ้ายังไม่ได้เปิด)
3. ไปที่ **App passwords**
4. สร้าง App Password ใหม่สำหรับ "Mail"
5. คัดลอกรหัสผ่าน (16 ตัวอักษร)

### ตั้งค่าใน Supabase:

- **Host**: `smtp.gmail.com`
- **Port**: `587`
- **Username**: อีเมล Gmail ของคุณ
- **Password**: App Password ที่สร้างไว้ (16 ตัวอักษร)
- **Sender email**: อีเมล Gmail เดียวกัน
- **Sender name**: ชื่อที่ต้องการแสดง (เช่น "FaceIn")

## การตั้งค่า SMTP สำหรับบริการอื่นๆ

### SendGrid:
- Host: `smtp.sendgrid.net`
- Port: `587`
- Username: `apikey`
- Password: SendGrid API Key

### Mailgun:
- Host: `smtp.mailgun.org`
- Port: `587`
- Username: Mailgun SMTP username
- Password: Mailgun SMTP password

### AWS SES:
- Host: `email-smtp.{region}.amazonaws.com`
- Port: `587`
- Username: AWS Access Key ID
- Password: AWS Secret Access Key

## ตรวจสอบสถานะ

หลังจากตั้งค่าแล้ว:

1. **ตรวจสอบ Logs**: ไปที่ **Logs** → **Auth Logs** เพื่อดูว่ามีการส่งอีเมลหรือไม่
2. **ทดสอบส่งอีเมล**: ใช้ฟีเจอร์ "Resend confirmation email" ในหน้า Sign Up
3. **ตรวจสอบ Spam**: อีเมลอาจไปตก Spam/Junk Mail

## Troubleshooting

### อีเมลไม่ถูกส่ง:
- ✅ ตรวจสอบว่าเปิด "Enable email confirmations" แล้ว
- ✅ ตรวจสอบ SMTP settings (ถ้าใช้ Custom SMTP)
- ✅ ตรวจสอบ Redirect URLs
- ✅ ดู Auth Logs ใน Supabase Dashboard

### Error "เกิดข้อผิดพลาดในการส่งอีเมล":
1. **ตรวจสอบ SMTP Credentials**:
   - สำหรับ Resend.com: ใช้ **API Key** ไม่ใช่ password
   - Username ควรเป็น `resend`
   - Password ควรเป็น API Key จาก Resend Dashboard

2. **ตรวจสอบ Sender Email**:
   - Sender email (`onboarding@resend.dev`) ต้องถูก verify ใน Resend Dashboard
   - ไปที่ Resend Dashboard → Domains → Verify domain
   - หรือใช้ verified email address ที่ Resend ให้มา

3. **ตรวจสอบ Rate Limits**:
   - Resend Free Tier: 3,000 emails/month
   - ตรวจสอบว่าไม่เกิน limit ใน Resend Dashboard

4. **ตรวจสอบ Auth Logs**:
   - ไปที่ Supabase Dashboard → Logs → Auth Logs
   - ดู error message ที่แท้จริง

### อีเมลไปตก Spam:
- ✅ เพิ่ม SPF/DKIM records ใน DNS (สำหรับ custom domain)
- ✅ ใช้ SMTP provider ที่มี reputation ดี (SendGrid, Mailgun)
- ✅ ตรวจสอบว่า sender email ถูกต้อง

### ลิงก์ยืนยันไม่ทำงาน:
- ✅ ตรวจสอบ Redirect URLs ใน Supabase Dashboard
- ✅ ตรวจสอบว่า URL ใน email template ถูกต้อง
- ✅ ตรวจสอบว่า domain ถูกต้อง (localhost vs production)

## หมายเหตุ

- **Free Tier**: Supabase Free Tier มีข้อจำกัดในการส่งอีเมล (ประมาณ 3 อีเมล/ชั่วโมง)
- **Production**: แนะนำให้ใช้ Custom SMTP สำหรับ production
- **Testing**: สามารถใช้ Supabase Email สำหรับการทดสอบได้

## ลิงก์ที่เกี่ยวข้อง

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase SMTP Settings](https://supabase.com/docs/guides/auth/auth-smtp)
