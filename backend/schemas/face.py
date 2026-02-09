from pydantic import BaseModel


class EnrollRequest(BaseModel):
    class_id: str
    student_id: str
    image_base64: str
    allow_duplicate: bool | None = False
    force_new_model: bool | None = False  # ล้าง embedding เก่าและใช้โมเดลปัจจุบัน (แก้กรณี dim ไม่ตรง)


class EnrollResponse(BaseModel):
    success: bool
    count: int
    message: str


class RecognizeRequest(BaseModel):
    class_id: str
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


class DebugImageRequest(BaseModel):
    image_base64: str
