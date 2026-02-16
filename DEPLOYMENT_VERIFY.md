# ตรวจสอบว่าระบบถูกนำไปใช้จริงหรือยัง

## วิธีตรวจสอบ

### 1. ตรวจจาก Environment / Config

| ข้อความ | ความหมาย |
|--------|-----------|
| **ยังไม่นำไปใช้จริง** | ใช้ค่า default หรือ placeholder อยู่ |
| **นำไปใช้จริงแล้ว** | ตั้งค่า URL จริงของ Frontend/Backend แล้ว |

#### Frontend (Vercel หรือโฟลเดอร์ `app`)

- เปิด **Vercel Dashboard** → โปรเจกต์ → **Settings** → **Environment Variables**
- หรือดูไฟล์ `app/.env.production` (ถ้า build เอง)
- ตรวจว่า:
  - `VITE_API_URL` = **URL จริงของ Backend** (เช่น `https://xxx.up.railway.app`)  
    → ถ้ายังเป็น `https://your-backend-url.railway.app` แปลว่า **ยังไม่นำไปใช้จริง**
  - `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` = ค่าจากโปรเจกต์ Supabase จริง

#### Backend (Railway)

- เปิด **Railway Dashboard** → Service → **Variables**
- ตรวจว่า:
  - `FRONTEND_URLS` = **URL จริงของ Frontend** (เช่น `https://your-app.vercel.app`)  
    → ถ้ายังเป็น `https://your-frontend-url.vercel.app` แปลว่า **ยังไม่ตั้งค่า CORS สำหรับ production**
  - `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` = ค่าจากโปรเจกต์ Supabase จริง (ถ้าใช้ face embeddings บน Supabase)

---

### 2. ตรวจจากการใช้งานจริง

- **มีคนเข้าใช้จาก URL สาธารณะ** (ไม่ใช่ localhost) เช่น ลิงก์แชร์ให้ครู/นักเรียน
- **Backend ตอบที่ URL จริง** — เปิด `https://<backend-url>/api/health` แล้วได้ `{"status":"ok"}` หรือคล้ายกัน
- **Frontend เปิดได้ที่ URL จริง** — เปิด `https://<frontend-url>` แล้วเห็นหน้า Login และใช้งานได้
- **Login / ลงทะเบียนใบหน้า / เช็คชื่อ ทำงานครบ** บน domain จริง

---

### 3. Checklist สรุป

ทำครบทุกข้อ = **นำไปใช้จริงแล้ว**

- [ ] Deploy Backend (Railway) แล้ว และได้ URL จริง
- [ ] Deploy Frontend (Vercel) แล้ว และได้ URL จริง
- [ ] ตั้ง `VITE_API_URL` ใน Vercel = Backend URL จริง
- [ ] ตั้ง `FRONTEND_URLS` ใน Railway = Frontend URL จริง (คั่นด้วย comma ถ้ามีหลายโดเมน)
- [ ] ตั้ง Supabase (URL + anon key ใน Frontend, service role ใน Backend ถ้าใช้)
- [ ] ทดสอบเข้า Frontend URL → Login → ใช้ฟีเจอร์หลักได้
- [ ] มีการแชร์ลิงก์หรือใช้งานจากคนอื่นนอกจาก developer

---

### 4. สถานะจากไฟล์ในโปรเจกต์ (เท่าที่ตรวจได้)

- `app/.env.production` มีค่า `VITE_API_URL=https://your-backend-url.railway.app`  
  → **placeholder** = ต้องแทนที่ด้วย Backend URL จริงก่อนใช้ production
- มี `railway.json`, `Procfile`, `app/vercel.json`  
  → โปรเจกต์ **พร้อม deploy** แต่ต้องไปตั้งค่าใน Railway/Vercel จริง

**สรุป:** จากโค้ดและ config ใน repo ยัง **ไม่สามารถบอกได้ว่า deploy ไปแล้วหรือยัง** ต้องไปดูที่ Railway / Vercel / Supabase ว่าตั้ง URL และตัวแปรแวดล้อมเป็นค่าจริงหรือไม่ และมีคนเข้าใช้จาก URL นั้นหรือไม่
