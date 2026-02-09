"""Persistent storage for face embeddings (class_id, student_id -> embeddings)."""
import json
import os
from pathlib import Path
import time
import numpy as np

from config import EMBEDDINGS_DB

# In-memory cache for embeddings to avoid loading from disk every time
_cache: dict | None = None
_cache_timestamp: float = 0
_cache_ttl: float = 1.0  # Cache TTL in seconds (1 second = refresh on file changes)

# Pre-computed normalized embeddings cache: {class_id: {dim: [(student_id, normalized_emb_matrix, student_indices), ...]}}
_normalized_cache: dict[str, dict[int, list[tuple[str, np.ndarray, list[int]]]]] = {}
_normalized_cache_timestamp: float = 0


def _load() -> dict:
    global _cache, _cache_timestamp
    current_time = time.time()
    
    # Check if cache is still valid
    if _cache is not None and (current_time - _cache_timestamp) < _cache_ttl:
        return _cache
    
    # Load from disk
    if not os.path.exists(EMBEDDINGS_DB):
        _cache = {}
        _cache_timestamp = current_time
        return _cache
    
    try:
        with open(EMBEDDINGS_DB, "r", encoding="utf-8") as f:
            _cache = json.load(f)
            _cache_timestamp = current_time
            return _cache
    except Exception:
        _cache = {}
        _cache_timestamp = current_time
        return _cache


def _save(data: dict) -> None:
    global _cache, _cache_timestamp, _normalized_cache
    Path(EMBEDDINGS_DB).parent.mkdir(parents=True, exist_ok=True)
    with open(EMBEDDINGS_DB, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=0)
    # Update cache immediately after save
    _cache = data
    _cache_timestamp = time.time()
    # Invalidate normalized cache so it gets recomputed
    _normalized_cache = {}


def invalidate_cache() -> None:
    """Force cache invalidation - call after external file modifications."""
    global _cache, _cache_timestamp
    _cache = None
    _cache_timestamp = 0


def _key(class_id: str, student_id: str) -> str:
    return f"{class_id}:{student_id}"


def add_embedding(class_id: str, student_id: str, embedding: list[float], confidence: float) -> int:
    """Add embedding. Max 5 per (class, student). Returns new count."""
    data = _load()
    k = _key(class_id, student_id)
    records = data.get(k, [])
    records.append({
        "embedding": embedding,
        "confidence": confidence,
        "enrolledAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    })
    records = records[-5:]  # Keep last 5
    data[k] = records
    _save(data)  # _save automatically updates cache
    return len(records)


def get_embeddings(class_id: str, student_id: str) -> list[dict]:
    """Get all embeddings for (class, student)."""
    data = _load()
    return data.get(_key(class_id, student_id), [])


def get_count(class_id: str, student_id: str) -> int:
    return len(get_embeddings(class_id, student_id))


def remove_all(class_id: str, student_id: str) -> None:
    data = _load()
    k = _key(class_id, student_id)
    if k in data:
        del data[k]
        _save(data)  # _save automatically updates cache


def remove_by_index(class_id: str, student_id: str, index: int) -> int:
    data = _load()
    k = _key(class_id, student_id)
    records = data.get(k, [])
    if 0 <= index < len(records):
        records.pop(index)
        if not records:
            del data[k]
        else:
            data[k] = records
        _save(data)  # _save automatically updates cache
    return len(data.get(k, []))


def get_all_for_class(class_id: str) -> list[tuple[str, list[list[float]]]]:
    """Returns [(student_id, [emb1, emb2, ...]), ...] for class."""
    data = _load()
    result = []
    prefix = f"{class_id}:"
    for k, records in data.items():
        if k.startswith(prefix):
            student_id = k[len(prefix):]
            embs = [r["embedding"] for r in records]
            if embs:
                result.append((student_id, embs))
    return result


def get_normalized_embeddings_for_class(class_id: str) -> dict[int, list[tuple[str, np.ndarray, list[int]]]]:
    """Returns normalized embeddings grouped by dimension for fast vectorized similarity.
    Returns: {dim: [(student_id, normalized_emb_matrix, original_indices), ...]}
    where normalized_emb_matrix is (n_embeddings, dim) array, original_indices maps to original embedding list.
    """
    global _normalized_cache, _normalized_cache_timestamp
    
    current_time = time.time()
    # Invalidate cache if data changed (check if cache timestamp is older than data cache)
    if _normalized_cache_timestamp < _cache_timestamp:
        _normalized_cache = {}
        _normalized_cache_timestamp = current_time
    
    if class_id not in _normalized_cache:
        _normalized_cache[class_id] = {}
    
    class_cache = _normalized_cache[class_id]
    candidates = get_all_for_class(class_id)
    
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
    result: dict[int, list[tuple[str, np.ndarray, list[int]]]] = {}
    for dim, students_embs in by_dim.items():
        if dim not in class_cache or _normalized_cache_timestamp < _cache_timestamp:
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
