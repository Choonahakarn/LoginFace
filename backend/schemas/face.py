from pydantic import BaseModel


class EnrollRequest(BaseModel):
    user_id: str  # Supabase user UUID
    class_id: str  # Supabase classroom UUID
    student_id: str  # Supabase student UUID
    image_base64: str
    allow_duplicate: bool | None = False
    force_new_model: bool | None = False  # ล้าง embedding เก่าและใช้โมเดลปัจจุบัน (แก้กรณี dim ไม่ตรง)


class EnrollResponse(BaseModel):
    success: bool
    count: int
    message: str


class RecognizeRequest(BaseModel):
    user_id: str  # Supabase user UUID
    class_id: str  # Supabase classroom UUID
    image_base64: str


class RecognizeResponse(BaseModel):
    student_id: str | None
    student_name: str | None  # Frontend provides; we only return student_id
    similarity: float
    matched: bool


class CountResponse(BaseModel):
    count: int


class EnrolledStudentsResponse(BaseModel):
    student_ids: list[str]


class FaceCountsResponse(BaseModel):
    """Face enrollment counts for a classroom.

    Key = student_id (Supabase student UUID), value = number of enrolled face embeddings (0..5).
    """
    counts: dict[str, int]


class DebugImageRequest(BaseModel):
    image_base64: str
