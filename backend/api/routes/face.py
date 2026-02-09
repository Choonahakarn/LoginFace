"""Face enroll and recognize API."""
import base64
import logging
import os
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger("face")

from config import SIMILARITY_THRESHOLD, MIN_MARGIN, DATA_DIR
from services.face_service import (
    get_embedding_from_base64,
    get_embedding_from_base64_debug,
    embedding_similarity,
    embedding_to_similarity,
    model_order_for_dim,
)
from repositories.embedding_store import (
    add_embedding,
    get_embeddings,
    get_count,
    remove_all,
    remove_by_index,
    get_all_for_class,
)
from schemas.face import (
    EnrollRequest,
    EnrollResponse,
    RecognizeRequest,
    RecognizeResponse,
    CountResponse,
    EnrolledStudentsResponse,
    DebugImageRequest,
)

router = APIRouter()


def _check_duplicate(class_id: str, embedding: list[float], exclude_student_id: str) -> tuple[str, float] | None:
    """If embedding matches another student, return (student_id, similarity).
    ตรวจสอบที่ 95% (0.95) เพื่อแจ้งเตือนผู้ใช้"""
    dim = len(embedding)
    # ใช้ threshold 95% สำหรับการแจ้งเตือน (สูงกว่า threshold ปกติ)
    # เพื่อให้แจ้งเตือนเฉพาะกรณีที่คล้ายกันมากจริงๆ
    if dim == 128:
        threshold = 0.95  # สำหรับ 128-dim models
    elif dim == 4096:
        threshold = 0.95  # สำหรับ 4096-dim models
    else:
        threshold = 0.95  # สำหรับ Facenet512 (512-dim) และอื่นๆ
    candidates = get_all_for_class(class_id)
    for student_id, embs in candidates:
        if student_id == exclude_student_id:
            continue
        for emb in embs:
            sim = embedding_similarity(embedding, emb)
            # แปลง similarity เป็น percentage (0-1) แล้วเปรียบเทียบกับ 0.95
            similarity_score = embedding_to_similarity(sim, dim)
            if similarity_score >= threshold:
                return (student_id, similarity_score)
    return None


def _get_existing_dim_for_student(class_id: str, student_id: str) -> int | None:
    """Return embedding dimension already stored for a student (first found)."""
    records = get_embeddings(class_id, student_id)
    for r in records:
        emb = r.get("embedding")
        if emb:
            return len(emb)
    return None


def _get_dims_for_class(class_id: str) -> set[int]:
    """Return all embedding dimensions stored for a class."""
    dims: set[int] = set()
    candidates = get_all_for_class(class_id)
    for _, embs in candidates:
        for emb in embs:
            if emb:
                dims.add(len(emb))
    return dims


@router.get("/ping")
def ping():
    """ทดสอบว่า Backend เชื่อมต่อได้"""
    return {"ok": True, "message": "Backend เชื่อมต่อได้", "endpoint": "face-api"}


@router.post("/debug-image")
def debug_image(req: DebugImageRequest):
    """บันทึกรูปที่ได้รับไว้ที่ backend/data/debug.jpg เพื่อตรวจสอบ"""
    try:
        s = req.image_base64.strip()
        if "," in s and s.startswith("data:"):
            s = s.split(",", 1)[1]
        raw = base64.b64decode(s, validate=False)
        path = os.path.join(DATA_DIR, "debug_last.jpg")
        with open(path, "wb") as f:
            f.write(raw)
        return {"saved": path, "size_bytes": len(raw)}
    except Exception as e:
        return {"error": str(e)}


@router.post("/debug-extract")
def debug_extract(req: DebugImageRequest):
    """ทดสอบ extract embedding และ return error details เพื่อ debug"""
    return get_embedding_from_base64_debug(req.image_base64 or "")


