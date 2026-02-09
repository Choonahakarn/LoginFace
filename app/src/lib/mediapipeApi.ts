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
    minDetectionConfidence: isMobile ? 0.15 : 0.3, // Mobile: ลดลงเป็น 0.15 เพื่อให้ตรวจจับได้ง่ายขึ้น
  });
  console.log('[FaceDetector] Loaded with minDetectionConfidence:', isMobile ? 0.15 : 0.3, 'isMobile:', isMobile);
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
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  // บน mobile: ใช้ readyState >= 2 (HAVE_CURRENT_DATA) เพื่อให้เริ่ม scan ได้เร็วขึ้น
  const minReadyState = 2;
  
  if (!detector || video.readyState < minReadyState || video.videoWidth === 0) {
    if (isMobile && !detector) {
      console.warn('[detectFaceFromVideo] Mobile: Detector not loaded');
    }
    return null;
  }
  
  try {
    const result = detector.detectForVideo(video, timestamp);
    if (!result?.detections?.length) {
      // Debug logging บน mobile เมื่อไม่พบใบหน้า (ทุก 30 เฟรม)
      if (isMobile && Math.random() < 0.033) { // ~3% chance = ~ทุก 30 เฟรม
        console.log('[detectFaceFromVideo] Mobile: No face detected', {
          videoSize: `${video.videoWidth}x${video.videoHeight}`,
          readyState: video.readyState,
          hasResult: !!result,
          detectionsCount: result?.detections?.length || 0
        });
      }
      return null;
    }
    const d = result.detections[0];
    const b = d.boundingBox;
    if (!b) return null;
    
    // Debug logging บน mobile เมื่อพบใบหน้า
    if (isMobile && Math.random() < 0.1) { // ~10% chance
      console.log('[detectFaceFromVideo] Mobile: Face detected', {
        box: { x: b.originX ?? 0, y: b.originY ?? 0, width: b.width ?? 0, height: b.height ?? 0 },
        videoSize: `${video.videoWidth}x${video.videoHeight}`,
        readyState: video.readyState,
        confidence: d.categories?.[0]?.score
      });
    }
    
    return {
      box: {
        x: b.originX ?? 0,
        y: b.originY ?? 0,
        width: b.width ?? 0,
        height: b.height ?? 0,
      },
    };
  } catch (err) {
    if (isMobile) {
      console.warn('[detectFaceFromVideo] Mobile: Error:', err);
    }
    return null;
  }
}
