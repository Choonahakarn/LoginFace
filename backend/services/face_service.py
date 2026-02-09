"""
Face detection + embedding: Haar, center crop, full-image fallback. รองรับกรอบ oval กลางจอ
"""
import logging
import numpy as np
import cv2
import base64

logger = logging.getLogger("face_service")

# Facenet512 ต้องการรูปอย่างน้อยประมาณ 160x160
MIN_FACE_SIZE = 160
_embedding_model_loaded = False


def model_order_for_dim(dim: int) -> tuple[str, ...]:
    """Return model order that matches a target embedding dimension."""
    if dim == 4096:
        return ("VGG-Face",)
    if dim == 512:
        return ("Facenet512",)
    if dim == 128:
        return ("Facenet", "OpenFace")
    return ("Facenet512", "Facenet", "OpenFace", "VGG-Face")


def _ensure_embedding_model():
    global _embedding_model_loaded
    if not _embedding_model_loaded:
        from deepface import DeepFace
        import os
        try:
            # ตั้งค่า model path เพื่อหลีกเลี่ยงปัญหา permissions
            cache_dir = os.getenv("DEEPFACE_HOME", os.path.expanduser("~/.deepface"))
            os.makedirs(cache_dir, exist_ok=True)
            
            # Pre-load model ด้วย enforce_detection=False เพื่อหลีกเลี่ยง detector issues
            DeepFace.represent(
                np.zeros((MIN_FACE_SIZE, MIN_FACE_SIZE, 3), dtype=np.uint8),
                model_name="Facenet512",
                enforce_detection=False,
                align=False,
                prog_bar=False,
            )
            _embedding_model_loaded = True
        except Exception as e:
            logger.warning(f"Failed to pre-load embedding model: {e}")
            # ยังคงตั้งค่าเป็น loaded เพื่อไม่ให้ retry ซ้ำๆ
            _embedding_model_loaded = True


def _prepare_for_embedding(img: np.ndarray) -> np.ndarray:
    """Resize to 160x160 (Facenet512 standard) — ให้แน่ใจว่าเป็น uint8, 3 channels"""
    h, w = img.shape[:2]
    if h < 10 or w < 10:
        return img
    out = cv2.resize(img, (160, 160), interpolation=cv2.INTER_LINEAR)
    if len(out.shape) == 2:
        out = cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)
    if out.dtype != np.uint8:
        out = np.clip(out, 0, 255).astype(np.uint8)
    return out


def _extract_embedding_with_model(
    face_img: np.ndarray,
    model_name: str,
    *,
    use_detector: bool = False,
    detector_backend: str = "opencv",
) -> tuple[list[float], float] | None:
    from deepface import DeepFace
    if face_img.size == 0:
        return None
    if not use_detector:
        face_img = _prepare_for_embedding(face_img)
    img_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
    try:
        kwargs = {"model_name": model_name, "enforce_detection": use_detector, "align": use_detector}
        if use_detector:
            kwargs["detector_backend"] = detector_backend
        print(
            f"    [DEBUG] Calling DeepFace.represent(model={model_name}, "
            f"enforce={use_detector}, det={detector_backend if use_detector else 'none'}, "
            f"img_shape={img_rgb.shape})"
        )
        objs = DeepFace.represent(img_rgb, **kwargs)
        print(
            f"    [DEBUG] DeepFace.represent returned: type={type(objs)}, "
            f"len={len(objs) if objs else 0}"
        )
        if objs and len(objs) > 0:
            obj = objs[0]
            emb = obj.get("embedding")
            print(
                f"    [DEBUG] embedding: type={type(emb)}, len={len(emb) if emb else 0}"
            )
            if emb and len(emb) > 0:
                conf = float(obj.get("face_confidence", 1.0))
                return (list(emb), conf)
        else:
            print("    [DEBUG] DeepFace.represent returned empty or None")
    except Exception as e:
        err_msg = f"DeepFace.represent({model_name}, det={detector_backend if use_detector else 'no'}): {e}"
        logger.warning(err_msg)
        print(f"    [DEBUG] Exception: {type(e).__name__}: {e}")
        import traceback
        print(f"    [DEBUG] Traceback: {traceback.format_exc()}")
    return None


