# Railway Deployment Configuration

## ⚠️ สำคัญ: ตั้งค่า Root Directory

Railway ต้องรู้ว่า root directory ของ backend คือ `backend/`

### วิธีที่ 1: ตั้งค่าใน Railway Dashboard (แนะนำ)

**สำคัญ:** Root Directory อยู่ใน **Service Settings** ไม่ใช่ Project Settings!

**ขั้นตอน:**
1. ในหน้า Project Dashboard (ที่คุณอยู่ตอนนี้) → คลิกที่ **Service** ที่สร้างไว้ (หรือสร้าง Service ใหม่ถ้ายังไม่มี)
2. เมื่อเข้าไปใน Service แล้ว → คลิกแท็บ **Settings** (⚙️) ที่ด้านบน
3. ในหน้า Service Settings → หา **Root Directory** (มักจะอยู่ด้านล่าง)
4. ตั้งค่าเป็น: `backend`
5. คลิก **Save** และ Railway จะ redeploy อัตโนมัติ

**หมายเหตุ:** ถ้ายังไม่มี Service ให้สร้างก่อน:
- คลิก **New** → **Empty Service** หรือ **Deploy from GitHub repo**
- เลือก Repository ของคุณ

### วิธีที่ 2: ใช้ไฟล์ Config (ถ้าวิธีที่ 1 ไม่ได้)

ไฟล์ `nixpacks.toml` และ `railway.json` ที่สร้างไว้จะช่วยบอก Railway ว่า root directory คือ `backend/`

แต่แนะนำให้ใช้วิธีที่ 1 เพราะชัดเจนและง่ายกว่า

---

## Environment Variables ที่ต้องตั้งค่า

ใน Railway Dashboard → Variables:

- `FRONTEND_URLS`: `https://your-frontend-url.vercel.app` (ใส่หลังจาก deploy frontend แล้ว)

---

## Troubleshooting

### Error: "Error creating build plan with Railpack"

**สาเหตุ:** Railway ไม่รู้ว่า root directory คือ `backend/`

**วิธีแก้:**
1. ไปที่ Railway Dashboard → Settings → Root Directory
2. ตั้งค่าเป็น: `backend`
3. Save และรอ redeploy

### Error: "Module not found" หรือ "Import error"

**สาเหตุ:** Python path ไม่ถูกต้อง

**วิธีแก้:**
- ตรวจสอบว่า Root Directory ตั้งเป็น `backend` แล้ว
- ตรวจสอบว่า `requirements.txt` อยู่ใน `backend/` directory
