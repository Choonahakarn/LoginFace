/**
 * MediaPipe Face Detection + Liveness (Client-side)
 * สำหรับ realtime ตรวจจับใบหน้า และ liveness check ก่อนส่งภาพไป Backend
 */
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let detector: FaceDetector | null = null;

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export async function loadMediaPipeFaceDetector(): Promise<FaceDetector> {
  if (detector) return detector;
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  detector = await FaceDetector.createFromModelPath(vision, MODEL_URL);
  // ตรวจสอบว่าเป็น mobile device หรือไม่
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  await detector.setOptions({
    runningMode: 'VIDEO',
    minDetectionConfidence: isMobile ? 0.25 : 0.3, // Mobile: ลดลงเพื่อให้ตรวจจับได้ง่ายขึ้น
  });
  return detector;
}

export function isMediaPipeLoaded(): boolean {
  return detector != null;
}

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function detectFaceFromVideo(
  video: HTMLVideoElement,
  timestamp: number
): Promise<{ box: FaceBox } | null> {
  if (!detector || video.readyState < 2 || video.videoWidth === 0) return null;
  try {
    const result = detector.detectForVideo(video, timestamp);
    if (!result?.detections?.length) return null;
    const d = result.detections[0];
    const b = d.boundingBox;
    if (!b) return null;
    return {
      box: {
        x: b.originX ?? 0,
        y: b.originY ?? 0,
        width: b.width ?? 0,
        height: b.height ?? 0,
      },
    };
  } catch {
    return null;
  }
}
