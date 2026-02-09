"""
Face Attendance API - PyTorch, RetinaFace, InsightFace
"""
import logging
import os
from fastapi import FastAPI

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from api.routes import face, health

app = FastAPI(
    title="Face Attendance API",
    description="Face detection (RetinaFace) + recognition (DeepFace/Facenet512)",
    version="1.0.0",
)

# CORS Configuration - อ่าน Frontend URLs จาก Environment Variable
# สำหรับ Production: ตั้งค่า FRONTEND_URLS ใน Railway Environment Variables
# สำหรับ Development: ใช้ค่า default
FRONTEND_URLS = os.getenv(
    "FRONTEND_URLS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(face.router, prefix="/api/face", tags=["face"])


@app.get("/", response_class=HTMLResponse)
def root():
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Face Attendance API</title></head>"
        "<body style='font-family:sans-serif;max-width:600px;margin:2rem auto;padding:1rem'>"
        "<h1>Face Attendance API</h1><p>Backend ทำงานอยู่</p>"
        "<ul><li><a href='/docs'>/docs</a> — เอกสาร API</li>"
        "<li><a href='/api/health'>/api/health</a> — ตรวจสอบสถานะ</li></ul>"
        "</body></html>"
    )
    return html
