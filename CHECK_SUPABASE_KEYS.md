# วิธีตรวจสอบ Supabase Keys ที่ถูกต้อง

## ⚠️ สิ่งที่ต้องตรวจสอบ

### 1. Project URL

**รูปแบบที่ถูกต้อง:**
```
https://txlsbopvbauasqgbdgfk.supabase.co
```

**ไม่ใช่:**
```
txlsbopvbauasqgbdgfk  ❌ (ไม่มี https:// และ .supabase.co)
```

**วิธีหา:**
1. ไปที่ Supabase Dashboard → **Settings** → **API**
2. หา **Project URL** (ไม่ใช่ Project Reference)
3. Copy URL เต็ม (ขึ้นต้นด้วย `https://` และลงท้ายด้วย `.supabase.co`)

### 2. Anon Key (Public Key)

**รูปแบบที่ถูกต้อง:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bHNib3B2YmF1YXNxZ2JkZ2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxMjM0NTYsImV4cCI6MjAzMzY5OTQ1Nn0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Key ที่คุณให้มา:**
```
sb_publishable_VEtsY1HXV9N5nQHs5Sr8uQ_eQNuJ87c
```

**⚠️ หมายเหตุ:**
- Key ที่ขึ้นต้นด้วย `sb_publishable_` อาจไม่ใช่ anon key ที่ Supabase ใช้
- Supabase ใช้ **anon key** ที่เป็น JWT token (ขึ้นต้นด้วย `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

**วิธีหา Anon Key ที่ถูกต้อง:**
1. ไปที่ Supabase Dashboard → **Settings** → **API**
2. หา **Project API keys**
3. Copy **anon public** key (ไม่ใช่ service_role!)
4. Anon key จะเป็น JWT token ยาวๆ ขึ้นต้นด้วย `eyJ...`

## 📝 ตัวอย่างไฟล์ .env ที่ถูกต้อง

```env
# Project URL - Full URL
VITE_SUPABASE_URL=https://txlsbopvbauasqgbdgfk.supabase.co

# Anon Key - JWT token (ขึ้นต้นด้วย eyJ...)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bHNib3B2YmF1YXNxZ2JkZ2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxMjM0NTYsImV4cCI6MjAzMzY5OTQ1Nn0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🔍 วิธีตรวจสอบว่า Key ถูกต้อง

### วิธีที่ 1: ตรวจสอบใน Supabase Dashboard
1. ไปที่ **Settings** → **API**
2. ดู **Project URL** → ควรเป็น `https://txlsbopvbauasqgbdgfk.supabase.co`
3. ดู **Project API keys** → **anon public** → ควรเป็น JWT token ยาวๆ

### วิธีที่ 2: ทดสอบใน Browser Console
1. เปิด Browser Console (F12)
2. พิมพ์:
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_URL)
   console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
   ```
3. ตรวจสอบว่า:
   - URL ขึ้นต้นด้วย `https://` และลงท้ายด้วย `.supabase.co`
   - Key ขึ้นต้นด้วย `eyJ...` (JWT token)

## ⚠️ ปัญหาที่อาจพบ

### Error: Invalid API key
**สาเหตุ**: ใช้ key ผิด (เช่น service_role key หรือ key ที่ไม่ใช่ anon key)
**แก้ไข**: 
- ใช้ **anon public** key เท่านั้น
- ตรวจสอบว่า key ขึ้นต้นด้วย `eyJ...` (JWT token)

### Error: Invalid URL
**สาเหตุ**: Project URL ไม่ใช่ full URL
**แก้ไข**: 
- ใช้ full URL เช่น `https://txlsbopvbauasqgbdgfk.supabase.co`
- ไม่ใช่แค่ `txlsbopvbauasqgbdgfk`

## ✅ Checklist

- [ ] Project URL เป็น full URL (`https://xxx.supabase.co`)
- [ ] Anon Key เป็น JWT token (ขึ้นต้นด้วย `eyJ...`)
- [ ] ใช้ anon public key (ไม่ใช่ service_role key)
- [ ] ไฟล์ `.env` อยู่ในโฟลเดอร์ `app/`
- [ ] Restart dev server หลังจากแก้ไข `.env`