def _extract_via_opencv_haar(img_bgr: np.ndarray) -> tuple[list[float], float] | None:
    """ใช้ OpenCV Haar Cascade ตรวจจับใบหน้าโดยตรง (ไม่ต้องพึ่ง DeepFace detector)"""
    from deepface import DeepFace
    try:
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(20, 20))
        if len(faces) == 0:
            return None
        x, y, w, h = faces[0]
        pad = int(min(w, h) * 0.2)
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(img_bgr.shape[1], x + w + pad)
        y2 = min(img_bgr.shape[0], y + h + pad)
        face_crop = img_bgr[y1:y2, x1:x2]
        if face_crop.size == 0:
            return None
        face_crop = _prepare_for_embedding(face_crop)
        img_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
        objs = DeepFace.represent(img_rgb, model_name="Facenet512", enforce_detection=False, align=False)
        if objs and len(objs) > 0:
            emb = objs[0].get("embedding")
            if emb and len(emb) > 0:
                return (list(emb), 1.0)
    except Exception as e:
        logger.warning("_extract_via_opencv_haar failed: %s", str(e))
    return None


def _extract_via_extract_faces(img_bgr: np.ndarray, detector: str) -> tuple[list[float], float] | None:
    """ใช้ extract_faces ตรวจจับ → ได้ face crop → represent"""
    from deepface import DeepFace
    try:
        faces = DeepFace.extract_faces(img_bgr, detector_backend=detector, align=True, enforce_detection=True)
        if not faces or len(faces) == 0:
            return None
        face_img = faces[0].get("face")
        if face_img is None or face_img.size == 0:
            return None
        if np.issubdtype(face_img.dtype, np.floating):
            face_img = (np.clip(face_img, 0, 1) * 255).astype(np.uint8)
        if len(face_img.shape) == 2:
            face_img = cv2.cvtColor(face_img, cv2.COLOR_GRAY2BGR)
        else:
            face_img = cv2.cvtColor(face_img, cv2.COLOR_RGB2BGR)
        face_img = _prepare_for_embedding(face_img)
        img_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        objs = DeepFace.represent(img_rgb, model_name="Facenet512", enforce_detection=False, align=False)
        if objs and len(objs) > 0:
            emb = objs[0].get("embedding")
            if emb and len(emb) > 0:
                return (list(emb), float(objs[0].get("face_confidence", 1.0)))
    except Exception as e:
        logger.warning("_extract_via_extract_faces failed: %s | det=%s", str(e), detector)
    return None


def _extract_embedding(face_img: np.ndarray) -> tuple[list[float], float] | None:
    return _extract_embedding_with_model(face_img, "Facenet512")


def _extract_via_mediapipe_py(img_bgr: np.ndarray) -> tuple[list[float], float] | None:
    """ใช้ MediaPipe Python ตรวจจับใบหน้า → crop → DeepFace embedding (รองรับแว่น/มุมต่างๆ)"""
    from deepface import DeepFace
    try:
        import mediapipe as mp
        mp_face = mp.solutions.face_detection
        with mp_face.FaceDetection(model_selection=1, min_detection_confidence=0.5) as detector:
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            results = detector.process(img_rgb)
            if not results.detections:
                return None
            h, w = img_bgr.shape[:2]
            d = results.detections[0]
            b = d.location_data.relative_bounding_box
            x = int(b.xmin * w)
            y = int(b.ymin * h)
            bw = int(b.width * w)
            bh = int(b.height * h)
            pad = int(min(bw, bh) * 0.3)
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(w, x + bw + pad)
            y2 = min(h, y + bh + pad)
            face_crop = img_bgr[y1:y2, x1:x2]
            if face_crop.size < 100:
                return None
            face_crop = _prepare_for_embedding(face_crop)
            img_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
            objs = DeepFace.represent(img_rgb, model_name="Facenet512", enforce_detection=False, align=False)
            if objs and len(objs) > 0:
                emb = objs[0].get("embedding")
                if emb and len(emb) > 0:
                    return (list(emb), 1.0)
    except ImportError:
        return None
    except Exception as e:
        logger.warning("_extract_via_mediapipe_py failed: %s", str(e))
    return None


def _extract_via_face_recognition(img_bgr: np.ndarray) -> tuple[list[float], float] | None:
    """ใช้ face_recognition (dlib) — ใช้ก่อน DeepFace เพราะมักทำงานได้เสถียรกว่า"""
    try:
        import face_recognition
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        encodings = face_recognition.face_encodings(img_rgb)
        if not encodings:
            return None
        return (list(encodings[0]), 1.0)
    except ImportError:
        return None
    except Exception as e:
        logger.warning("face_recognition failed: %s", str(e))
        return None


