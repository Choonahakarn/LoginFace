# ระบบเช็คชื่อนักเรียนด้วยใบหน้า (Face-Based Student Attendance System)

## 📋 สารบัญ

1. [ภาพรวมโปรเจค](#ภาพรวมโปรเจค)
2. [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
3. [เทคโนโลยีที่ใช้](#เทคโนโลยีที่ใช้)
4. [ฟีเจอร์หลัก](#ฟีเจอร์หลัก)
5. [ระบบ Liveness Detection](#ระบบ-liveness-detection)
6. [ระบบ Face Recognition](#ระบบ-face-recognition)
7. [โครงสร้างโค้ด](#โครงสร้างโค้ด)
8. [การทำงานของระบบ](#การทำงานของระบบ)
9. [การปรับปรุงและ Optimization](#การปรับปรุงและ-optimization)
10. [การ Deploy และใช้งาน](#การ-deploy-และใช้งาน)

---

## 🎯 ภาพรวมโปรเจค

**ระบบเช็คชื่อนักเรียนด้วยใบหน้า** เป็นระบบจัดการการเข้าเรียนอัตโนมัติที่ใช้เทคโนโลยี Face Recognition และ Liveness Detection เพื่อป้องกันการสวมสิทธิ์ โดยระบบสามารถ:

- ✅ ตรวจจับและจดจำใบหน้าของนักเรียนอัตโนมัติ
- ✅ ป้องกันการสวมสิทธิ์ด้วยรูปภาพ (Anti-spoofing)
- ✅ จัดการข้อมูลนักเรียนและห้องเรียน
- ✅ สร้างรายงานการเข้าเรียน (PDF, Excel)
- ✅ รองรับหลายห้องเรียนพร้อมกัน

### เป้าหมายหลัก
1. **ความแม่นยำ**: ตรวจจับใบหน้าได้แม่นยำและรวดเร็ว
2. **ความปลอดภัย**: ป้องกันการสวมสิทธิ์ด้วยรูปภาพหรือวิดีโอ
3. **ความสะดวก**: ใช้งานง่าย ผ่านได้เร็ว (1-2 วินาที)
4. **ประสิทธิภาพ**: รองรับการใช้งานจริงในห้องเรียน

---

## 🏗️ สถาปัตยกรรมระบบ

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   UI Layer   │  │  State Mgmt  │  │  Camera API   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Liveness Detection (MediaPipe)               │  │
│  │  • Blink Detection                                    │  │
│  │  • Head Movement Detection                            │  │
│  │  • Texture Analysis                                   │  │
│  │  • Frame Variation Check                              │  │
│  │  • Discontinuity Detection                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│              Backend (FastAPI + Python)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Face Recognition (DeepFace + Facenet512)       │  │
│  │  • Face Embedding Extraction                         │  │
│  │  • Similarity Matching                               │  │
│  │  • Embedding Storage                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: React 19.2.0 + TypeScript 5.9
- **Build Tool**: Vite 7.2
- **UI Library**: Radix UI + Tailwind CSS
- **State Management**: React Hooks (useState, useRef, useCallback)
- **Face Detection**: MediaPipe BlazeFace
- **Liveness Detection**: MediaPipe Face Landmarker

#### Backend
- **Framework**: FastAPI 0.109+
- **Face Recognition**: DeepFace + Facenet512
- **Image Processing**: OpenCV, NumPy, Pillow
- **Server**: Uvicorn

#### Data Storage
- **Frontend**: LocalStorage (นักเรียน, ห้องเรียน, การเข้าเรียน)
- **Backend**: JSON File (Face Embeddings)

---

## 🛠️ เทคโนโลยีที่ใช้

### 1. MediaPipe (Google)
- **BlazeFace**: Face Detection (ตรวจจับใบหน้า)
- **Face Landmarker**: Facial Landmarks (468 จุด) สำหรับ Liveness Detection
- **ข้อดี**: เร็ว, ทำงานบน Browser ได้, รองรับ GPU acceleration

### 2. DeepFace + Facenet512
- **Facenet512**: Face Recognition Model (512-dimensional embeddings)
- **ข้อดี**: แม่นยำสูง, รองรับหลายมุมมอง, ทำงานได้ดีกับใบหน้าจริง

### 3. React + TypeScript
- **Type Safety**: ป้องกัน bugs ด้วย TypeScript
- **Component-based**: แยกส่วน UI เป็น components
- **Hooks**: จัดการ state และ lifecycle

### 4. FastAPI
- **Async Support**: รองรับ async/await
- **Auto Documentation**: Swagger UI อัตโนมัติ
- **Type Validation**: Pydantic schemas

---

## ✨ ฟีเจอร์หลัก

### 1. ระบบจัดการห้องเรียน (Classroom Management)
- ✅ สร้าง/แก้ไข/ลบห้องเรียน
- ✅ ตั้งค่าชื่อห้องเรียน
- ✅ ตั้งค่าเวลาผ่อนผันการมาสาย (Late Grace Minutes)
- ✅ เลือกห้องเรียนก่อนใช้งาน

**ไฟล์**: `app/src/sections/ClassRoomSection.tsx`

### 2. ระบบจัดการนักเรียน (Student Management)
- ✅ เพิ่ม/แก้ไข/ลบข้อมูลนักเรียน
- ✅ ค้นหานักเรียน (ชื่อ, รหัสนักเรียน)
- ✅ จัดการนักเรียนหลายห้องเรียน
- ✅ แสดงสถานะการลงทะเบียนใบหน้า

**ไฟล์**: `app/src/sections/StudentManagementSection.tsx`

### 3. ระบบลงทะเบียนใบหน้า (Face Enrollment)
- ✅ ลงทะเบียนใบหน้าผ่านกล้อง
- ✅ ลงทะเบียนหลายรูป (เพิ่มความแม่นยำ)
- ✅ ตรวจสอบความซ้ำซ้อน (ป้องกันลงทะเบียนซ้ำ)
- ✅ แสดงความมั่นใจ (Confidence Score)

**ไฟล์**: `app/src/sections/FaceEnrollmentSection.tsx`

### 4. ระบบสแกนเช็คชื่อ (Attendance Scanning)
- ✅ สแกนใบหน้าอัตโนมัติ
- ✅ Liveness Detection (ป้องกันรูปภาพ)
- ✅ แสดงผลแบบ Real-time
- ✅ บันทึกการเข้าเรียนอัตโนมัติ
- ✅ รองรับการมาสาย/ขาดเรียน

**ไฟล์**: `app/src/sections/AttendanceScanningSection.tsx`

### 5. ระบบรายงาน (Reports)
- ✅ สร้างรายงาน PDF
- ✅ สร้างรายงาน Excel
- ✅ สร้างรายงานรูปภาพ
- ✅ กรองตามวันที่/ห้องเรียน
- ✅ สถิติการเข้าเรียน

**ไฟล์**: `app/src/sections/ReportsSection.tsx`

### 6. Dashboard
- ✅ แสดงภาพรวมห้องเรียน
- ✅ สถิติการเข้าเรียนวันนี้
- ✅ แสดงจำนวนนักเรียน
- ✅ แสดงสถานะการเข้าเรียน (มาเรียน/มาสาย/ขาด)

**ไฟล์**: `app/src/sections/DashboardSection.tsx`

---

## 🔒 ระบบ Liveness Detection

### วัตถุประสงค์
ป้องกันการใช้รูปภาพ 2D หรือวิดีโอแทนใบหน้า 3D จริง

### วิธีการตรวจสอบ (Multi-Layer Protection)

#### 1. Blink Detection (การตรวจจับการกระพริบตา)
**วิธี**: ใช้ EAR (Eye Aspect Ratio) วิเคราะห์การปิด-เปิดตา

```typescript
EAR = (vertical1 + vertical2) / (2 * horizontal)
```

**Thresholds**:
- ตาปิด: `0.17` (ผ่อนให้จับได้ง่าย)
- ตาเปิด: `0.23` (ผ่อนให้จับได้ง่าย)

**Pattern ที่รับ**:
- ปิด (ทั้งสองตา) → เปิด
- เปิด → ปิด (ทั้งสองตา) → เปิด
- ปิด (ตาใดตาหนึ่ง) → เปิด (ผ่อนมาก)

**History**: ดู 15 เฟรมล่าสุด

**ข้อกำหนด**: ต้องทั้งสองตาปิดพร้อมกัน (กันรูปภาพ)

**ไฟล์**: `app/src/lib/livenessDetection.ts` (ฟังก์ชัน `detectBlink`)

---

#### 2. Discontinuity Check (ตรวจการกระตุก)
**วิธี**: ตรวจการเปลี่ยนแปลงของ landmarks แบบกระตุก (ไม่ต่อเนื่อง)

**Thresholds**:
- `DISCONTINUITY_THRESHOLD = 0.025` (เข้มงวด)
- `discontinuityRatio > 0.2` (20% ของเฟรมมีกระตุก = บล็อก)

**จุดตรวจ**: ตา, จมูก, ปาก (5 จุดหลัก)

**ตรวจจับ**: รูปภาพที่เอียง/หมุน (การเปลี่ยนแปลงแบบกระตุก)

**ไฟล์**: `app/src/lib/livenessDetection.ts` (ส่วน Discontinuity Check)

---

#### 3. Head Movement Detection (การขยับหัว)
**วิธี**: วิเคราะห์ Yaw, Pitch, Roll จาก landmarks

**Threshold**: 4 องศา

**ตรวจ**: การเคลื่อนไหวต่อเนื่องและราบรื่น (ไม่กระตุก)

**ไฟล์**: `app/src/lib/livenessDetection.ts` (ฟังก์ชัน `detectHeadMovement`)

---

#### 4. Texture Analysis (วิเคราะห์พื้นผิว)
**วิธี**: วิเคราะห์ความแตกต่างระหว่างรูป 2D กับใบหน้า 3D

**ตรวจ 3 อย่าง**:
1. **Variance** (ความแปรปรวนของ pixel): `> 270`
2. **Edge Density** (ความหนาแน่นของขอบ): `> 0.15`
3. **Local Variance** (ความแปรปรวนในพื้นที่เล็กๆ): `> 160`

**ต้องผ่าน**: อย่างน้อย 2 ใน 3

**ไฟล์**: `app/src/lib/livenessDetection.ts` (ฟังก์ชัน `analyzeTexture`)

---

#### 5. Frame Variation Check (ตรวจการเปลี่ยนแปลงของเฟรม)
**วิธี**: ตรวจการเปลี่ยนแปลงของ pixel และ hash ของเฟรม

**ตรวจ 4 อย่าง**:
1. Hash Variation Ratio: `> 0.45`
2. Variance Coefficient: `> 0.12`
3. Variance Std Dev: `> 15`
4. Smooth Change (การเปลี่ยนแปลงต่อเนื่อง)

**ต้องผ่าน**: อย่างน้อย 3 ใน 4

**ตรวจจับ**: รูปภาพที่เอียง/เปลี่ยนมุมแสง (การเปลี่ยนแปลงไม่ต่อเนื่อง)

**ไฟล์**: `app/src/lib/livenessDetection.ts` (ฟังก์ชัน `checkFrameVariation`)

---

#### 6. Static Photo Check (ตรวจรูปภาพนิ่ง)
**วิธี**: เปรียบเทียบ pixel ระหว่างเฟรม

**หลัง Liveness ผ่าน**:
- `minChangeToAllow = 0.5%` (ผ่อนมาก)
- `threshold = 2` (ต่ำมาก)
- ไม่บังคับ quadrant (เร็วขึ้น)

**ไฟล์**: `app/src/sections/AttendanceScanningSection.tsx` (ฟังก์ชัน `checkNotObviouslyStaticPhoto`)

---

#### 7. Screen Capture Detection (ตรวจจับหน้าจอ)
**วิธี**: ตรวจคุณสมบัติของ MediaStream

**ตรวจจับ**: รูปภาพในโทรศัพท์/หน้าจอ

**ไฟล์**: `app/src/lib/livenessDetection.ts` (ฟังก์ชัน `detectScreenCapture`)

---

### Flow การทำงานของ Liveness Detection

```
1. ตรวจจับใบหน้า (MediaPipe BlazeFace)
   ↓
2. ตรวจ Screen Capture (บล็อกทันทีถ้าเป็นหน้าจอ)
   ↓
3. ตรวจ Static Photo (บล็อกถ้าไม่มีการเปลี่ยนแปลง)
   ↓
4. ตรวจ Discontinuity (บล็อกถ้ามีการกระตุก)
   ↓
5. Blink Detection (ต้องผ่าน)
   ↓
6. ถ้า Blink ผ่าน → ตรวจ Texture + Frame Variation (บังคับผ่าน)
   ↓
7. ถ้าผ่านทั้งหมด → อนุญาตให้เช็คชื่อ
```

---

## 👤 ระบบ Face Recognition

### Backend Architecture

#### 1. Face Embedding Extraction
**Model**: Facenet512 (512-dimensional embeddings)

**Process**:
1. รับรูปภาพจาก Frontend (Base64)
2. Detect Face (Haar Cascade หรือ Center Crop)
3. Preprocess (Resize to 160x160)
4. Extract Embedding (Facenet512)
5. Normalize Embedding

**ไฟล์**: `backend/services/face_service.py`

```python
def get_embedding_from_base64(image_base64: str) -> list[float]:
    # 1. Decode Base64
    # 2. Detect/Crop Face
    # 3. Extract Embedding (Facenet512)
    # 4. Normalize
    return normalized_embedding
```

---

#### 2. Face Recognition (Similarity Matching)
**Method**: Cosine Similarity

**Process**:
1. รับ Embedding จาก Frontend
2. โหลด Embeddings ทั้งหมดของห้องเรียน
3. คำนวณ Similarity กับทุก Embedding
4. หา Maximum Similarity
5. เปรียบเทียบกับ Threshold (`SIMILARITY_THRESHOLD`)

**Threshold**:
- Default: `0.65` (65% similarity)
- ปรับได้ตามความต้องการ

**ไฟล์**: `backend/api/routes/face.py`

```python
def recognize_face(class_id: str, embedding: list[float]) -> RecognizeResponse:
    # 1. Load all embeddings for class
    # 2. Calculate similarity
    # 3. Find max similarity
    # 4. Compare with threshold
    return RecognizeResponse(student_id, similarity)
```

---

#### 3. Face Enrollment
**Process**:
1. รับรูปภาพจาก Frontend
2. Extract Embedding
3. ตรวจสอบความซ้ำซ้อน (Duplicate Check)
4. บันทึก Embedding พร้อม Metadata

**Duplicate Prevention**:
- ตรวจสอบ Similarity กับ Embeddings อื่นๆ
- ถ้า Similarity > Threshold → ปฏิเสธการลงทะเบียน

**ไฟล์**: `backend/api/routes/face.py` (endpoint `/enroll`)

---

### Frontend Integration

#### API Calls
**ไฟล์**: `app/src/api/face.ts`

```typescript
// Enroll Face
async function enrollFace(classId: string, studentId: string, imageBase64: string)

// Recognize Face
async function recognizeFace(classId: string, imageBase64: string)
```

---

## 📁 โครงสร้างโค้ด

### Frontend Structure

```
app/src/
├── App.tsx                          # จุดเข้าแอป — routing
├── main.tsx                         # Entry point
│
├── components/ui/                   # UI Components (Radix UI)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
│
├── hooks/                           # Custom Hooks
│   ├── useClassRoom.ts             # จัดการห้องเรียน
│   ├── useStudents.ts              # จัดการนักเรียน
│   ├── useAttendance.ts            # บันทึกการเข้าเรียน
│   └── useBackendFace.ts           # API calls สำหรับ Face Recognition
│
├── lib/                             # Utilities & Core Logic
│   ├── livenessDetection.ts        # Liveness Detection Logic
│   ├── mediapipeApi.ts             # MediaPipe Face Detection
│   ├── captureFrame.ts             # Image Capture Utilities
│   └── constants.ts                # Constants
│
├── sections/                        # Main Pages
│   ├── ClassRoomSection.tsx         # เลือก/สร้างห้องเรียน
│   ├── DashboardSection.tsx         # Dashboard
│   ├── StudentManagementSection.tsx # จัดการนักเรียน
│   ├── FaceEnrollmentSection.tsx    # ลงทะเบียนใบหน้า
│   ├── AttendanceScanningSection.tsx # สแกนเช็คชื่อ
│   └── ReportsSection.tsx           # รายงาน
│
├── api/                             # API Clients
│   ├── face.ts                      # Face Recognition API
│   └── index.ts
│
└── types/                           # TypeScript Types
    ├── app.ts
    ├── domain.ts
    ├── attendance.ts
    └── face.ts
```

---

### Backend Structure

```
backend/
├── main.py                          # FastAPI App Entry Point
│
├── api/routes/                      # API Routes
│   ├── face.py                      # Face Recognition Endpoints
│   └── health.py                    # Health Check
│
├── services/                        # Business Logic
│   └── face_service.py              # Face Detection & Embedding
│
├── repositories/                    # Data Access Layer
│   └── embedding_store.py           # Embedding Storage
│
├── schemas/                         # Pydantic Schemas
│   └── face.py                      # Request/Response Models
│
├── core/                            # Core Utilities
│   └── face_service.py             # Shared Face Logic
│
├── config.py                        # Configuration
└── requirements.txt                 # Dependencies
```

---

## ⚙️ การทำงานของระบบ

### 1. Flow การลงทะเบียนใบหน้า

```
User → FaceEnrollmentSection
  ↓
1. เปิดกล้อง
  ↓
2. Detect Face (MediaPipe BlazeFace)
  ↓
3. Capture Frame (Base64)
  ↓
4. Send to Backend (/api/face/enroll)
  ↓
5. Backend: Extract Embedding (Facenet512)
  ↓
6. Backend: Check Duplicate
  ↓
7. Backend: Save Embedding
  ↓
8. Frontend: Update UI (แสดงความสำเร็จ)
```

---

### 2. Flow การสแกนเช็คชื่อ

```
User → AttendanceScanningSection
  ↓
1. เปิดกล้อง
  ↓
2. Detect Face (MediaPipe BlazeFace) - ทุก 8ms
  ↓
3. Liveness Detection (MediaPipe Face Landmarker)
   ├─ Screen Capture Check
   ├─ Static Photo Check
   ├─ Discontinuity Check
   ├─ Blink Detection ← ต้องผ่าน
   ├─ Head Movement Detection
   ├─ Texture Analysis ← ต้องผ่าน (ถ้า Blink ผ่าน)
   └─ Frame Variation Check ← ต้องผ่าน (ถ้า Blink ผ่าน)
  ↓
4. ถ้าผ่าน Liveness → Capture Frame (Base64)
  ↓
5. Send to Backend (/api/face/recognize)
  ↓
6. Backend: Extract Embedding
  ↓
7. Backend: Match with Stored Embeddings
  ↓
8. Backend: Return Student ID + Similarity
  ↓
9. Frontend: บันทึกการเข้าเรียน (LocalStorage)
  ↓
10. Frontend: แสดงผล (Popup, Update UI)
```

---

### 3. Flow การจัดการข้อมูล

**LocalStorage Structure**:
```typescript
{
  "classrooms": [
    {
      "id": "class-1",
      "name": "ห้องเรียน 1",
      "lateGraceMinutes": 15
    }
  ],
  "students": [
    {
      "id": "student-1",
      "studentId": "001",
      "firstName": "ชื่อ",
      "lastName": "นามสกุล",
      "classIds": ["class-1"]
    }
  ],
  "attendance": [
    {
      "id": "attendance-1",
      "studentId": "student-1",
      "classId": "class-1",
      "timestamp": "2026-02-08T10:00:00Z",
      "status": "present" | "late" | "absent"
    }
  ]
}
```

---

## 🚀 การปรับปรุงและ Optimization

### 1. Performance Optimization

#### Frontend
- ✅ **Scan Interval**: `8ms` (สแกนถี่มาก)
- ✅ **Scan Cooldown**: `15ms` (ลดเวลารอ)
- ✅ **Frame Skipping**: Skip detector บางเฟรม (reuse face box)
- ✅ **Image Quality**: ลด quality เป็น `0.65` (ลด payload)
- ✅ **Video Resolution**: `640x480` (ลด processing load)
- ✅ **Canvas Size**: ลดขนาด canvas สำหรับ texture analysis (128x128)

#### Backend
- ✅ **Model Caching**: Cache Facenet512 model (ไม่โหลดซ้ำ)
- ✅ **Async Processing**: ใช้ async/await สำหรับ I/O operations
- ✅ **Embedding Normalization**: Normalize embeddings เพื่อความเร็ว

---

### 2. Liveness Detection Optimization

#### Speed Improvements
- ✅ **ลดเฟรมขั้นต่ำ**: จาก 2 → 1 เฟรม (เริ่มตรวจเร็วขึ้น)
- ✅ **Blink Detection**: ดู 15 เฟรม, รับหลาย pattern (ผ่านเร็วขึ้น)
- ✅ **Static Check**: ผ่อนเกณฑ์หลัง Liveness ผ่าน (0.5% change)
- ✅ **Conditional Checks**: รัน texture/frame variation เฉพาะเมื่อ blink ผ่านแล้ว

#### Security Enhancements
- ✅ **Discontinuity Check**: เข้มงวดขึ้น (threshold 0.025, ratio 0.2)
- ✅ **Frame Variation**: เข้มงวดขึ้น (thresholds เพิ่มขึ้น)
- ✅ **Texture Analysis**: เข้มงวดขึ้น (thresholds เพิ่มขึ้น)
- ✅ **บังคับการตรวจสอบ**: แม้ blink ผ่านแล้ว ยังต้องผ่าน Frame Variation และ Texture Analysis

---

### 3. Code Quality

- ✅ **TypeScript**: Type safety ทั่วทั้งโปรเจค
- ✅ **Component-based**: แยก UI เป็น components
- ✅ **Custom Hooks**: จัดการ state logic แยกออกมา
- ✅ **Error Handling**: จัดการ errors อย่างละเอียด
- ✅ **Code Comments**: มี comments อธิบาย logic สำคัญ

---

## 📦 การ Deploy และใช้งาน

### Frontend Deployment

#### Development
```bash
cd app
npm install
npm run dev
# เปิดที่ http://localhost:5173
```

#### Production Build
```bash
cd app
npm run build
# ไฟล์จะอยู่ที่ dist/
```

#### Deploy Options
- **Vercel**: `vercel deploy`
- **Netlify**: อัปโหลด `dist/` folder
- **Static Hosting**: อัปโหลด `dist/` ไปยังเซิร์ฟเวอร์

---

### Backend Deployment

#### Development
```bash
cd backend
pip install -r requirements.txt
python main.py
# หรือ
uvicorn main:app --reload
# เปิดที่ http://localhost:8000
```

#### Production
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

#### Docker (Optional)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### Configuration

#### Frontend
- **API URL**: แก้ไขที่ `app/src/api/face.ts`
- **CORS**: ตั้งค่า CORS ที่ Backend

#### Backend
- **SIMILARITY_THRESHOLD**: แก้ไขที่ `backend/config.py`
- **DATA_DIR**: แก้ไขที่ `backend/config.py`

---

## 📊 สรุปผลลัพธ์

### Performance Metrics
- ✅ **Scan Speed**: 1-2 วินาทีต่อคน (หลังกระพริบตา)
- ✅ **Accuracy**: แม่นยำสูง (Facenet512)
- ✅ **Security**: ป้องกันรูปภาพได้ดี (Multi-layer Liveness Detection)

### Features Completed
- ✅ ระบบจัดการห้องเรียน
- ✅ ระบบจัดการนักเรียน
- ✅ ระบบลงทะเบียนใบหน้า
- ✅ ระบบสแกนเช็คชื่อ (พร้อม Liveness Detection)
- ✅ ระบบรายงาน (PDF, Excel)
- ✅ Dashboard

### Security Features
- ✅ Blink Detection (บังคับ)
- ✅ Discontinuity Detection (ตรวจจับรูปภาพที่เอียง)
- ✅ Texture Analysis (แยกระหว่าง 2D และ 3D)
- ✅ Frame Variation Check (ตรวจจับการเปลี่ยนแปลงไม่ต่อเนื่อง)
- ✅ Screen Capture Detection (ตรวจจับหน้าจอ)

---

## 🎓 สิ่งที่ได้เรียนรู้

1. **Face Recognition**: การใช้ DeepFace และ Facenet512
2. **Liveness Detection**: การป้องกันการสวมสิทธิ์ด้วยหลายวิธี
3. **MediaPipe**: การใช้ MediaPipe สำหรับ Face Detection และ Landmarks
4. **React + TypeScript**: การพัฒนา Frontend ด้วย React และ TypeScript
5. **FastAPI**: การสร้าง REST API ด้วย FastAPI
6. **Performance Optimization**: การปรับปรุงประสิทธิภาพของระบบ
7. **Security**: การป้องกันการสวมสิทธิ์ด้วยรูปภาพ

---

## 🔮 การพัฒนาต่อ

### Features ที่สามารถเพิ่มได้
1. **Database**: เปลี่ยนจาก LocalStorage เป็น Database (PostgreSQL, MongoDB)
2. **Authentication**: เพิ่มระบบ Login/Logout
3. **Multi-class Support**: รองรับนักเรียนหลายห้องเรียนพร้อมกัน
4. **Real-time Sync**: Sync ข้อมูลระหว่างหลาย devices
5. **Mobile App**: พัฒนา Mobile App (React Native)
6. **Analytics**: เพิ่ม Analytics Dashboard
7. **Notifications**: แจ้งเตือนการเข้าเรียน

### Technical Improvements
1. **Web Workers**: ใช้ Web Workers สำหรับ Face Detection (ไม่ block UI)
2. **Model Optimization**: ใช้โมเดลที่เบากว่า (MobileNet)
3. **Caching**: เพิ่ม Caching สำหรับ Embeddings
4. **Error Recovery**: ปรับปรุง Error Handling
5. **Testing**: เพิ่ม Unit Tests และ Integration Tests

---

## 💻 ตัวอย่างโค้ดสำคัญ

### 1. Liveness Detection - Blink Detection

```typescript
// app/src/lib/livenessDetection.ts

function detectBlink(landmarks: NormalizedLandmark[]): boolean {
  const leftEAR = calculateEAR(landmarks, LEFT_EYE_POINTS);
  const rightEAR = calculateEAR(landmarks, RIGHT_EYE_POINTS);
  const avgEAR = (leftEAR + rightEAR) / 2;
  
  const EAR_THRESHOLD_CLOSED = 0.17;  // ตาปิด
  const EAR_THRESHOLD_OPEN = 0.23;    // ตาเปิด
  
  if (landmarksHistory.length < 1) return false;
  
  // ดู 15 เฟรมล่าสุด
  const recentEARs = landmarksHistory.slice(-15).map(h => {
    const left = calculateEAR(h.landmarks, LEFT_EYE_POINTS);
    const right = calculateEAR(h.landmarks, RIGHT_EYE_POINTS);
    const avg = (left + right) / 2;
    return {
      avg,
      bothClosed: left < EAR_THRESHOLD_CLOSED && right < EAR_THRESHOLD_CLOSED,
      clearlyClosed: avg < 0.18 || (left < EAR_THRESHOLD_CLOSED && right < EAR_THRESHOLD_CLOSED),
    };
  });
  
  // Pattern: ปิด (ทั้งสองตา) -> เปิด
  for (let i = 0; i < recentEARs.length - 1; i++) {
    const curr = recentEARs[i];
    const next = recentEARs[i + 1];
    const openNext = next.avg > EAR_THRESHOLD_OPEN;
    if (curr.bothClosed && openNext) return true;
  }
  return false;
}
```

---

### 2. Face Recognition - Backend API

```python
# backend/api/routes/face.py

@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(request: RecognizeRequest):
    embedding = get_embedding_from_base64(request.image_base64)
    embeddings_data = get_all_for_class(request.class_id)
    
    best_match = None
    best_similarity = 0.0
    
    for item in embeddings_data:
        similarity = embedding_similarity(embedding, item["embedding"])
        if similarity > best_similarity:
            best_similarity = similarity
            best_match = item
    
    if best_similarity >= SIMILARITY_THRESHOLD:
        return RecognizeResponse(
            student_id=best_match["student_id"],
            similarity=best_similarity,
            recognized=True
        )
    else:
        return RecognizeResponse(
            student_id=None,
            similarity=best_similarity,
            recognized=False
        )
```

---

### 3. Attendance Scanning - Main Loop

```typescript
// app/src/sections/AttendanceScanningSection.tsx

const performScan = useCallback(async () => {
  if (scanInProgressRef.current) return;
  scanInProgressRef.current = true;
  
  try {
    // 1. Detect Face
    const faceBox = await detectFaceFromVideo(videoRef.current!);
    if (!faceBox) return;
    
    // 2. Liveness Detection
    const livenessResult = await detectLiveness(
      videoRef.current!,
      Date.now(),
      faceBox
    );
    
    if (!livenessResult.passed) {
      setFaceBoxLabel({ isUnknown: true, similarity: 0, hint: livenessResult.reasons[0] });
      return;
    }
    
    // 3. Static Photo Check
    if (!checkNotObviouslyStaticPhoto(faceBox, true)) {
      return;
    }
    
    // 4. Capture Frame & Recognize
    const imageBase64 = await captureFaceCropAsBase64(videoRef.current!, faceBox);
    const result = await recognizeFace(classId, imageBase64);
    
    if (result.recognized && result.studentId) {
      // 5. Record Attendance
      recordAttendance(result.studentId, classId, 'present');
      setLastResult({ studentName: result.studentName, ...result });
    }
  } finally {
    scanInProgressRef.current = false;
  }
}, [classId, recordAttendance]);
```

---

### 4. Face Enrollment - Duplicate Check

```python
# backend/api/routes/face.py

def _check_duplicate(class_id: str, embedding: list[float], exclude_student_id: str):
    """ตรวจสอบความซ้ำซ้อนก่อนลงทะเบียน"""
    threshold = 0.65  # Facenet512
    candidates = get_all_for_class(class_id)
    
    for item in candidates:
        if item["student_id"] == exclude_student_id:
            continue
        
        similarity = embedding_similarity(embedding, item["embedding"])
        if similarity >= threshold:
            return (item["student_id"], similarity)
    
    return None
```

---

## 🎯 Use Cases และ Scenarios

### Scenario 1: ลงทะเบียนใบหน้าใหม่
1. ครูเลือกห้องเรียน
2. ไปที่หน้า "จัดการนักเรียน"
3. เพิ่มนักเรียนใหม่
4. ไปที่หน้า "ลงทะเบียนใบหน้า"
5. เลือกนักเรียน
6. เปิดกล้อง → ตรวจจับใบหน้า
7. กดบันทึก → ส่งไป Backend
8. Backend ตรวจสอบความซ้ำซ้อน
9. บันทึก Embedding
10. แสดงความสำเร็จ

---

### Scenario 2: สแกนเช็คชื่อ
1. ครูไปที่หน้า "สแกนเช็คชื่อ"
2. เปิดกล้อง
3. นักเรียนมายืนหน้ากล้อง
4. ระบบตรวจจับใบหน้า (ทุก 8ms)
5. Liveness Detection:
   - ตรวจ Screen Capture ✅
   - ตรวจ Static Photo ✅
   - ตรวจ Discontinuity ✅
   - ตรวจ Blink ← นักเรียนกระพริบตา ✅
   - ตรวจ Texture ✅
   - ตรวจ Frame Variation ✅
6. Capture Frame → ส่งไป Backend
7. Backend: Extract Embedding → Match
8. พบนักเรียน → บันทึกการเข้าเรียน
9. แสดง Popup: "เช็คชื่อสำเร็จ"

---

### Scenario 3: ดูรายงาน
1. ครูไปที่หน้า "รายงาน"
2. เลือกวันที่
3. เลือกห้องเรียน
4. กด "สร้างรายงาน PDF"
5. ระบบสร้าง PDF พร้อมข้อมูลการเข้าเรียน
6. ดาวน์โหลด PDF

---

## 🔍 Technical Challenges และ Solutions

### Challenge 1: ความเร็วในการสแกน
**ปัญหา**: ระบบช้าเกินไป (ใช้เวลานานกว่า 2-3 วินาที)

**วิธีแก้**:
- ลด Scan Interval เป็น 8ms
- Skip detector บางเฟรม (reuse face box)
- ลด Image Quality เป็น 0.65
- ลด Video Resolution เป็น 640x480
- ผ่อน Static Check หลัง Liveness ผ่าน

**ผลลัพธ์**: ลดเวลาลงเหลือ 1-2 วินาที

---

### Challenge 2: การป้องกันรูปภาพ
**ปัญหา**: รูปภาพสามารถผ่านได้ (สวมสิทธิ์)

**วิธีแก้**:
- เพิ่ม Blink Detection (บังคับ)
- เพิ่ม Discontinuity Check (ตรวจจับการกระตุก)
- เพิ่ม Texture Analysis (แยกระหว่าง 2D และ 3D)
- เพิ่ม Frame Variation Check (ตรวจจับการเปลี่ยนแปลงไม่ต่อเนื่อง)
- เพิ่ม Screen Capture Detection

**ผลลัพธ์**: ป้องกันรูปภาพได้ดีขึ้น

---

### Challenge 3: รูปภาพที่เอียง/เปลี่ยนมุมแสง
**ปัญหา**: รูปภาพที่เอียงหรือเปลี่ยนมุมแสงยังผ่านได้

**วิธีแก้**:
- เข้มงวด Discontinuity Check (threshold 0.025, ratio 0.2)
- เข้มงวด Frame Variation Check (thresholds เพิ่มขึ้น)
- บังคับให้ผ่าน Frame Variation แม้ Blink ผ่านแล้ว

**ผลลัพธ์**: ตรวจจับรูปภาพที่เอียงได้ดีขึ้น

---

### Challenge 4: ใบหน้าจริงถูกบล็อก
**ปัญหา**: ใบหน้าจริงผ่านยาก (ต้องกระพริบหลายครั้ง)

**วิธีแก้**:
- ผ่อน Blink Detection (EAR thresholds ลดลง)
- รับหลาย Pattern (ปิด→เปิด, เปิด→ปิด→เปิด)
- ผ่อน Static Check หลัง Liveness ผ่าน
- ลดเฟรมขั้นต่ำ (จาก 2 → 1)

**ผลลัพธ์**: ใบหน้าจริงผ่านได้เร็วขึ้น

---

## 📈 Performance Benchmarks

### Liveness Detection
- **Blink Detection**: ~100-200ms (หลังมีข้อมูลเพียงพอ)
- **Texture Analysis**: ~50-100ms
- **Frame Variation**: ~30-50ms
- **Total Liveness Check**: ~200-350ms

### Face Recognition
- **Face Detection**: ~20-50ms (MediaPipe BlazeFace)
- **Embedding Extraction**: ~100-200ms (Facenet512)
- **Similarity Matching**: ~10-50ms (ขึ้นกับจำนวน Embeddings)
- **Total Recognition**: ~130-300ms

### Overall Scan Time
- **Best Case**: ~1 วินาที (หลัง Liveness ผ่าน)
- **Average Case**: ~1.5-2 วินาที
- **Worst Case**: ~3-5 วินาที (ถ้า Liveness ไม่ผ่าน)

---

## 📝 สรุป

ระบบเช็คชื่อนักเรียนด้วยใบหน้าเป็นระบบที่ใช้เทคโนโลยี Face Recognition และ Liveness Detection เพื่อจัดการการเข้าเรียนอัตโนมัติ โดยระบบสามารถ:

- ✅ ตรวจจับและจดจำใบหน้าของนักเรียนได้แม่นยำ
- ✅ ป้องกันการสวมสิทธิ์ด้วยรูปภาพ (Anti-spoofing)
- ✅ ใช้งานง่าย ผ่านได้เร็ว (1-2 วินาที)
- ✅ รองรับการใช้งานจริงในห้องเรียน

ระบบนี้แสดงให้เห็นถึงความสามารถในการ:
- **ออกแบบระบบ**: สถาปัตยกรรมที่ชัดเจน แยก Frontend/Backend
- **ใช้เทคโนโลยี**: MediaPipe, DeepFace, React, FastAPI
- **แก้ปัญหา**: Liveness Detection เพื่อป้องกันการสวมสิทธิ์
- **ปรับปรุงประสิทธิภาพ**: Optimization เพื่อให้ใช้งานได้เร็ว
- **แก้ปัญหา Technical Challenges**: แก้ปัญหาความเร็ว, ความปลอดภัย, และ UX

---

## 📚 References

- [MediaPipe Documentation](https://mediapipe.dev/)
- [DeepFace Documentation](https://github.com/serengil/deepface)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

---

**สร้างโดย**: [ชื่อของคุณ]  
**วันที่**: กุมภาพันธ์ 2026  
**เวอร์ชัน**: 1.0.0
