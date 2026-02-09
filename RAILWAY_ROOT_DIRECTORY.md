# 🔍 วิธีหา Root Directory ใน Railway

## ⚠️ สำคัญ: Root Directory อยู่ใน **Service Settings** ไม่ใช่ Project Settings!

---

## 📍 ขั้นตอนการหา Root Directory:

### 1. กลับไปที่หน้า Project Dashboard
- คลิกที่ชื่อ Project ของคุณ (เช่น "renewed-essence") ที่ด้านบนซ้าย
- หรือคลิก "Back" เพื่อกลับไปหน้า Project

### 2. คลิกที่ Service
- ในหน้า Project Dashboard → คุณจะเห็น Service ที่สร้างไว้ (เช่น "gracious-commitment" หรือ "Backend")
- **คลิกที่ Service นั้น** (ไม่ใช่ Project Settings)

### 3. ไปที่แท็บ Settings ของ Service
- เมื่อเข้าไปใน Service แล้ว → คุณจะเห็นแท็บด้านบน:
  - **Deployments** (แสดง deployment history)
  - **Variables** (environment variables)
  - **Metrics** (monitoring)
  - **Settings** ⚙️ ← **คลิกที่นี่!**

### 4. หา Root Directory ใน Service Settings
- ในหน้า Service Settings → หา **"Root Directory"** หรือ **"Source"** หรือ **"Working Directory"**
- มักจะอยู่ในส่วน **"General"** หรือ **"Build"**

---

## 🎯 ถ้ายังหาไม่เจอ:

### วิธีที่ 1: สร้าง Service ใหม่
1. ลบ Service เดิม (Service → Settings → Danger Zone → Delete)
2. สร้าง Service ใหม่: **New** → **Deploy from GitHub repo**
3. เลือก Repository: `Choonahakarn/LoginFace`
4. **ตอนนี้ Railway อาจจะถาม Root Directory** → ตั้งเป็น `backend`

### วิธีที่ 2: ใช้ไฟล์ Config (ไม่ต้องตั้ง Root Directory)
ตอนนี้มีไฟล์ `nixpacks.toml` ใน root directory แล้ว ซึ่งจะบอก Railway ให้:
- ติดตั้ง dependencies จาก `backend/requirements.txt`
- รันคำสั่งจาก `backend/` directory

**แต่ Railway ยังต้องรู้ว่า root directory คือ `backend/`**

---

## 💡 ทางเลือก: ใช้ Railway CLI

ถ้าหา Root Directory ใน UI ไม่เจอ ลองใช้ CLI:

```bash
# ติดตั้ง Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link กับ project
railway link

# ตั้งค่า root directory
railway variables set RAILWAY_ROOT_DIRECTORY=backend
```

---

## ✅ Checklist:

- [ ] ไปที่ **Service** (ไม่ใช่ Project Settings)
- [ ] คลิกแท็บ **Settings** ของ Service
- [ ] หา **Root Directory** หรือ **Source**
- [ ] ตั้งค่าเป็น: `backend`
- [ ] Save และรอ redeploy

---

## 🆘 ถ้ายังไม่ได้:

ลองดูที่:
- Railway Dashboard → Service → **Deployments** → คลิก deployment ล่าสุด → **View logs**
- จะเห็น error message ที่ชัดเจนขึ้น

หรือลองสร้าง Service ใหม่และเลือก Root Directory ตอนสร้าง
