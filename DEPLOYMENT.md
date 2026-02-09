# คู่มือการ Deploy - Railway + Vercel

## 📋 ภาพรวม

โปรเจคนี้ Deploy แยกกัน:
- **Backend** → Railway (Python FastAPI)
- **Frontend** → Vercel (React + Vite)

---

## 🚂 Backend (Railway)

### ไฟล์ที่จำเป็น
- ✅ `backend/Procfile` - บอก Railway วิธีรัน app
- ✅ `backend/main.py` - แก้ไข CORS แล้ว
- ✅ `backend/requirements.txt` - Dependencies

### ขั้นตอนการ Deploy

1. **ไปที่ [railway.app](https://railway.app)**
   - Login with GitHub

2. **New Project → Deploy from GitHub repo**
   - เลือก Repository ของคุณ

3. **ตั้งค่า Root Directory**
   - Settings → Root Directory → `backend`

4. **ตั้งค่า Environment Variables**
   - Variables → Add Variable
   - Name: `FRONTEND_URLS`
   - Value: `https://your-frontend-url.vercel.app` (จะแก้ไขหลังจาก Deploy Frontend)

5. **รอ Deploy**
   - ได้ Backend URL เช่น `https://face-api-production.up.railway.app`

---

## 🌐 Frontend (Vercel)

### ไฟล์ที่จำเป็น
- ✅ `app/.env.production` - Backend URL (จะแก้ไขหลังจาก Deploy Backend)
- ✅ `app/package.json` - Dependencies
- ✅ `app/vite.config.ts` - Vite config

### ขั้นตอนการ Deploy

1. **ไปที่ [vercel.com](https://vercel.com)**
   - Login with GitHub

2. **Add New Project → Import Git Repository**
   - เลือก Repository เดียวกัน

3. **ตั้งค่า Project**
   - Root Directory: `app`
   - Build Command: `npm run build` (auto-detect)
   - Output Directory: `dist` (auto-detect)

4. **ตั้งค่า Environment Variables**
   - Add Variable
   - Name: `VITE_API_URL`
   - Value: `https://your-backend-url.railway.app` (ใส่ Backend URL จาก Railway)

5. **Deploy**
   - ได้ Frontend URL เช่น `https://face-attendance.vercel.app`

---

## 🔗 เชื่อมต่อ Frontend กับ Backend

### หลัง Deploy ทั้งสองแล้ว

1. **อัพเดท CORS ใน Railway**
   - Railway → Service → Variables
   - แก้ไข `FRONTEND_URLS` = `https://your-frontend-url.vercel.app`
   - Railway จะ redeploy อัตโนมัติ

2. **ทดสอบ**
   - เปิด Frontend URL
   - ทดสอบการสแกนใบหน้า

---

## 📝 Checklist

### ก่อน Deploy
- [x] สร้าง `backend/Procfile`
- [x] แก้ไข `backend/main.py` (CORS)
- [x] สร้าง `app/.env.production`
- [x] สร้าง `.gitignore`

### หลัง Deploy Backend
- [ ] ได้ Backend URL
- [ ] ทดสอบ Backend (`/api/health`)
- [ ] บันทึก Backend URL

### หลัง Deploy Frontend
- [ ] ได้ Frontend URL
- [ ] อัพเดท `VITE_API_URL` ใน Vercel
- [ ] อัพเดท `FRONTEND_URLS` ใน Railway
- [ ] ทดสอบ Frontend

---

## 🎯 URLs ที่ต้องบันทึก

- **Backend URL**: `https://your-backend-url.railway.app`
- **Frontend URL**: `https://your-frontend-url.vercel.app`

---

**Happy Deploying! 🚀**
