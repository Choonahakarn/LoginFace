# Railway Deployment Configuration

## ⚠️ สำคัญ: ตั้งค่า Root Directory

Railway ต้องรู้ว่า root directory ของ backend คือ `backend/`

### วิธีที่ 1: ตั้งค่าใน Railway Dashboard (แนะนำ)

1. ไปที่ Railway Dashboard → Project → Service
2. คลิก **Settings**
3. หา **Root Directory**
4. ตั้งค่าเป็น: `backend`
5. Save และ Railway จะ redeploy อัตโนมัติ

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
