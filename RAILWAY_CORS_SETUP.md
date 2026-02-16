# คู่มือแก้ไขปัญหา CORS Error ใน Railway

## ปัญหา
เมื่อ deploy แล้ว frontend (`https://facein.co`) ไม่สามารถเชื่อมต่อกับ backend (`https://gracious-commitment-backend.up.railway.app`) ได้

**Error Message:**
```
Access to fetch at 'https://gracious-commitment-backend.up.railway.app/api/health' 
from origin 'https://facein.co' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## สาเหตุ
Backend ใน Railway ยังไม่ได้ตั้งค่า `FRONTEND_URLS` environment variable เพื่ออนุญาตให้ `https://facein.co` เข้าถึง API ได้

## วิธีแก้ไข

### ขั้นตอนที่ 1: เข้า Railway Dashboard
1. เข้า [Railway Dashboard](https://railway.app)
2. เลือกโปรเจค **gracious-commitment**
3. เลือก service **backend**

### ขั้นตอนที่ 2: ตั้งค่า Environment Variable
1. ไปที่แท็บ **Variables**
2. คลิก **+ New Variable**
3. ตั้งค่าดังนี้:
   - **Name**: `FRONTEND_URLS`
   - **Value**: 
     ```
     https://facein.co,https://www.facein.co,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
     ```
   
   **หมายเหตุ:** 
   - คั่นด้วย comma (`,`) ไม่มีช่องว่าง
   - รวมทั้ง production domain (`https://facein.co`) และ localhost URLs สำหรับ development

4. คลิก **Add** หรือ **Save**

### ขั้นตอนที่ 3: Redeploy Backend
1. หลังจากตั้งค่า environment variable แล้ว Railway จะ redeploy อัตโนมัติ
2. หรือคลิก **Deploy** → **Redeploy** เพื่อให้แน่ใจ

### ขั้นตอนที่ 4: ตรวจสอบ
1. รอให้ deployment เสร็จ (ประมาณ 1-2 นาที)
2. ลอง refresh หน้าเว็บ `https://facein.co`
3. ตรวจสอบ Browser Console ว่าไม่มี CORS error แล้ว

## Environment Variables ที่ต้องตั้งค่าใน Railway

### สำหรับ Backend:
```
FRONTEND_URLS=https://facein.co,https://www.facein.co,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

### สำหรับ Frontend (Vercel):
ตรวจสอบว่ามี environment variables เหล่านี้:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` (ควรเป็น `https://gracious-commitment-backend.up.railway.app`)

## ตรวจสอบว่า CORS ทำงานถูกต้อง

### วิธีที่ 1: ใช้ Browser DevTools
1. เปิด Browser DevTools (F12)
2. ไปที่ **Network** tab
3. Refresh หน้าเว็บ
4. คลิกที่ request ไปยัง `/api/health`
5. ดู **Response Headers** ควรมี:
   ```
   Access-Control-Allow-Origin: https://facein.co
   Access-Control-Allow-Credentials: true
   ```

### วิธีที่ 2: ใช้ curl
```bash
curl -H "Origin: https://facein.co" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://gracious-commitment-backend.up.railway.app/api/health \
     -v
```

ควรเห็น header:
```
Access-Control-Allow-Origin: https://facein.co
```

## Troubleshooting

### ถ้ายังมี CORS error อยู่:
1. **ตรวจสอบว่า environment variable ถูกตั้งค่าแล้ว**
   - ไปที่ Railway Dashboard → Variables
   - ตรวจสอบว่า `FRONTEND_URLS` มีค่า `https://facein.co` อยู่

2. **ตรวจสอบว่า backend redeploy แล้ว**
   - ดูที่ Railway Dashboard → Deployments
   - ตรวจสอบว่า deployment ล่าสุดมี environment variable ใหม่

3. **ตรวจสอบว่า URL ถูกต้อง**
   - ตรวจสอบว่าไม่มี trailing slash (`/`) ที่ไม่จำเป็น
   - ตรวจสอบว่าใช้ `https://` ไม่ใช่ `http://`

4. **Clear browser cache**
   - กด `Ctrl+Shift+R` (Windows) หรือ `Cmd+Shift+R` (Mac) เพื่อ hard refresh

### ถ้า backend ไม่ restart อัตโนมัติ:
1. ไปที่ Railway Dashboard → Deployments
2. คลิก **Redeploy** เพื่อ force restart

## หมายเหตุ

- **Production:** ใช้ `https://facein.co` และ `https://www.facein.co` (ถ้ามี)
- **Development:** ใช้ `http://localhost:5173` และ `http://127.0.0.1:5173`
- **Vercel Preview:** ถ้ามี preview URLs ให้เพิ่มเข้าไปด้วย เช่น `https://login-face-*.vercel.app`

## ลิงก์ที่เกี่ยวข้อง

- [Railway Dashboard](https://railway.app)
- [FastAPI CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/)
- [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
