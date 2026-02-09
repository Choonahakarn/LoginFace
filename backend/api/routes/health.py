from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "face-attendance-api", "message": "Backend ทำงานปกติ"}
