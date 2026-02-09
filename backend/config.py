"""Configuration for Face Attendance Backend."""
import os

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Face recognition thresholds (Facenet512 cosine sim: same person often > 0.7)
# เพิ่มความแม่นยำ: threshold สูงขึ้นและ margin มากขึ้นเพื่อแยกบุคคลได้ชัดเจนขึ้น
# ป้องกันการจดจำผิดคนเมื่อใบหน้าคล้ายกัน
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.68"))  # เพิ่มจาก 0.62 เป็น 0.68 เพื่อป้องกันการจดจำผิดคน
MIN_MARGIN = float(os.getenv("MIN_MARGIN", "0.12"))  # เพิ่มจาก 0.08 เป็น 0.12 เพื่อแยกบุคคลได้ชัดเจนขึ้นมาก
# Threshold สำหรับความมั่นใจสูงมาก (ใช้สำหรับ early exit)
HIGH_CONFIDENCE_THRESHOLD = float(os.getenv("HIGH_CONFIDENCE_THRESHOLD", "0.78"))  # ความมั่นใจสูงมาก (เพิ่มจาก 0.75)

# Data directory
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)
EMBEDDINGS_DB = os.path.join(DATA_DIR, "embeddings.json")
