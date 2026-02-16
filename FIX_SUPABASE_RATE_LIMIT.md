# แก้ไขปัญหา Supabase Email Rate Limit (429 Error)

## 🔍 ปัญหาที่พบ

```
AuthApiError: email rate limit exceeded
Status: 429 (Too Many Requests)
```

## 📝 สาเหตุ

Supabase **Free Tier** มี rate limit ต่ำมากสำหรับ email:
- **Default SMTP**: **2 emails ต่อชั่วโมง** (ต่ำมาก!)
- Rate limit ใช้ร่วมกันสำหรับ:
  - `/auth/v1/signup` (สมัครสมาชิก)
  - `/auth/v1/recover` (ลืมรหัสผ่าน)
  - `/auth/v1/user` (อัปเดต user)

## ✅ วิธีแก้ไข (แนะนำ)

### วิธีที่ 1: ตั้งค่า Custom SMTP (แนะนำที่สุด) ⭐

ใช้ email provider อื่นแทน Supabase's default SMTP:

#### A. ใช้ Resend (แนะนำ - ฟรี 3,000 emails/เดือน)

1. ไปที่ [resend.com](https://resend.com) สมัครบัญชี
2. สร้าง API Key
3. ไปที่ Supabase Dashboard → **Authentication** → **SMTP Settings**
4. ตั้งค่า:
   ```
   Host: smtp.resend.com
   Port: 465 (SSL) หรือ 587 (TLS)
   Username: resend
   Password: [Resend API Key ของคุณ]
   Sender email: noreply@yourdomain.com (ต้อง verify domain ก่อน)
   Sender name: Face Attendance System
   ```
5. คลิก **Save**

#### B. ใช้ SendGrid (ฟรี 100 emails/วัน)

1. ไปที่ [sendgrid.com](https://sendgrid.com) สมัครบัญชี
2. สร้าง API Key
3. ไปที่ Supabase Dashboard → **Authentication** → **SMTP Settings**
4. ตั้งค่า:
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: [SendGrid API Key ของคุณ]
   Sender email: noreply@yourdomain.com
   Sender name: Face Attendance System
   ```
5. คลิก **Save**

#### C. ใช้ AWS SES (ราคาถูกมาก)

1. ไปที่ AWS Console → SES
2. Verify email หรือ domain
3. สร้าง SMTP credentials
4. ตั้งค่าใน Supabase Dashboard

### วิธีที่ 2: ปิด Email Verification ชั่วคราว

ถ้าไม่ต้องการ email verification:

1. ไปที่ Supabase Dashboard → **Authentication** → **Email Templates**
2. ปิด **Enable email confirmations**
3. หรือแก้ไขโค้ดใน `SignUpForm.tsx`:
   ```typescript
   const { data, error } = await supabase.auth.signUp({
     email: cleanEmail,
     password,
     options: {
       data: {
         first_name: firstName || '',
         last_name: lastName || '',
       },
       // ไม่ส่ง email verification
       // emailRedirectTo: undefined,
     },
   });
   ```

**หมายเหตุ**: การปิด email verification จะลดความปลอดภัย ควรใช้ Custom SMTP แทน

### วิธีที่ 3: Upgrade Plan

Upgrade ไป Pro Plan ($25/month) จะได้ rate limit สูงขึ้น แต่ยังคงมี limit อยู่

## 🔧 การตั้งค่า Custom SMTP ใน Supabase

### ขั้นตอนที่ 1: เลือก Email Provider

แนะนำ:
- **Resend**: ฟรี 3,000 emails/เดือน, ตั้งง่าย
- **SendGrid**: ฟรี 100 emails/วัน
- **AWS SES**: ราคาถูกมาก ($0.10 ต่อ 1,000 emails)

### ขั้นตอนที่ 2: ตั้งค่าใน Supabase Dashboard

1. ไปที่ **Project Settings** → **Authentication** → **SMTP Settings**
2. เปิด **Enable Custom SMTP**
3. ใส่ข้อมูล SMTP:
   - **Host**: SMTP server ของ provider
   - **Port**: 465 (SSL) หรือ 587 (TLS)
   - **Username**: Username หรือ API key
   - **Password**: Password หรือ API key
   - **Sender email**: Email ที่ verify แล้ว
   - **Sender name**: ชื่อที่ต้องการแสดง
4. คลิก **Save**
5. ทดสอบส่ง email

### ขั้นตอนที่ 3: Verify Domain (ถ้าจำเป็น)

บาง provider (เช่น Resend) ต้อง verify domain:
1. เพิ่ม DNS records ตามที่ provider บอก
2. รอให้ DNS propagate (ประมาณ 5-30 นาที)
3. Verify domain ใน provider dashboard

## 🧪 ทดสอบหลังตั้งค่า

1. ลองสมัครสมาชิกใหม่
2. ตรวจสอบว่าไม่เจอ rate limit error
3. ตรวจสอบ email inbox (และ spam folder)

## 📋 Checklist

- [ ] เลือก email provider (Resend/SendGrid/AWS SES)
- [ ] สร้าง API Key หรือ SMTP credentials
- [ ] ตั้งค่า Custom SMTP ใน Supabase Dashboard
- [ ] Verify domain (ถ้าจำเป็น)
- [ ] ทดสอบสมัครสมาชิก
- [ ] ตรวจสอบว่า email ถูกส่ง
- [ ] ตรวจสอบว่าไม่มี rate limit error

## 🆘 ถ้ายังไม่ได้

1. **ตรวจสอบ SMTP Settings**: ดูว่าใส่ข้อมูลถูกต้องหรือไม่
2. **ตรวจสอบ Email Provider Dashboard**: ดู logs และ error messages
3. **ตรวจสอบ DNS**: ถ้าใช้ custom domain ตรวจสอบ DNS records
4. **ลองใช้ Provider อื่น**: ถ้า provider หนึ่งไม่ทำงาน ลอง provider อื่น

## 📚 เอกสารเพิ่มเติม

- [Supabase SMTP Documentation](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend Documentation](https://resend.com/docs)
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)

## 💡 คำแนะนำ

- **ใช้ Custom SMTP**: แก้ปัญหา rate limit ได้ถาวร
- **ใช้ Resend**: ฟรี 3,000 emails/เดือน ตั้งง่าย
- **Verify Domain**: เพื่อความน่าเชื่อถือของ email
- **Monitor Usage**: ตรวจสอบ email usage ใน provider dashboard
