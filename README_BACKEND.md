# Face Attendance - Backend (DeepFace: RetinaFace + Facenet512)

## การติดตั้งและรัน

### 1. สร้าง Virtual Environment (แนะนำ)

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux
```

### 2. ติดตั้ง Dependencies

```bash
pip install -r requirements.txt
```

### 3. รัน Backend

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

หรือใช้ `run.bat` (Windows)

### 4. รัน Frontend พร้อม Backend

1. สร้างไฟล์ `app/.env`:
   ```
   VITE_API_URL=http://localhost:8000
   ```

2. รัน Frontend:
   ```bash
   cd app
   npm run dev
   ```

3. เมื่อ `VITE_API_URL` ถูกตั้งค่า ระบบจะใช้:
   - **Client**: MediaPipe สำหรับ realtime face detection + liveness
   - **Backend**: DeepFace (RetinaFace + Facenet512) สำหรับ face recognition

## API Endpoints

- `GET /api/health` - ตรวจสอบสถานะ
- `POST /api/face/enroll` - ลงทะเบียนใบหน้า
- `POST /api/face/recognize` - ยืนยันตัวตน
- `GET /api/face/count` - จำนวนการลงทะเบียน
- `GET /api/face/enrolled` - รายชื่อนักเรียนที่ลงทะเบียนแล้ว
- `DELETE /api/face/enroll` - ลบการลงทะเบียน