def _extract_center_then_represent(img_bgr: np.ndarray) -> tuple[list[float], float] | None:
    """ทางเลือกสุดท้าย: crop ตรงกลาง 70% แล้ว represent (กรณีรูปเป็น face crop)"""
    from deepface import DeepFace
    try:
        h, w = img_bgr.shape[:2]
        if h < 50 or w < 50:
            return None
        margin_h, margin_w = int(h * 0.15), int(w * 0.15)
        y1, y2 = margin_h, h - margin_h
        x1, x2 = margin_w, w - margin_w
        if y2 <= y1 or x2 <= x1:
            center = img_bgr
        else:
            center = img_bgr[y1:y2, x1:x2]
        center = _prepare_for_embedding(center)
        img_rgb = cv2.cvtColor(center, cv2.COLOR_BGR2RGB)
        objs = DeepFace.represent(img_rgb, model_name="Facenet512", enforce_detection=False, align=False)
        if objs and len(objs) > 0:
            emb = objs[0].get("embedding")
            if emb and len(emb) > 0:
                return (list(emb), 0.9)
    except Exception as e:
        logger.warning("_extract_center_then_represent failed: %s", str(e))
    return None


def get_embedding_from_image(
    image_bgr: np.ndarray,
    preferred_models: tuple[str, ...] | None = None,
) -> tuple[list[float], float] | None:
    # เมื่อต้องใช้ dimension เฉพาะ (เช่น 4096 จากข้อมูลเก่า) อย่าใช้ mediapipe/face_recognition ก่อน
    # เพราะจะได้ 512/128 เสมอ → ต้องลอง preferred_models ก่อน
    if not preferred_models:
        r = _extract_via_mediapipe_py(image_bgr)
        if r:
            return r
        r = _extract_via_face_recognition(image_bgr)
        if r:
            return r
    _ensure_embedding_model()
    h, w = image_bgr.shape[:2]
    if h < 10 or w < 10:
        return None
    if max(h, w) > 960:
        scale = 960 / max(h, w)
        img = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)
    else:
        img = image_bgr.copy()

    iw, ih = img.shape[1], img.shape[0]
    max_dim = max(iw, ih)
    is_likely_face_crop = max_dim <= 600 and 0.35 <= (min(iw, ih) / max_dim) <= 1.0
    # Reduced logging for performance - only log if debug needed
    # logger.info("get_embedding_from_image: %dx%d max_dim=%d is_face_crop=%s",
    #             iw, ih, max_dim, is_likely_face_crop)

    def _try_extract(img_region: np.ndarray, use_det: bool = False, det_backend: str = "opencv"):
        # Fast-first model order to improve responsiveness
        model_order = preferred_models or ("Facenet512", "Facenet", "OpenFace", "VGG-Face")
        for model_name in model_order:
            r = _extract_embedding_with_model(
                img_region, model_name, use_detector=use_det, detector_backend=det_backend
            )
            if r:
                return r
        return None

    # ถ้ารูปเล็ก/กลาง (มักเป็น face crop จาก frontend MediaPipe) → ใช้ทั้งรูปเลย ไม่ center crop
    if is_likely_face_crop:
        # Fast path: Try direct embedding first (fastest - no detection needed)
        result = _try_extract(img)
        if result:
            return result
        
        # Fast detector fallback: Use OpenCV Haar (fastest detector) first
        result = _extract_via_opencv_haar(img)
        if result:
            return result
        
        # Try center crop as fallback (very fast)
        result = _extract_center_then_represent(img)
        if result:
            return result
        
        # Only try DeepFace detectors if above methods failed (slower)
        # Prioritize faster detectors: opencv > mediapipe > ssd > yunet
        for det in ("opencv", "mediapipe"):
            try:
                result = _try_extract(img, use_det=True, det_backend=det)
                if result:
                    return result
            except Exception:
                continue
        
        # Final fallback: Simple resize and represent (fastest fallback)
        try:
            from deepface import DeepFace
            simple_resized = cv2.resize(img, (160, 160), interpolation=cv2.INTER_LINEAR)
            img_rgb = cv2.cvtColor(simple_resized, cv2.COLOR_BGR2RGB)
            objs = DeepFace.represent(img_rgb, model_name="Facenet512", enforce_detection=False, align=False)
            if objs and len(objs) > 0:
                emb = objs[0].get("embedding")
                if emb and len(emb) > 0:
                    return (list(emb), 0.8)
        except Exception as e:
            logger.warning("Final fallback (simple resize) failed: %s", str(e))
        return None

    # รูปใหญ่ = เฟรมกล้องเต็ม → ใช้ center crop (ใบหน้าในกรอบ oval กลางจอ)
    margin_x = int(iw * 0.05)
    margin_y = int(ih * 0.08)
    x1, y1 = margin_x, margin_y
    x2, y2 = iw - margin_x, ih - margin_y
    if x2 <= x1 or y2 <= y1:
        face_region = img
    else:
        face_region = img[y1:y2, x1:x2]

    # Fast path: Try center crop region first (most likely to contain face)
    result = _try_extract(face_region)
    if result:
        return result
    
    # Try full image
    result = _try_extract(img)
    if result:
        return result
    
    # Fast detector: OpenCV Haar (fastest)
    result = _extract_via_opencv_haar(img)
    if result:
        return result
    
    # Try center crop fallback
    result = _extract_center_then_represent(img)
    if result:
        return result
    
    # Only try DeepFace detectors if above methods failed (prioritize faster ones)
    for det in ("opencv", "mediapipe"):
        try:
            result = _try_extract(img, use_det=True, det_backend=det)
            if result:
                return result
        except Exception:
            continue
    
    # Final fallback: Simple resize and represent
    try:
        from deepface import DeepFace
        simple_resized = cv2.resize(img, (160, 160), interpolation=cv2.INTER_LINEAR)
        img_rgb = cv2.cvtColor(simple_resized, cv2.COLOR_BGR2RGB)
        objs = DeepFace.represent(img_rgb, model_name="Facenet512", enforce_detection=False, align=False)
        if objs and len(objs) > 0:
            emb = objs[0].get("embedding")
            if emb and len(emb) > 0:
                return (list(emb), 0.8)
    except Exception as e:
        logger.warning("Final fallback (simple resize) failed: %s", str(e))
    return None