@router.post("/enroll", response_model=EnrollResponse)
def enroll(req: EnrollRequest):
    try:
        print(
            f"\n>>> [ENROLL] request received - class={req.class_id} "
            f"student={req.student_id} image_len={len(req.image_base64 or '')}"
        )
        logger.info("POST /enroll received — class=%s student=%s image_len=%d", req.class_id, req.student_id, len(req.image_base64 or ""))
        existing_dim = _get_existing_dim_for_student(req.class_id, req.student_id)
        preferred_models = model_order_for_dim(existing_dim) if existing_dim else None
        result = get_embedding_from_base64(req.image_base64, preferred_models=preferred_models)
        if not result:
            debug = get_embedding_from_base64_debug(req.image_base64)
            try:
                s = req.image_base64.strip()
                if "," in s and s.startswith("data:"):
                    s = s.split(",", 1)[1]
                raw = base64.b64decode(s, validate=False)
                path = os.path.join(DATA_DIR, "debug_fail.jpg")
                with open(path, "wb") as f:
                    f.write(raw)
                debug["debug_fail_saved"] = path
            except Exception:
                pass
            return JSONResponse(status_code=400, content={"detail": "ไม่พบใบหน้าในภาพ", "debug": debug})
        emb, conf = result
        if existing_dim and len(emb) != existing_dim:
            remove_all(req.class_id, req.student_id)
            logger.info("dim ไม่ตรง (expected=%s got=%s): ล้าง embedding เก่าอัตโนมัติ class=%s student=%s", existing_dim, len(emb), req.class_id, req.student_id)
            print(f">>> [ENROLL] โมเดลไม่ตรง (expected dim={existing_dim}, got dim={len(emb)}) — ล้างข้อมูลเก่าอัตโนมัติแล้ว class={req.class_id} student={req.student_id}")
        dup = _check_duplicate(req.class_id, emb, req.student_id)
        if dup and not req.allow_duplicate:
            other_id, sim = dup
            return JSONResponse(
                status_code=409,
                content={
                    "detail": "ใบหน้านี้ใกล้เคียงกับนักเรียนคนอื่น ต้องการยืนยันการลงทะเบียนหรือไม่",
                    "duplicate": {"student_id": other_id, "similarity": sim},
                },
            )
        count = get_count(req.class_id, req.student_id)
        if count >= 5:
            raise HTTPException(status_code=400, detail="มีข้อมูลใบหน้าครบ 5 รายการแล้ว")
        add_embedding(req.class_id, req.student_id, emb, conf)
        return EnrollResponse(success=True, count=count + 1, message="ลงทะเบียนสำเร็จ")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("ENROLL failed: %s", e)
        print(f">>> [ENROLL] ERROR: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"ลงทะเบียนล้มเหลว: {type(e).__name__}: {str(e)}")


@router.post("/recognize", response_model=RecognizeResponse)
def recognize(req: RecognizeRequest):
    from repositories.embedding_store import get_normalized_embeddings_for_class
    
    # ดึง embedding จากรูปสแกนแบบเดียวกับตอนลงทะเบียน (ไม่บังคับโมเดล = ใช้ mediapipe + Facenet512)
    # เพื่อให้จับคู่ได้กับข้อมูลที่ลงทะเบียนใหม่ (512)
    result = get_embedding_from_base64(req.image_base64, preferred_models=None)
    if not result:
        return RecognizeResponse(student_id=None, student_name=None, similarity=0, matched=False)
    query_emb, _ = result
    query_dim = len(query_emb)
    threshold = 0.4 if query_dim == 128 else SIMILARITY_THRESHOLD

    # Get pre-normalized embeddings cache (much faster!)
    normalized_by_dim = get_normalized_embeddings_for_class(req.class_id)
    if query_dim not in normalized_by_dim or not normalized_by_dim[query_dim]:
        return RecognizeResponse(student_id=None, student_name=None, similarity=0, matched=False)

    # Convert query to numpy array and normalize once
    query_arr = np.array(query_emb, dtype=np.float32)
    query_norm = np.linalg.norm(query_arr)
    if query_norm == 0:
        return RecognizeResponse(student_id=None, student_name=None, similarity=0, matched=False)
    query_normalized = query_arr / query_norm

    best_student_id = None
    best_similarity = 0.0
    second_best_similarity = 0.0

    # Ultra-fast vectorized computation using pre-normalized embeddings
    for student_id, normalized_matrix, _ in normalized_by_dim[query_dim]:
        # normalized_matrix is already (n_embeddings, dim) and normalized
        # Compute all similarities at once (vectorized)
        similarities = np.dot(normalized_matrix, query_normalized)
        
        # Find best match for this student
        max_sim = float(np.max(similarities))
        
        if max_sim > best_similarity:
            second_best_similarity = best_similarity
            best_similarity = max_sim
            best_student_id = student_id
        elif max_sim > second_best_similarity:
            second_best_similarity = max_sim
        
        # Early exit if we found a very good match (ultra-fast path)
        # เพิ่ม threshold สำหรับ early exit เพื่อความแม่นยำสูงขึ้น
        from config import HIGH_CONFIDENCE_THRESHOLD
        if best_similarity > HIGH_CONFIDENCE_THRESHOLD:  # Very high confidence (0.75)
            break

    if best_student_id is None:
        return RecognizeResponse(student_id=None, student_name=None, similarity=0, matched=False)

    display_sim = embedding_to_similarity(best_similarity, query_dim)
    
    # เพิ่มความแม่นยำ: ตรวจสอบ threshold ที่เข้มงวดขึ้น
    if best_similarity < threshold:
        return RecognizeResponse(
            student_id=None, student_name=None, similarity=display_sim, matched=False
        )
    
    # เพิ่มความแม่นยำ: ตรวจสอบ margin ที่เข้มงวดขึ้นเพื่อแยกบุคคลได้ชัดเจน
    if second_best_similarity > 0 and (best_similarity - second_best_similarity) < MIN_MARGIN:
        return RecognizeResponse(
            student_id=None, student_name=None, similarity=display_sim, matched=False
        )
    
    # เพิ่มการตรวจสอบ: ถ้ามี similarity ใกล้เคียงกันมากเกินไป (อาจเป็นคนเดียวกันหรือคล้ายกันมาก)
    # ให้ตรวจสอบเพิ่มเติมด้วยการเปรียบเทียบกับ embeddings ทั้งหมดของนักเรียนคนนั้น
    # เข้มงวดขึ้น: ป้องกันการจดจำผิดคนเมื่อใบหน้าคล้ายกัน
    if second_best_similarity > 0:
        margin = best_similarity - second_best_similarity
        # ถ้า margin น้อยกว่า 0.20 แสดงว่าอาจมีความคล้ายคลึงกันสูง ต้องแน่ใจว่าเป็นคนเดียวกัน
        if margin < 0.20:
            # ตรวจสอบว่า best_similarity สูงพอหรือไม่
            # ถ้า margin น้อย ต้องมีความมั่นใจสูงมาก
            required_confidence = 0.75 if margin < 0.15 else 0.72
            if best_similarity < required_confidence:
                return RecognizeResponse(
                    student_id=None, student_name=None, similarity=display_sim, matched=False
                )
    
    return RecognizeResponse(
        student_id=best_student_id,
        student_name=None,
        similarity=display_sim,
        matched=True,
    )


@router.get("/count", response_model=CountResponse)
def get_face_count(class_id: str, student_id: str):
    return CountResponse(count=get_count(class_id, student_id))


@router.get("/enrolled", response_model=EnrolledStudentsResponse)
def get_enrolled_students(class_id: str):
    candidates = get_all_for_class(class_id)
    ids = [s[0] for s in candidates]
    return EnrolledStudentsResponse(student_ids=ids)


@router.delete("/enroll")
def delete_enrollment(class_id: str, student_id: str, index: int | None = None):
    if index is not None:
        remove_by_index(class_id, student_id, index)
    else:
        remove_all(class_id, student_id)
    return {"success": True}


@router.get("/list")
def list_enrollments(class_id: str, student_id: str):
    records = get_embeddings(class_id, student_id)
    return {
        "count": len(records),
        "records": [{"enrolledAt": r.get("enrolledAt", ""), "confidence": r.get("confidence", 0)} for r in records],
    }
