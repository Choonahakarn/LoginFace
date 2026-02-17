"""Persistent storage for face embeddings using Supabase or JSON fallback."""
from __future__ import annotations
import json
import os
import time
import uuid
from pathlib import Path
import numpy as np
from typing import Optional, Any

try:
    from lib.supabase_client import supabase
except Exception as e:
    print(f"WARNING: Could not import Supabase client: {e}")
    supabase = None

# JSON fallback when Supabase not configured
from config import EMBEDDINGS_DB

def _json_key(user_id: str, classroom_id: str, student_id: str) -> str:
    return f"{user_id}:{classroom_id}:{student_id}"

def _json_load() -> dict:
    if not os.path.exists(EMBEDDINGS_DB):
        return {}
    try:
        with open(EMBEDDINGS_DB, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def _json_save(data: dict) -> None:
    Path(EMBEDDINGS_DB).parent.mkdir(parents=True, exist_ok=True)
    with open(EMBEDDINGS_DB, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=0)

if supabase is None:
    print("=" * 60)
    print("WARNING: Supabase client not initialized!")
    print("Using JSON file fallback (embeddings.json)")
    print("To enable Supabase:")
    print("1. Create backend/.env file")
    print("2. Add: SUPABASE_URL=https://your-project.supabase.co")
    print("3. Add: SUPABASE_SERVICE_ROLE_KEY=your-service-role-key")
    print("=" * 60)

# Pre-computed normalized embeddings cache: {user_id: {classroom_id: {dim: [(student_id, normalized_emb_matrix, student_indices), ...]}}}}
_normalized_cache: dict[str, dict[str, dict[int, list[tuple[str, Any, list[int]]]]]] = {}
_normalized_cache_timestamp: float = 0


def invalidate_cache() -> None:
    """Force cache invalidation - call after external modifications."""
    global _normalized_cache, _normalized_cache_timestamp
    _normalized_cache = {}
    _normalized_cache_timestamp = 0


def add_embedding(
    user_id: str,
    classroom_id: str,
    student_id: str,
    embedding: list[float],
    confidence: float,
) -> int:
    """Add embedding. Max 5 per (user, classroom, student). Returns new count."""
    if supabase is not None:
        try:
            existing = get_embeddings(user_id, classroom_id, student_id)
            if len(existing) >= 5:
                oldest = existing[0]
                supabase.table("face_embeddings").delete().eq("id", oldest["id"]).execute()

            supabase.table("face_embeddings").insert({
                "user_id": user_id,
                "classroom_id": classroom_id,
                "student_id": student_id,
                "embedding": embedding,
                "confidence": confidence,
            }).execute()
            invalidate_cache()
            return len(existing) + 1
        except Exception as e:
            print(f"Error adding embedding: {e}")
            raise

    # JSON fallback
    key = _json_key(user_id, classroom_id, student_id)
    data = _json_load()
    if key not in data:
        data[key] = []
    arr = data[key]
    if len(arr) >= 5:
        arr.pop(0)
    arr.append({
        "id": str(uuid.uuid4()),
        "embedding": embedding,
        "confidence": confidence,
        "enrolledAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    })
    _json_save(data)
    invalidate_cache()
    return len(arr)


def get_embeddings(
    user_id: str,
    classroom_id: str,
    student_id: str,
) -> list[dict]:
    """Get all embeddings for (user, classroom, student)."""
    if supabase is not None:
        try:
            response = (
                supabase.table("face_embeddings")
                .select("*")
                .eq("user_id", user_id)
                .eq("classroom_id", classroom_id)
                .eq("student_id", student_id)
                .order("enrolled_at", desc=False)
                .execute()
            )
            return [
                {"id": row["id"], "embedding": row["embedding"], "confidence": row["confidence"], "enrolledAt": row["enrolled_at"]}
                for row in response.data
            ]
        except Exception as e:
            print(f"Error getting embeddings: {e}")
            return []

    key = _json_key(user_id, classroom_id, student_id)
    data = _json_load()
    arr = data.get(key, [])
    return [{"id": r["id"], "embedding": r["embedding"], "confidence": r["confidence"], "enrolledAt": r["enrolledAt"]} for r in arr]


def get_count(
    user_id: str,
    classroom_id: str,
    student_id: str,
) -> int:
    """Get count of embeddings for (user, classroom, student)."""
    return len(get_embeddings(user_id, classroom_id, student_id))


def remove_all(
    user_id: str,
    classroom_id: str,
    student_id: str,
) -> None:
    """Remove all embeddings for (user, classroom, student)."""
    if supabase is not None:
        try:
            supabase.table("face_embeddings").delete().eq("user_id", user_id).eq("classroom_id", classroom_id).eq("student_id", student_id).execute()
            invalidate_cache()
            return
        except Exception as e:
            print(f"Error removing embeddings: {e}")
            raise

    key = _json_key(user_id, classroom_id, student_id)
    data = _json_load()
    if key in data:
        del data[key]
        _json_save(data)
    invalidate_cache()


def remove_by_index(
    user_id: str,
    classroom_id: str,
    student_id: str,
    index: int,
) -> int:
    """Remove embedding by index. Returns remaining count."""
    if supabase is not None:
        try:
            embeddings = get_embeddings(user_id, classroom_id, student_id)
            if 0 <= index < len(embeddings):
                supabase.table("face_embeddings").delete().eq("id", embeddings[index]["id"]).execute()
                invalidate_cache()
            return len(embeddings) - (1 if 0 <= index < len(embeddings) else 0)
        except Exception as e:
            print(f"Error removing embedding by index: {e}")
            return len(get_embeddings(user_id, classroom_id, student_id))

    key = _json_key(user_id, classroom_id, student_id)
    data = _json_load()
    arr = list(data.get(key, []))
    if 0 <= index < len(arr):
        arr.pop(index)
        if arr:
            data[key] = arr
        elif key in data:
            del data[key]
        _json_save(data)
        invalidate_cache()
    return len(arr)


def get_all_for_class(
    user_id: str,
    classroom_id: str,
) -> list[tuple[str, list[list[float]]]]:
    """Returns [(student_id, [emb1, emb2, ...]), ...] for classroom."""
    if supabase is not None:
        try:
            response = (
                supabase.table("face_embeddings")
                .select("*")
                .eq("user_id", user_id)
                .eq("classroom_id", classroom_id)
                .order("enrolled_at", desc=False)
                .execute()
            )
            by_student: dict[str, list[list[float]]] = {}
            for row in response.data:
                sid = row["student_id"]
                if sid not in by_student:
                    by_student[sid] = []
                by_student[sid].append(row["embedding"])
            return [(sid, embs) for sid, embs in by_student.items() if embs]
        except Exception as e:
            print(f"Error getting embeddings for class: {e}")
            return []

    prefix = f"{user_id}:{classroom_id}:"
    data = _json_load()
    by_student: dict[str, list[list[float]]] = {}
    for k, arr in data.items():
        if k.startswith(prefix):
            student_id = k[len(prefix):]
            embs = [r["embedding"] for r in arr]
            if embs:
                by_student[student_id] = embs
    return [(sid, embs) for sid, embs in by_student.items() if embs]


def get_counts_for_class(
    user_id: str,
    classroom_id: str,
) -> dict[str, int]:
    """Return {student_id: count} for a classroom, without loading embeddings.

    This is much faster and lighter than `get_all_for_class()` because it does not fetch embedding vectors.
    """
    if supabase is not None:
        try:
            # Only fetch student_id (embedding is large); count in Python.
            response = (
                supabase.table("face_embeddings")
                .select("student_id")
                .eq("user_id", user_id)
                .eq("classroom_id", classroom_id)
                .execute()
            )
            counts: dict[str, int] = {}
            for row in response.data:
                sid = row.get("student_id")
                if not sid:
                    continue
                counts[sid] = counts.get(sid, 0) + 1
            return counts
        except Exception as e:
            print(f"Error getting counts for class: {e}")
            return {}

    # JSON fallback
    prefix = f"{user_id}:{classroom_id}:"
    data = _json_load()
    counts: dict[str, int] = {}
    for k, arr in data.items():
        if k.startswith(prefix):
            student_id = k[len(prefix):]
            counts[student_id] = len(arr or [])
    return counts


def get_normalized_embeddings_for_class(
    user_id: str,
    classroom_id: str,
    min_embeddings: int | None = None,
) -> dict[int, list[tuple[str, Any, list[int]]]]:
    """Returns normalized embeddings grouped by dimension for fast vectorized similarity.
    Returns: {dim: [(student_id, normalized_emb_matrix, original_indices), ...]}
    where normalized_emb_matrix is (n_embeddings, dim) array, original_indices maps to original embedding list.
    When min_embeddings is set, only include students with at least that many embeddings (e.g. 5 for attendance).
    """
    global _normalized_cache, _normalized_cache_timestamp

    current_time = time.time()

    # Check cache
    cache_key = f"{user_id}:{classroom_id}"
    if cache_key not in _normalized_cache:
        _normalized_cache[cache_key] = {}

    class_cache = _normalized_cache[cache_key]
    candidates = get_all_for_class(user_id, classroom_id)
    if min_embeddings is not None:
        candidates = [(sid, embs) for sid, embs in candidates if len(embs) >= min_embeddings]

    # Group by dimension
    by_dim: dict[int, list[tuple[str, list[list[float]]]]] = {}
    for student_id, embs in candidates:
        if not embs:
            continue
        dim = len(embs[0])
        if dim not in by_dim:
            by_dim[dim] = []
        by_dim[dim].append((student_id, embs))

    # Pre-compute normalized matrices for each dimension
    result: dict[int, list[tuple[str, Any, list[int]]]] = {}
    for dim, students_embs in by_dim.items():
        if dim not in class_cache:
            normalized_list = []
            for student_id, embs in students_embs:
                # Convert to numpy and normalize
                emb_matrix = np.array(embs, dtype=np.float32)
                norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
                norms[norms == 0] = 1  # Avoid division by zero
                normalized = emb_matrix / norms
                # Store original indices (0, 1, 2, ...) for mapping back
                normalized_list.append((student_id, normalized, list(range(len(embs)))))
            class_cache[dim] = normalized_list
        result[dim] = class_cache[dim]

    _normalized_cache_timestamp = current_time
    return result
