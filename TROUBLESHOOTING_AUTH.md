# แก้ไขปัญหา Login/SignUp ไม่ทำงาน

## 🔍 วิธีตรวจสอบปัญหา

### 1. ตรวจสอบ Browser Console

1. เปิด Browser Console (F12)
2. ดู Error Messages
3. ตรวจสอบว่า Supabase URL และ Key ถูกโหลดหรือไม่

**สิ่งที่ควรเห็น:**
```
Supabase URL: https://txlsbopvbauasqgbdgfk.supabase.co
Supabase Key: sb_publishable_VEtsY1H...
```

### 2. ตรวจสอบ Environment Variables

**ตรวจสอบว่าไฟล์ `.env` ถูกโหลด:**
1. เปิด Browser Console
2. พิมพ์:
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_URL)
   console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
   ```

**ควรเห็น:**
- `VITE_SUPABASE_URL`: `https://txlsbopvbauasqgbdgfk.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `sb_publishable_...`

### 3. ตรวจสอบ Supabase Dashboard

#### A. Email Provider
1. ไปที่ **Authentication** → **Providers** → **Email**
2. ตรวจสอบว่า **Enable Email provider** เปิดอยู่
3. (Optional) ตรวจสอบ **Confirm email**:
   - ถ้าเปิด = ต้องยืนยันอีเมลก่อนใช้งาน
   - ถ้าปิด = ใช้งานได้ทันที

#### B. Redirect URLs
1. ไปที่ **Authentication** → **URL Configuration**
2. ตรวจสอบว่ามี:
   ```
   http://localhost:5173/auth/callback
   http://localhost:5173/*
   ```

### 4. ทดสอบ Supabase Connection

เปิด Browser Console และพิมพ์:
```javascript
import { supabase } from './lib/supabase';
supabase.auth.getSession().then(console.log);
```

**ควรเห็น:**
- `{ data: { session: null }, error: null }` (ถ้ายังไม่ login)

## 🐛 ปัญหาที่พบบ่อย

### ปัญหา 1: Environment Variables ไม่ถูกโหลด

**อาการ:**
- Error: "Missing Supabase environment variables"
- Console แสดง `undefined`

**แก้ไข:**
1. ตรวจสอบว่าไฟล์ `app/.env` มีอยู่
2. ตรวจสอบว่า environment variables ขึ้นต้นด้วย `VITE_`
3. **Restart dev server** (`npm run dev`)
4. ลบ cache: `rm -rf node_modules/.vite` (ถ้ายังไม่ได้)

### ปัญหา 2: Publishable Key ไม่ทำงาน

**อาการ:**
- Error: "Invalid API key" หรือ "Invalid JWT"

**แก้ไข:**
1. ตรวจสอบว่าใช้ **Publishable key** (`sb_publishable_...`)
2. ถ้าไม่ได้ผล ลองใช้ **Legacy anon key**:
   - ไปที่ Supabase Dashboard → **Settings** → **API**
   - คลิก tab **"Legacy anon, service_role API keys"**
   - Copy **anon public** key (ขึ้นต้นด้วย `eyJ...`)
   - แก้ไข `app/.env`:
     ```env
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```

### ปัญหา 3: Email Provider ไม่เปิด

**อาการ:**
- Error: "Email provider is not enabled"

**แก้ไข:**
1. ไปที่ Supabase Dashboard → **Authentication** → **Providers**
2. คลิก **Email**
3. เปิดใช้งาน **Enable Email provider**
4. คลิก **Save**

### ปัญหา 4: Email Verification เปิดอยู่

**อาการ:**
- สมัครสมาชิกสำเร็จ แต่ Login ไม่ได้
- Error: "Email not confirmed"

**แก้ไข:**
**วิธีที่ 1: ปิด Email Verification (สำหรับทดสอบ)**
1. ไปที่ **Authentication** → **Providers** → **Email**
2. ปิด **Confirm email**
3. คลิก **Save**

**วิธีที่ 2: ยืนยันอีเมล**
1. ตรวจสอบอีเมลที่สมัคร
2. คลิกลิงก์ยืนยันในอีเมล

### ปัญหา 5: Redirect URL ไม่ถูกต้อง

**อาการ:**
- OAuth redirect ไม่ทำงาน
- Error: "Invalid redirect URL"

**แก้ไข:**
1. ไปที่ **Authentication** → **URL Configuration**
2. เพิ่ม Redirect URLs:
   ```
   http://localhost:5173/auth/callback
   http://localhost:5173/*
   ```
3. คลิก **Save**

## 🔧 ขั้นตอนแก้ไขแบบละเอียด

### Step 1: ตรวจสอบไฟล์ .env

```bash
cd app
cat .env
```

**ควรเห็น:**
```env
VITE_SUPABASE_URL=https://txlsbopvbauasqgbdgfk.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_VEtsY1HXV9N5nQHs5Sr8uQ_eQNuJ87c
```

### Step 2: Restart Dev Server

```bash
# หยุด server (Ctrl+C)
# แล้วรันใหม่
npm run dev
```

### Step 3: ตรวจสอบ Browser Console

เปิด Browser Console (F12) และดู:
- Error messages
- Supabase connection logs
- Network requests

### Step 4: ทดสอบ Supabase Connection

ใน Browser Console:
```javascript
// ทดสอบ connection
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(
  'https://txlsbopvbauasqgbdgfk.supabase.co',
  'sb_publishable_VEtsY1HXV9N5nQHs5Sr8uQ_eQNuJ87c'
);

// ทดสอบ sign up
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'test123456'
});
console.log('Test result:', { data, error });
```

## 📝 Checklist

- [ ] ไฟล์ `.env` มีอยู่และตั้งค่าถูกต้อง
- [ ] Environment variables ขึ้นต้นด้วย `VITE_`
- [ ] Restart dev server แล้ว
- [ ] Email Provider เปิดใช้งานแล้ว
- [ ] Redirect URLs ตั้งค่าแล้ว
- [ ] Browser Console ไม่มี error
- [ ] Supabase connection ทำงานได้

## 🆘 ถ้ายังไม่ได้

1. **ตรวจสอบ Browser Console** - ดู error messages
2. **ตรวจสอบ Network Tab** - ดู API requests
3. **ตรวจสอบ Supabase Dashboard** - ดู logs ใน Authentication → Logs
4. **ลองใช้ Legacy anon key** - ถ้า publishable key ไม่ทำงาน

## 📞 ข้อมูลที่ต้องให้

ถ้ายังแก้ไม่ได้ ให้ส่งข้อมูลนี้มา:
1. Error message จาก Browser Console
2. Network requests (ถ้ามี error)
3. Supabase Dashboard → Authentication → Logs
