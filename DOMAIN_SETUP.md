# คู่มือการตั้งค่าโดเมน Facein.co

> โดเมน: **Facein.co**  
> Frontend: Vercel  
> Backend: Railway  
> DNS: Cloudflare (แนะนำ) หรือผู้ให้บริการโดเมน

---

## 📋 ภาพรวม

- **Frontend (Vercel)**: `https://facein.co` หรือ `https://www.facein.co`
- **Backend (Railway)**: `https://api.facein.co` (subdomain) หรือใช้ Railway URL ปกติ
- **DNS**: จัดการผ่าน Cloudflare หรือผู้ให้บริการโดเมน

---

## 🌐 ขั้นตอนที่ 1: ตั้งค่า DNS ใน Cloudflare

### 1.1 เชื่อมโดเมนกับ Cloudflare

1. ไปที่ [Cloudflare](https://cloudflare.com) → Sign up/Login
2. **Add a Site** → ใส่ `facein.co`
3. Cloudflare จะสแกน DNS records ปัจจุบัน
4. เปลี่ยน **Nameservers** ตามที่ Cloudflare แนะนำ:
   - ไปที่ผู้ให้บริการโดเมน (ที่ซื้อโดเมน)
   - เปลี่ยน Nameservers เป็นที่ Cloudflare ให้มา
   - รอ 24-48 ชั่วโมงให้ DNS propagate

### 1.2 เพิ่ม DNS Records ใน Cloudflare

ไปที่ **DNS → Records** แล้วเพิ่ม:

#### สำหรับ Frontend (Vercel):

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| **A** | `@` | `76.76.21.21` | ✅ Proxied | Auto |
| **CNAME** | `www` | `cname.vercel-dns.com` | ✅ Proxied | Auto |

**หรือ** ถ้า Vercel ให้ IP อื่นมา ให้ใช้ IP ที่ Vercel แนะนำ

#### สำหรับ Backend (Railway) - ถ้าต้องการใช้ subdomain:

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| **CNAME** | `api` | `your-railway-app.up.railway.app` | ❌ DNS only | Auto |

**หมายเหตุ**: Railway ไม่จำเป็นต้องใช้ custom domain ก็ได้ (ใช้ Railway URL ปกติ)

---

## 🚀 ขั้นตอนที่ 2: ตั้งค่าโดเมนใน Vercel (Frontend)

### 2.1 เพิ่มโดเมนใน Vercel

1. ไปที่ [Vercel Dashboard](https://vercel.com)
2. เลือกโปรเจกต์ **login-face-nu** (หรือชื่อโปรเจกต์ของคุณ)
3. ไปที่ **Settings → Domains**
4. คลิก **Add Domain**
5. ใส่โดเมน:
   - `facein.co` (root domain)
   - `www.facein.co` (www subdomain)
6. Vercel จะแสดง **DNS Configuration**:
   - ถ้าใช้ Cloudflare: เพิ่ม A record และ CNAME ตามที่ Vercel แนะนำ
   - หรือใช้ **Nameservers** ที่ Vercel ให้ (ถ้าไม่ใช้ Cloudflare)

### 2.2 ตั้งค่า SSL/TLS

- Vercel จะออก SSL certificate อัตโนมัติ (Let's Encrypt)
- รอ 1-2 นาทีให้ certificate ถูกสร้าง
- ตรวจสอบว่า **SSL: Valid** (สีเขียว)

### 2.3 Redirect www → non-www (Optional)

ใน Vercel → Domains → `www.facein.co`:
- เปิด **Redirect** → Redirect to `facein.co`
- หรือตั้งให้ใช้ทั้งสองแบบ

---

## 🚂 ขั้นตอนที่ 3: ตั้งค่าโดเมนใน Railway (Backend) - Optional

### 3.1 ถ้าต้องการใช้ `api.facein.co`

1. ไปที่ [Railway Dashboard](https://railway.app)
2. เลือก Service (backend)
3. ไปที่ **Settings → Networking**
4. คลิก **Generate Domain** หรือ **Custom Domain**
5. ใส่ subdomain: `api.facein.co`
6. Railway จะให้ **CNAME record** มา
7. ไปที่ Cloudflare → DNS → เพิ่ม CNAME:
   - Type: **CNAME**
   - Name: `api`
   - Target: `your-railway-app.up.railway.app`
   - Proxy: **DNS only** (ปิด Cloudflare Proxy สำหรับ API)

### 3.2 อัปเดต CORS ใน Railway

ถ้าใช้ custom domain สำหรับ backend:

1. Railway → Service → **Variables**
2. แก้ไข `FRONTEND_URLS`:
   ```
   https://facein.co,https://www.facein.co
   ```
3. Railway จะ redeploy อัตโนมัติ

**หรือ** ถ้าไม่ใช้ custom domain:
- ใช้ Railway URL ปกติ: `https://your-app.up.railway.app`
- อัปเดต `FRONTEND_URLS` ให้รวม `https://facein.co` ด้วย

---

## 🔧 ขั้นตอนที่ 4: อัปเดต Environment Variables

### 4.1 ใน Vercel (Frontend)

ไปที่ Vercel → Project → **Settings → Environment Variables**:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://api.facein.co` (ถ้าใช้ custom domain) หรือ `https://your-app.up.railway.app` |
| `VITE_SUPABASE_URL` | `https://txlsbopvbauasqgbdgfk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (anon key จาก Supabase) |

### 4.2 ใน Railway (Backend)

ไปที่ Railway → Service → **Variables**:

| Name | Value |
|------|-------|
| `FRONTEND_URLS` | `https://facein.co,https://www.facein.co` |
| `SUPABASE_URL` | `https://txlsbopvbauasqgbdgfk.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (service_role key จาก Supabase) |

---

## ✅ Checklist

### DNS (Cloudflare)
- [ ] เชื่อมโดเมนกับ Cloudflare แล้ว
- [ ] เปลี่ยน Nameservers ที่ผู้ให้บริการโดเมนแล้ว
- [ ] เพิ่ม A record สำหรับ `@` (root domain)
- [ ] เพิ่ม CNAME สำหรับ `www`
- [ ] (Optional) เพิ่ม CNAME สำหรับ `api` ถ้าใช้ custom domain

### Vercel (Frontend)
- [ ] เพิ่มโดเมน `facein.co` ใน Vercel
- [ ] เพิ่มโดเมน `www.facein.co` (optional)
- [ ] SSL certificate ถูกสร้างแล้ว (Valid)
- [ ] อัปเดต `VITE_API_URL` ให้ชี้ไปที่ backend URL

### Railway (Backend)
- [ ] (Optional) ตั้งค่า custom domain `api.facein.co`
- [ ] อัปเดต `FRONTEND_URLS` ให้รวม `https://facein.co`

### ทดสอบ
- [ ] เปิด `https://facein.co` → เห็นหน้าเว็บ
- [ ] เปิด `https://www.facein.co` → redirect หรือแสดงหน้าเว็บ
- [ ] ทดสอบ login/signup → ทำงานปกติ
- [ ] ทดสอบ face enrollment → ทำงานปกติ
- [ ] (ถ้าใช้ `api.facein.co`) ทดสอบ API → `https://api.facein.co/api/health`

---

## 🐛 Troubleshooting

### DNS ไม่ทำงาน / เว็บไม่ขึ้น

1. **เช็ค DNS Propagation**:
   - ไปที่ [whatsmydns.net](https://www.whatsmydns.net)
   - ใส่ `facein.co` → เช็คว่า A record ถูกต้องหรือไม่
   - รอ 24-48 ชั่วโมงถ้ายังไม่ propagate

2. **เช็ค Cloudflare Proxy**:
   - ถ้าใช้ Cloudflare Proxy (สีส้ม) → ต้องเปิด SSL/TLS = **Full** หรือ **Full (strict)**
   - ถ้าไม่ใช้ Proxy (สีเทา) → ต้องตั้ง SSL/TLS = **Flexible**

3. **เช็ค Vercel Domain Status**:
   - Vercel → Domains → ดูว่าโดเมน **Valid** หรือ **Invalid**
   - ถ้า Invalid → เช็ค DNS records ว่าถูกต้องหรือไม่

### SSL Certificate ไม่ถูกสร้าง

- รอ 5-10 นาที
- ถ้ายังไม่ได้ → ลบโดเมนใน Vercel แล้วเพิ่มใหม่
- เช็คว่า DNS records ถูกต้อง

### CORS Error

- เช็คว่า `FRONTEND_URLS` ใน Railway รวม `https://facein.co` แล้ว
- Redeploy Railway หลังแก้ไข env vars
- เช็ค browser console ดู error message

---

## 📚 เอกสารเพิ่มเติม

- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/domains)
- [Railway Custom Domains](https://docs.railway.app/guides/custom-domains)
- [Cloudflare DNS Setup](https://developers.cloudflare.com/dns/)

---

**Happy Deploying! 🚀**