def get_embedding_from_base64_debug(
    image_base64: str,
    preferred_models: tuple[str, ...] | None = None,
) -> dict:
    """เหมือน get_embedding_from_base64 แต่ return dict พร้อม error details สำหรับ debug"""
    errors: list[str] = []
    raw_len = 0
    dims = None
    if not image_base64 or not isinstance(image_base64, str):
        return {"ok": False, "errors": ["empty or invalid input"], "image_size": 0, "image_dims": None}
    try:
        s = image_base64.strip()
        if "," in s and s.startswith("data:"):
            s = s.split(",", 1)[1]
        raw = base64.b64decode(s, validate=False)
        raw_len = len(raw)
        if raw_len < 100:
            return {"ok": False, "errors": [f"base64 too small ({raw_len} bytes)"], "image_size": raw_len, "image_dims": None}
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return {"ok": False, "errors": ["cv2.imdecode failed"], "image_size": raw_len, "image_dims": None}
        h, w = img.shape[:2]
        dims = f"{w}x{h}"
        result = get_embedding_from_image(img, preferred_models=preferred_models)
        if result:
            return {"ok": True, "embedding_len": len(result[0]), "image_dims": dims, "image_size": raw_len}
        errors.append(f"All extraction failed for {w}x{h}")
        try:
            from deepface import DeepFace
            test_img = _prepare_for_embedding(img)
            DeepFace.represent(cv2.cvtColor(test_img, cv2.COLOR_BGR2RGB), model_name="Facenet512", enforce_detection=False, align=False)
        except Exception as ex:
            errors.append(f"DeepFace.represent(enforce=False) raised: {type(ex).__name__}: {ex}")
    except Exception as e:
        errors.append(f"Exception: {type(e).__name__}: {e}")
    return {"ok": False, "errors": errors, "image_size": raw_len, "image_dims": dims}


def get_embedding_from_base64(
    image_base64: str,
    preferred_models: tuple[str, ...] | None = None,
) -> tuple[list[float], float] | None:
    """Decode base64 image and extract embedding."""
    if not image_base64 or not isinstance(image_base64, str):
        logger.warning("get_embedding: empty or invalid input")
        return None
    try:
        s = image_base64.strip()
        if "," in s and s.startswith("data:"):
            s = s.split(",", 1)[1]
        raw = base64.b64decode(s, validate=False)
        if len(raw) < 100:
            logger.warning("get_embedding: base64 too small (%d bytes)", len(raw))
            return None
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            logger.warning("get_embedding: cv2.imdecode failed")
            return None
        h, w = img.shape[:2]
        # Reduced logging for performance - only log failures
        result = get_embedding_from_image(img, preferred_models=preferred_models)
        if not result:
            logger.warning("get_embedding: all extraction attempts failed for %dx%d", w, h)
        return result
    except Exception as e:
        logger.exception("get_embedding: %s", str(e))
        return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors (higher=more similar)."""
    a_arr = np.array(a, dtype=np.float32)
    b_arr = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))


def embedding_similarity(a: list[float], b: list[float]) -> float:
    """Return similarity score (higher=more similar). 128-d = face_recognition (Euclidean), 512-d = Facenet (cosine)."""
    if len(a) != len(b):
        return 0.0
    if len(a) == 128:
        dist = float(np.linalg.norm(np.array(a) - np.array(b)))
        return max(0, 1 - dist)
    return cosine_similarity(a, b)


def embedding_to_similarity(raw_sim: float, dim: int = 512) -> float:
    """Map to [0,1] for display."""
    if dim == 128:
        return max(0, min(1, raw_sim))
    return max(0, min(1, (raw_sim + 1) / 2))
