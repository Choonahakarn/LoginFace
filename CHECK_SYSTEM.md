# วิธีตรวจสอบระบบ Face Attendance

## 1. Backend (Python)
```bash
cd backend
run.bat
```
- ควรเห็น `Uvicorn running on http://0.0.0.0:8000`
- ทดสอบ: เปิดเบราว์เซอร์ไปที่ `http://localhost:8000/api/health` → ควรได้ `{"status":"ok",...}`
- API Docs: `http://localhost:8000/docs`

## 2. Frontend (React/Vite)
```bash
cd app
npm run dev
```
- ควรเห็น `Local: http://localhost:5173`
- เปิด `http://localhost:5173` ในเบราว์เซอร์

## 3. การเชื่อมต่อ
- Frontend เรียก Backend ที่ `http://localhost:8000` (จาก `.env` → `VITE_API_URL`)
- กดปุ่ม **"ทดสอบเชื่อมต่อ"** ในหน้า จัดการใบหน้า
- ผลลัพธ์: `✓ เชื่อมต่อได้` = Backend ตอบปกติ

## 4. Endpoints สำคัญ
| Endpoint | วิธีใช้ | หมายเหตุ |
|----------|---------|----------|
| GET /api/health | ตรวจสอบ Backend | ต้องได้ 200 |
| POST /api/face/enroll | ลงทะเบียนใบหน้า | ส่ง class_id, student_id, image_base64 |
| POST /api/face/recognize | รู้จำใบหน้า | สำหรับเช็คชื่อ |
| POST /api/face/debug-image | บันทึกรูปทดสอบ | ใช้โดยปุ่มทดสอบ (เมื่อมีกล้อง) |

## 5. Flow ลงทะเบียนใบหน้า
1. เลือกนักเรียน → กด "เพิ่มใบหน้า"
2. MediaPipe ตรวจจับใบหน้า (ฝั่ง Frontend)
3. Crop หรือส่งทั้งเฟรม → POST /api/face/enroll
4. Backend ใช้ DeepFace สกัด embedding
5. เก็บ embedding ใน `backend/data/embeddings.json`
