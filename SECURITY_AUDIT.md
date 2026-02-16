# รายงานความปลอดภัย (Security Audit)

## 1. ระบบ Login / Sign Up

### 1.1 การยืนยันตัวตน
- ใช้ **Supabase Auth** — จัดการ session, JWT, refresh token ทางฝั่ง Supabase
- **Frontend ใช้เฉพาะ anon key** — ไม่มี service_role key ในแอป (ใช้เฉพาะใน backend)
- รหัสผ่านไม่ถูกเก็บในแอป — ตรวจที่ Supabase

### 1.2 ป้องกันการโจมตีพื้นฐาน
| ประเภท | สถานะ | รายละเอียด |
|--------|--------|------------|
| Brute force | ✅ | Rate limit (429) + cooldown 120 วินาที บน Login/SignUp |
| Account enumeration | ✅ | ข้อความ login ผิดใช้ "อีเมลหรือรหัสผ่านไม่ถูกต้อง" ไม่บอกว่าเป็นอีเมลหรือรหัสผิด |
| Duplicate email | ✅ | SignUp จัดการอีเมลซ้ำ (error code + ตรวจ identities) |
| Session expiry | ✅ | ตรวจ `expires_at` ใน useAuth และ clear เมื่อหมดอายุ |

### 1.3 สิ่งที่ควรระวัง
- **รหัสผ่าน**: ขั้นต่ำ 6 ตัว (ตาม Supabase) — ถ้าต้องการเข้มงวดขึ้น ตั้งค่าใน Supabase Dashboard
- **Email verification**: ถ้าเปิดใน Supabase ผู้ใช้ต้องยืนยันอีเมลก่อนเข้าได้

---

## 2. หลัง Logout — ไม่ให้มีข้อมูลค้าง

### 2.1 การทำ Logout (useAuth.signOut)
เมื่อกดออกจากระบบ จะทำตามลำดับนี้:

1. **ลบ state ในแอป** — `user`, `session`, `authUser` = null  
2. **ลบ storage ใน browser**
   - `localStorage.clear()` — ลบทุก key รวม session/token ของ Supabase และ selected class ฯลฯ  
   - `sessionStorage.clear()` — ลบ session ของแท็บ  
3. **แจ้ง Supabase** — `supabase.auth.signOut()`  
4. **Redirect** — `window.location.href = origin` (โหลดหน้าใหม่)

ผลลัพธ์:
- หน้าที่โหลดใหม่จะไม่มี session ใน localStorage/sessionStorage  
- `getSession()` จะได้ค่าไม่มี session → แสดงหน้า Login  
- ไม่มี token หรือข้อมูลผู้ใช้เดิมค้างใน browser

### 2.2 จุดที่แก้ไขแล้ว
- ปุ่ม Logout ทุกหน้าเรียก **เฉพาะ** `signOut()` จาก useAuth  
- Logic การลบ storage และ redirect อยู่ที่เดียวใน `useAuth.signOut()`  
- ไม่มีการเก็บ password หรือ session ไว้ในโค้ด/ตัวแปรอื่น

---

## 3. ข้อมูลที่เก็บใน Frontend

| ข้อมูล | ที่เก็บ | หลัง Logout |
|--------|--------|-------------|
| Session / JWT | localStorage (โดย Supabase client) | ถูกลบด้วย `localStorage.clear()` |
| เลือกห้อง (selected class) | localStorage | ถูกลบ |
| ข้อมูลห้อง/นักเรียน/ attendance | Supabase (API) | ยังอยู่บน server แต่ว่า client ไม่มี token จึงเข้าไม่ถึง |

- **ไม่มี** การเก็บ password หรือ credit card ในแอป  
- **Anon key** อยู่ใน env (`VITE_SUPABASE_ANON_KEY`) — ใช้ได้ใน frontend ตามที่ Supabase ออกแบบ (RLS ควบคุมการเข้าถึงข้อมูล)

---

## 4. การเข้าถึงข้อมูล (Backend / RLS)

- **Supabase RLS** เปิดบนตารางที่เกี่ยวข้อง  
- แต่ละแถวใช้ `auth.uid()` — ผู้ใช้เห็นเฉพาะข้อมูลของตัวเอง  
- Backend ใช้ **service_role** เฉพาะใน backend (ไฟล์ `.env` ไม่ commit) สำหรับ face embeddings  

---

## 5. ความเสี่ยงและข้อแนะนำ

### 5.1 XSS (Cross-Site Scripting)
- ใช้ React — ข้อมูลที่แสดงผ่าน JSX โดยทั่วไปจะถูก escape  
- ควรไม่ใช้ `dangerouslySetInnerHTML` กับข้อมูลที่ผู้ใช้กรอกหรือมาจาก API  

### 5.2 CSRF
- Supabase Auth ใช้ JWT ใน header / cookie — ไม่พึ่ง form POST แบบ classic  
- CORS ตั้งที่ backend (FastAPI) ตาม FRONTEND_URLS  

### 5.3 Production
- ปิดหรือลด **console.log** ที่เกี่ยวกับ session/auth ใน production (ถ้ามี)  
- ใช้ **HTTPS** ทั้ง frontend และ backend  
- อย่า commit ไฟล์ `.env` หรือค่า `SUPABASE_SERVICE_ROLE_KEY`  

### 5.4 บัญชีทดสอบ
- บัญชี `teacher@school.edu` เป็นบัญชีทดสอบ — ใน production ควรปิดหรือเปลี่ยนรหัสและจำกัดการใช้งาน  

---

## สรุป

- **Login/Sign Up**: ใช้ Supabase Auth มี rate limit และการจัดการ error ที่เหมาะสม  
- **Logout**: ลบ state + ลบ localStorage/sessionStorage ทั้งหมด + redirect — **ไม่มี session หรือข้อมูลผู้ใช้ค้างใน browser หลัง logout**  
- **ข้อมูลสำคัญ**: ไม่เก็บ password ในแอป; ใช้ anon key ใน frontend และ RLS ฝั่ง Supabase  

ถ้าต้องการเพิ่มความปลอดภัยอีก เช่น เปิด MFA หรือเข้มงวดรหัสผ่าน สามารถตั้งค่าเพิ่มใน Supabase Dashboard ได้
