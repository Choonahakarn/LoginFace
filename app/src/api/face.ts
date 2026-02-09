/**
 * Face API Backend - Calls Python backend (RetinaFace + InsightFace)
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** ทดสอบการเชื่อมต่อ Frontend ↔ Backend แบบละเอียด */
export async function testConnection(imageBase64?: string): Promise<{
  ok: boolean;
  health: boolean;
  saveImage: boolean | null;
  error?: string;
}> {
  const result: { ok: boolean; health: boolean; saveImage: boolean | null; error?: string } = { ok: false, health: false, saveImage: null };
  try {
    const healthRes = await fetch(`${API_BASE}/api/health`);
    result.health = healthRes.ok;
    if (!result.health) {
      result.error = 'Backend ไม่ตอบ (health 404)';
      return result;
    }
    if (imageBase64) {
      try {
        const saveRes = await fetch(`${API_BASE}/api/face/debug-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: imageBase64 }),
        });
        const saveData = await saveRes.json().catch(() => ({}));
        result.saveImage = saveRes.ok && !saveData.error;
        if (!result.saveImage) result.error = (result.error || '') + ` | บันทึกรูป: ${saveData.error || 'ไม่สำเร็จ'}`;
      } catch {
        result.saveImage = false;
        result.error = (result.error || '') + ' | บันทึกรูป: network error';
      }
    }
    result.ok = result.health && (result.saveImage !== false);
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

export async function debugExtract(imageBase64: string): Promise<{ ok: boolean; errors?: string[]; image_size?: number; image_dims?: string }> {
  const res = await fetch(`${API_BASE}/api/face/debug-extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });
  return res.json();
}

export type EnrollResult =
  | { success: true; count: number }
  | { success: false; reason: 'duplicate'; duplicate: { student_id: string; similarity: number } };

export async function enrollFace(
  classId: string,
  studentId: string,
  imageBase64: string,
  options?: { allowDuplicate?: boolean; forceNewModel?: boolean }
): Promise<EnrollResult> {
  console.log('[enrollFace] ส่ง request ไป', `${API_BASE}/api/face/enroll`, 'image_len=', imageBase64?.length);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/face/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_id: classId,
        student_id: studentId,
        image_base64: imageBase64,
        allow_duplicate: options?.allowDuplicate ?? false,
        force_new_model: options?.forceNewModel ?? false,
      }),
    });
  } catch (err) {
    console.error('[enrollFace] Fetch failed (backend ไม่ตอบ?):', err);
    throw new Error('เชื่อมต่อ Backend ไม่ได้ — กรุณารัน Backend ก่อน');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 409 && data?.duplicate) {
    return { success: false, reason: 'duplicate', duplicate: data.duplicate };
  }
  if (!res.ok) {
    if (data.debug) {
      console.log('[enrollFace] Backend debug:', data.debug);
      const errors = data.debug.errors || [];
      if (errors.length > 0) {
        console.error('[enrollFace] Extraction errors:', errors);
      }
    }
    const msg = Array.isArray(data.detail) ? data.detail[0]?.msg ?? data.detail[0] : data.detail;
    const errorMsg = typeof msg === 'string' ? msg : 'ลงทะเบียนไม่สำเร็จ';
    const debugInfo = data.debug ? ` (image: ${data.debug.image_dims || 'unknown'}, errors: ${(data.debug.errors || []).join('; ')})` : '';
    throw new Error(errorMsg + debugInfo);
  }
  return { success: true, count: data.count };
}

export interface RecognizeResult {
  student_id: string | null;
  student_name: string | null;
  similarity: number;
  matched: boolean;
}

export async function recognizeFace(
  classId: string,
  imageBase64: string,
  signal?: AbortSignal
): Promise<RecognizeResult> {
  const res = await fetch(`${API_BASE}/api/face/recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: classId,
      image_base64: imageBase64,
    }),
    signal, // Support request cancellation
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.detail) ? data.detail[0]?.msg ?? data.detail[0] : data.detail;
    throw new Error(typeof msg === 'string' ? msg : 'การยืนยันตัวตนล้มเหลว');
  }
  return {
    student_id: data.student_id ?? null,
    student_name: data.student_name ?? null,
    similarity: data.similarity ?? 0,
    matched: data.matched ?? false,
  };
}

export async function getFaceCount(
  classId: string,
  studentId: string
): Promise<number> {
  try {
    const res = await fetch(
      `${API_BASE}/api/face/count?class_id=${encodeURIComponent(classId)}&student_id=${encodeURIComponent(studentId)}`
    );
    const data = await res.json().catch(() => ({}));
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getEnrolledStudentIds(classId: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/face/enrolled?class_id=${encodeURIComponent(classId)}`
    );
    const data = await res.json().catch(() => ({}));
    return data.student_ids ?? [];
  } catch {
    return [];
  }
}

export async function removeFaceEnrollment(
  classId: string,
  studentId: string,
  index?: number
): Promise<void> {
  let url = `${API_BASE}/api/face/enroll?class_id=${encodeURIComponent(classId)}&student_id=${encodeURIComponent(studentId)}`;
  if (index != null) url += `&index=${index}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    let msg = 'ลบไม่สำเร็จ';
    try {
      const data = JSON.parse(text);
      if (typeof data.detail === 'string') msg = data.detail;
    } catch {
      if (text) msg = `${msg} (${res.status})`;
    }
    throw new Error(msg);
  }
}

export async function getFaceEnrollmentRecords(
  classId: string,
  studentId: string
): Promise<{ enrolledAt: string; confidence: number }[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/face/list?class_id=${encodeURIComponent(classId)}&student_id=${encodeURIComponent(studentId)}`
    );
    const data = await res.json().catch(() => ({}));
    return data.records ?? [];
  } catch {
    return [];
  }
}
