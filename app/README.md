# ระบบเช็คชื่อนักเรียนด้วยใบหน้า

Face-based student attendance system for teachers. Deploy and share the link for teachers to use.

## โครงสร้างโปรเจกต์

```
src/
├── App.tsx              # จุดเข้าแอป — routing หน้าต่างๆ
├── main.tsx
├── components/ui/       # UI components (Button, Card, Dialog, etc.)
├── hooks/               # Custom hooks
│   ├── useClassRoom.ts  # จัดการห้องเรียน
│   ├── useStudents.ts   # จัดการนักเรียน + face embeddings
│   ├── useAttendance.ts # บันทึกการเข้าเรียน
│   └── useFaceRecognition.ts
├── lib/
│   ├── constants.ts     # ค่าคงที่ (storage keys)
│   ├── faceApi.ts       # Face detection / recognition
│   └── utils.ts
├── sections/            # หน้าหลักของแอป
│   ├── ClassRoomSection.tsx   # เลือก/สร้างห้องเรียน
│   ├── DashboardSection.tsx   # หน้าหลักหลังเลือกห้อง
│   ├── StudentManagementSection.tsx
│   ├── FaceEnrollmentSection.tsx  # ลงทะเบียนใบหน้า
│   ├── AttendanceScanningSection.tsx  # สแกนเช็คชื่อ
│   └── ReportsSection.tsx     # รายงาน PDF/Excel
└── types/index.ts       # TypeScript interfaces
```

## การพัฒนาต่อ

### เริ่มต้น開発
```bash
npm install
npm run dev
```

### Build สำหรับ Deploy
```bash
npm run build
```
ไฟล์จะอยู่ที่ `dist/` — อัปโหลดไป Vercel, Netlify หรือเซิร์ฟเวอร์ใดก็ได้

### มาตรฐานโค้ด
- ใช้ TypeScript
- เก็บค่าคงที่ (storage keys) ที่ `lib/constants.ts`
- Types อยู่ที่ `types/index.ts`
- Component อยู่ใน `components/` หรือ `sections/`

### ข้อมูล
- เก็บใน **localStorage** (ฝั่งเบราว์เซอร์)
- ไม่มี Backend — ข้อมูลอยู่กับเครื่องผู้ใช้
- Key: ดูได้ที่ `lib/constants.ts`

## หน้าที่ของแต่ละหน้า

| หน้า | หน้าที่ |
|------|---------|
| ClassRoomSection | เลือกหรือสร้างห้องเรียน |
| DashboardSection | ภาพรวม ห้อง/นักเรียน/เข้าเรียน |
| StudentManagementSection | จัดการนักเรียนในห้อง |
| FaceEnrollmentSection | ลงทะเบียนใบหน้าของนักเรียน |
| AttendanceScanningSection | สแกนใบหน้าเช็คชื่อ |
| ReportsSection | สร้างรายงาน PDF, Excel, รูป |

## License

MIT
