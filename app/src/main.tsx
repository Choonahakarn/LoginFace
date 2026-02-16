import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ตรวจสอบว่า production ใช้ URL จริงหรือยัง (แจ้งเตือนใน console)
const apiUrl = import.meta.env.VITE_API_URL ?? ''
if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && apiUrl.includes('your-backend-url')) {
  console.warn(
    '[Deployment] ยังใช้ Backend URL แบบ placeholder — กรุณาตั้ง VITE_API_URL ใน Vercel/Railway ให้ชี้ไปที่ Backend จริง (ดู DEPLOYMENT_VERIFY.md)'
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
