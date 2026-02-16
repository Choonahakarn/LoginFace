# แก้ไขปัญหา Login/SignUp ไม่ทำงาน - Quick Fix

## ⚡ แก้ไขด่วน

### 1. ตรวจสอบว่าใช้ Key ถูกต้องหรือไม่

**Publishable Key อาจไม่ทำงาน** - ลองใช้ Legacy Anon Key แทน:

1. ไปที่ Supabase Dashboard → **Settings** → **API**
2. คลิก tab **"Legacy anon, service_role API keys"**
3. Copy **anon public** key (ขึ้นต้นด้วย `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
4. แก้ไขไฟล์ `app/.env`:
   ```env
   VITE_SUPABASE_URL=https://txlsbopvbauasqgbdgfk.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (ใส่ legacy anon key)
   ```
5. **Restart dev server**

### 2. ตรวจสอบ Email Provider

1. ไปที่ Supabase Dashboard → **Authentication** → **Providers**
2. คลิก **Email**
3. ตรวจสอบว่า **Enable Email provider** เปิดอยู่
4. (สำหรับทดสอบ) ปิด **Confirm email** เพื่อให้ใช้งานได้ทันที
5. คลิก **Save**

### 3. Restart Dev Server

```bash
# หยุด server (Ctrl+C)
cd app
npm run dev
```

### 4. ตรวจสอบ Browser Console

1. เปิด Browser Console (F12)
2. ดู Error Messages
3. ตรวจสอบว่าเห็น:
   ```
   Supabase URL: https://txlsbopvbauasqgbdgfk.supabase.co
   Supabase Key: sb_publishable_... หรือ eyJ...
   ```

## 🔍 Debug Steps

### Step 1: ตรวจสอบ Environment Variables

เปิด Browser Console และพิมพ์:
```javascript
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key:', import.meta.env.VITE_SUPABASE_ANON_KEY);
```

**ควรเห็น:**
- URL: `https://txlsbopvbauasqgbdgfk.supabase.co`
- Key: `sb_publishable_...` หรือ `eyJ...`

### Step 2: ทดสอบ Supabase Connection

ใน Browser Console:
```javascript
const testSupabase = async () => {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const supabase = createClient(
    'https://txlsbopvbauasqgbdgfk.supabase.co',
    'sb_publishable_VEtsY1HXV9N5nQHs5Sr8uQ_eQNuJ87c'
  );
  
  const { data, error } = await supabase.auth.signUp({
    email: 'test@test.com',
    password: 'test123456'
  });
  
  console.log('Test result:', { data, error });
};

testSupabase();
```

## ⚠️ ปัญหาที่พบบ่อย

### ปัญหา: Publishable Key ไม่ทำงาน

**แก้ไข:** ใช้ Legacy Anon Key แทน

### ปัญหา: Email Provider ไม่เปิด

**แก้ไข:** เปิด Email Provider ใน Supabase Dashboard

### ปัญหา: Environment Variables ไม่ถูกโหลด

**แก้ไข:** 
1. ตรวจสอบว่าไฟล์ `.env` อยู่ใน `app/` folder
2. Restart dev server
3. ลบ cache: `rm -rf node_modules/.vite`

## 📝 Checklist

- [ ] ใช้ Legacy Anon Key (ถ้า Publishable Key ไม่ทำงาน)
- [ ] Email Provider เปิดอยู่
- [ ] Confirm email ปิดอยู่ (สำหรับทดสอบ)
- [ ] Redirect URLs ตั้งค่าแล้ว
- [ ] Restart dev server แล้ว
- [ ] Browser Console ไม่มี error
