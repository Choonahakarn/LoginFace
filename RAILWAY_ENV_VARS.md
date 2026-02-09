# Railway Environment Variables

## ต้องตั้งค่า Environment Variables ใน Railway Dashboard

### 1. Clear Build Cache
- **Name:** `NO_CACHE`
- **Value:** `1`
- **Purpose:** บังคับให้ Railway rebuild โดยไม่ใช้ cache เก่า

### 2. Frontend URL (ตั้งหลังจาก deploy frontend แล้ว)
- **Name:** `FRONTEND_URLS`
- **Value:** `https://your-frontend-url.vercel.app`
- **Purpose:** สำหรับ CORS configuration

---

## วิธีตั้งค่า:

1. ไปที่ Railway Dashboard → Service → **Variables**
2. คลิก **New Variable**
3. เพิ่ม variables ตามด้านบน
4. Save และ Railway จะ redeploy อัตโนมัติ
