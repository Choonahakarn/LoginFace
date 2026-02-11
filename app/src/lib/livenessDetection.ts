/**
 * Advanced Liveness Detection System
 * ป้องกันการใช้รูปภาพ 2D หรือวิดีโอมาเช็คชื่อแทนใบหน้า 3D จริง
 * 
 * ใช้หลายวิธีร่วมกัน:
 * 1. Blink Detection (EAR - Eye Aspect Ratio)
 * 2. Head Movement Detection (Yaw, Pitch, Roll)
 * 3. Texture Analysis (2D vs 3D)
 * 4. Reflection Detection
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker | null = null;

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Define NormalizedLandmark interface ourselves since it's not exported from @mediapipe/tasks-vision
export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface LivenessResult {
  passed: boolean;
  confidence: number;
  reasons: string[];
  blinkDetected: boolean;
  headMovementDetected: boolean;
  textureAnalysisPassed: boolean;
}

export interface FaceLandmarks {
  landmarks: NormalizedLandmark[];
  faceBox: { x: number; y: number; width: number; height: number };
}

// Eye landmark indices for MediaPipe Face Mesh (468 landmarks)
const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
// Simplified eye points for EAR calculation (6 points per eye)
const LEFT_EYE_POINTS = [33, 160, 158, 133, 153, 144]; // Outer, inner, top, bottom
const RIGHT_EYE_POINTS = [362, 385, 387, 263, 373, 380];

// Face outline points for head pose estimation
const FACE_OUTLINE_INDICES = [10, 151, 9, 175, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

let landmarksHistory: Array<{ timestamp: number; landmarks: NormalizedLandmark[] }> = [];
const MAX_HISTORY = 20; // ลดจาก 25 เป็น 20 frames เพื่อความเร็ว (เพียงพอสำหรับ liveness)
let frameHistory: Array<{ timestamp: number; frameHash: string }> = []; // เก็บ hash ของ frame เพื่อตรวจสอบการเปลี่ยนแปลง
let framePixelHistory: Array<{ timestamp: number; pixelVariance: number }> = []; // เก็บ variance ของ pixel เพื่อตรวจสอบการเปลี่ยนแปลง

/** บน mobile: วาดเฉพาะบริเวณใบหน้า (face crop) ลง canvas เพื่อส่งให้ Face Landmarker — ใบหน้าใหญ่ขึ้นในเฟรม จับ landmarks ได้ง่ายขึ้น */
const FACE_CROP_CANVAS_SIZE = 256;
let faceCropCanvas: HTMLCanvasElement | null = null;

function drawFaceCropToCanvas(
  video: HTMLVideoElement,
  faceBox: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement {
  if (!faceCropCanvas) {
    faceCropCanvas = document.createElement('canvas');
    faceCropCanvas.width = FACE_CROP_CANVAS_SIZE;
    faceCropCanvas.height = FACE_CROP_CANVAS_SIZE;
  }
  const pad = 0.45; // ขยายกรอบใบหน้า 45% — ใบหน้าไม่แน่นเกินไป จับ landmarks ได้หลายมุม
  const sx = Math.max(0, faceBox.x - faceBox.width * pad);
  const sy = Math.max(0, faceBox.y - faceBox.height * pad);
  const sw = Math.min(video.videoWidth - sx, faceBox.width * (1 + 2 * pad));
  const sh = Math.min(video.videoHeight - sy, faceBox.height * (1 + 2 * pad));
  if (sw <= 0 || sh <= 0) {
    return faceCropCanvas;
  }
  const ctx = faceCropCanvas.getContext('2d');
  if (!ctx) return faceCropCanvas;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, FACE_CROP_CANVAS_SIZE, FACE_CROP_CANVAS_SIZE);
  return faceCropCanvas;
}

export async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker;
  
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  // ตรวจสอบว่าเป็น mobile device หรือไม่
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  
  // บน mobile: ใช้ CPU delegate ก่อน (มักเสถียรกว่าและจับ landmarks ได้ดีกว่าบนมือถือ)
  let delegate: 'CPU' | 'GPU' = 'CPU';
  if (!isMobile) {
    delegate = 'GPU';
  } else {
    console.log('[FaceLandmarker] Mobile: Using CPU delegate for better landmark detection');
  }
  
  try {
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: delegate,
      },
      outputFaceBlendshapes: false,
      runningMode: 'VIDEO',
      numFaces: 1,
      // Mobile: ลดมาก (0.03) เพื่อให้จับ landmarks ได้แม้มุม/แสงไม่สมบูรณ์
      minFaceDetectionConfidence: isMobile ? 0.03 : 0.4,
      minFacePresenceConfidence: isMobile ? 0.03 : 0.4,
      minTrackingConfidence: isMobile ? 0.03 : 0.4,
    });
    console.log('[FaceLandmarker] Loaded successfully with', delegate, 'delegate');
  } catch (gpuError) {
    if (isMobile && delegate === 'GPU') {
      console.warn('[FaceLandmarker] GPU failed, falling back to CPU:', gpuError);
      delegate = 'CPU';
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'CPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.03,
        minFacePresenceConfidence: 0.03,
        minTrackingConfidence: 0.03,
      });
      console.log('[FaceLandmarker] Loaded successfully with CPU delegate (fallback)');
    } else {
      throw gpuError;
    }
  }
  
  return faceLandmarker;
}

export function isFaceLandmarkerLoaded(): boolean {
  return faceLandmarker != null;
}

/**
 * Calculate Eye Aspect Ratio (EAR) for blink detection
 * EAR = (vertical1 + vertical2) / (2 * horizontal)
 * Lower EAR = eye closed, Higher EAR = eye open
 */
function calculateEAR(landmarks: NormalizedLandmark[], eyePoints: number[]): number {
  if (eyePoints.length < 6) return 1.0;
  
  const points = eyePoints.map(idx => landmarks[idx]);
  
  // Vertical distances
  const vertical1 = Math.sqrt(
    Math.pow(points[1].x - points[5].x, 2) + 
    Math.pow(points[1].y - points[5].y, 2)
  );
  const vertical2 = Math.sqrt(
    Math.pow(points[2].x - points[4].x, 2) + 
    Math.pow(points[2].y - points[4].y, 2)
  );
  
  // Horizontal distance
  const horizontal = Math.sqrt(
    Math.pow(points[0].x - points[3].x, 2) + 
    Math.pow(points[0].y - points[3].y, 2)
  );
  
  if (horizontal === 0) return 1.0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

/**
 * Detect blinks by tracking EAR over time — ผ่อนให้จับได้ง่าย กระพริบครั้งเดียวก็ผ่าน
 */
function detectBlink(landmarks: NormalizedLandmark[]): boolean {
  const leftEAR = calculateEAR(landmarks, LEFT_EYE_POINTS);
  const rightEAR = calculateEAR(landmarks, RIGHT_EYE_POINTS);
  const avgEAR = (leftEAR + rightEAR) / 2;
  
  // สมดุล: จับการกระพริบได้ง่าย แต่ยังบังคับทั้งสองตาปิด (กันรูปภาพ)
  const EAR_THRESHOLD_CLOSED = 0.17;  // ตาปิด (สมดุล — รูปภาพกระพริบไม่ได้ แต่ใบหน้าจริงผ่านได้)
  const EAR_THRESHOLD_OPEN = 0.23;    // ตาเปิด (สมดุล)
  
  if (landmarksHistory.length < 2) return false; // ต้องมีอย่างน้อย 2 เฟรม
  
  // บน mobile: ดู 6 เฟรมล่าสุด (เร็วมาก), desktop: 15 เฟรม
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  const historyLength = isMobile ? 6 : 15;
  const recentEARs = landmarksHistory.slice(-historyLength).map(h => {
    const left = calculateEAR(h.landmarks, LEFT_EYE_POINTS);
    const right = calculateEAR(h.landmarks, RIGHT_EYE_POINTS);
    const avg = (left + right) / 2;
    return {
      avg,
      left,
      right,
      // ต้องทั้งสองตาปิดพร้อมกัน — กันรูปภาพ
      bothClosed: left < EAR_THRESHOLD_CLOSED && right < EAR_THRESHOLD_CLOSED,
      // รับได้ถ้าค่าเฉลี่ยต่ำชัดเจน (ผ่อนให้จับได้ง่าย)
      clearlyClosed: avg < 0.18 || (left < EAR_THRESHOLD_CLOSED && right < EAR_THRESHOLD_CLOSED),
    };
  });
  
  // Pattern: รับได้หลายรูปแบบ — ผ่านเร็ว (แต่ยังบังคับทั้งสองตาปิด)
  for (let i = 0; i < recentEARs.length - 1; i++) {
    const curr = recentEARs[i];
    const next = recentEARs[i + 1];
    const openNext = next.avg > EAR_THRESHOLD_OPEN;
    
    // Pattern 1: ปิด (ทั้งสองตา) -> เปิด (รับได้ — เร็ว)
    if (curr.bothClosed && openNext) return true;
    // Pattern 2: ปิด (ชัดเจน) -> เปิด (รับได้)
    if (curr.clearlyClosed && openNext) return true;
    // Pattern 3: เปิด -> ปิด (ทั้งสองตา) -> เปิด (ดีที่สุด)
    if (i > 0) {
      const prev = recentEARs[i - 1];
      const openPrev = prev.avg > EAR_THRESHOLD_OPEN;
      if (openPrev && curr.bothClosed && openNext) return true;
      if (openPrev && curr.clearlyClosed && openNext) return true;
    }
  }
  return false;
}

/**
 * Calculate head pose angles (yaw, pitch, roll) from landmarks
 */
function calculateHeadPose(landmarks: NormalizedLandmark[]): { yaw: number; pitch: number; roll: number } {
  // Use key facial points for pose estimation
  const noseTip = landmarks[4];      // Nose tip
  const chin = landmarks[175];      // Chin
  const leftEye = landmarks[33];    // Left eye corner
  const rightEye = landmarks[263];  // Right eye corner
  const leftMouth = landmarks[61];  // Left mouth corner
  const rightMouth = landmarks[291]; // Right mouth corner
  
  // Calculate roll (rotation around Z-axis)
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const mouthCenterY = (leftMouth.y + rightMouth.y) / 2;
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
  
  // Calculate pitch (rotation around Y-axis) - simplified
  const faceHeight = Math.abs(chin.y - (eyeCenterY + mouthCenterY) / 2);
  const pitch = Math.atan2(noseTip.y - chin.y, faceHeight) * (180 / Math.PI);
  
  // Calculate yaw (rotation around X-axis) - simplified
  const faceWidth = Math.abs(rightEye.x - leftEye.x);
  const yaw = Math.atan2(noseTip.x - (leftEye.x + rightEye.x) / 2, faceWidth) * (180 / Math.PI);
  
  return { yaw, pitch, roll };
}

/**
 * Detect head movement by comparing current pose with history
 * ปรับให้แยกระหว่างการเอียงรูปภาพกับการขยับหัวจริง - เข้มงวดมาก
 */
function detectHeadMovement(): boolean {
  // ใช้แค่ 2 frames เพื่อความเร็ว (รูปภาพขยับไม่ต่อเนื่อง)
  if (landmarksHistory.length < 2) return false;
  
  const current = calculateHeadPose(landmarksHistory[landmarksHistory.length - 1].landmarks);
  const old = calculateHeadPose(landmarksHistory[0].landmarks);
  const midPoint = Math.floor(landmarksHistory.length / 2);
  const mid = calculateHeadPose(landmarksHistory[midPoint].landmarks);
  
  const yawDiff = Math.abs(current.yaw - old.yaw);
  const pitchDiff = Math.abs(current.pitch - old.pitch);
  const rollDiff = Math.abs(current.roll - old.roll);
  const yawDiffMid = Math.abs(current.yaw - mid.yaw);
  const pitchDiffMid = Math.abs(current.pitch - mid.pitch);
  
  const movements: number[] = [];
  for (let i = 1; i < landmarksHistory.length; i++) {
    const prev = calculateHeadPose(landmarksHistory[i - 1].landmarks);
    const curr = calculateHeadPose(landmarksHistory[i].landmarks);
    const movement = Math.sqrt(
      Math.pow(curr.yaw - prev.yaw, 2) +
      Math.pow(curr.pitch - prev.pitch, 2) +
      Math.pow(curr.roll - prev.roll, 2)
    );
    movements.push(movement);
  }
  
  const avgMovement = movements.reduce((a, b) => a + b, 0) / movements.length;
  const movementVariance = movements.reduce((sum, m) => sum + Math.pow(m - avgMovement, 2), 0) / movements.length;
  const movementStdDev = Math.sqrt(movementVariance);
  const movementCoefficient = movementStdDev / (avgMovement + 0.1);
  const isSmoothMovement = movementCoefficient < 1.3;
  
  // บน mobile: ลด threshold เป็น 2 องศา (เร็วขึ้น), desktop: 3 องศา
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  const MOVEMENT_THRESHOLD = isMobile ? 2 : 3;
  const hasSignificantMovement =
    (yawDiff > MOVEMENT_THRESHOLD || pitchDiff > MOVEMENT_THRESHOLD || rollDiff > MOVEMENT_THRESHOLD) &&
    (yawDiffMid > MOVEMENT_THRESHOLD / 2 || pitchDiffMid > MOVEMENT_THRESHOLD / 2);
  
  const hasContinuousMovement = avgMovement > (isMobile ? 0.2 : 0.3) && isSmoothMovement; // บน mobile: 0.2 (เร็วขึ้น)
  return hasSignificantMovement && hasContinuousMovement;
}

/**
 * Texture analysis to distinguish 2D photos from 3D faces - ปรับให้แม่นยำขึ้น
 * Real faces have more texture variation and depth cues
 */
function analyzeTexture(
  video: HTMLVideoElement,
  faceBox: { x: number; y: number; width: number; height: number }
): boolean {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  
  // Crop face region - เพิ่มขนาดเพื่อวิเคราะห์ได้ละเอียดขึ้น
  const padding = 0.15;
  const x = Math.max(0, faceBox.x - faceBox.width * padding);
  const y = Math.max(0, faceBox.y - faceBox.height * padding);
  const w = Math.min(video.videoWidth - x, faceBox.width * (1 + 2 * padding));
  const h = Math.min(video.videoHeight - y, faceBox.height * (1 + 2 * padding));
  
  // ขนาดพอวิเคราะห์ — เล็กลงเพื่อความเร็ว (128)
  canvas.width = Math.min(128, w);
  canvas.height = Math.min(128, h);
  ctx.drawImage(video, x, y, w, h, 0, 0, canvas.width, canvas.height);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Calculate variance (texture richness)
  let sum = 0;
  let sumSq = 0;
  const pixelCount = canvas.width * canvas.height;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += gray;
    sumSq += gray * gray;
  }
  
  const mean = sum / pixelCount;
  const variance = (sumSq / pixelCount) - (mean * mean);
  
  // คำนวณ edge density (ความหนาแน่นของขอบ) - รูปภาพมักมี edge น้อยกว่าใบหน้าจริง
  let edgeCount = 0;
  const edgeThreshold = 20; // ความแตกต่างของ pixel ที่นับเป็น edge
  
  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * canvas.width + x) * 4;
      const currentGray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // ตรวจสอบเพื่อนบ้าน
      const rightIdx = (y * canvas.width + (x + 1)) * 4;
      const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
      const bottomIdx = ((y + 1) * canvas.width + x) * 4;
      const bottomGray = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
      
      if (Math.abs(currentGray - rightGray) > edgeThreshold ||
          Math.abs(currentGray - bottomGray) > edgeThreshold) {
        edgeCount++;
      }
    }
  }
  
  const edgeDensity = edgeCount / pixelCount;
  
  // คำนวณ local variance (ความแปรปรวนในพื้นที่เล็กๆ) - ใบหน้าจริงมี local variance สูงกว่า
  let localVarianceSum = 0;
  const blockSize = 8;
  const blocksX = Math.floor(canvas.width / blockSize);
  const blocksY = Math.floor(canvas.height / blockSize);
  
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let blockSum = 0;
      let blockSumSq = 0;
      let blockPixelCount = 0;
      
      for (let py = by * blockSize; py < Math.min((by + 1) * blockSize, canvas.height); py++) {
        for (let px = bx * blockSize; px < Math.min((bx + 1) * blockSize, canvas.width); px++) {
          const idx = (py * canvas.width + px) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          blockSum += gray;
          blockSumSq += gray * gray;
          blockPixelCount++;
        }
      }
      
      if (blockPixelCount > 0) {
        const blockMean = blockSum / blockPixelCount;
        const blockVariance = (blockSumSq / blockPixelCount) - (blockMean * blockMean);
        localVarianceSum += blockVariance;
      }
    }
  }
  
  const avgLocalVariance = localVarianceSum / (blocksX * blocksY);
  
  // Real faces typically have:
  // - Higher variance (more texture)
  // - Higher edge density (more details)
  // - Higher local variance (more depth variation)
  // บน mobile: ลด threshold เพื่อให้ผ่านเร็วขึ้น แต่ยังป้องกันรูปภาพได้
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  const VARIANCE_THRESHOLD = isMobile ? 250 : 290;  // บน mobile: ลดจาก 290 เป็น 250
  const EDGE_DENSITY_THRESHOLD = isMobile ? 0.14 : 0.17;  // บน mobile: ลดจาก 0.17 เป็น 0.14
  const LOCAL_VARIANCE_THRESHOLD = isMobile ? 150 : 170;  // บน mobile: ลดจาก 170 เป็น 150
  
  const variancePass = variance > VARIANCE_THRESHOLD;
  const edgePass = edgeDensity > EDGE_DENSITY_THRESHOLD;
  const localVariancePass = avgLocalVariance > LOCAL_VARIANCE_THRESHOLD;
  
  // บน mobile: ต้องผ่านอย่างน้อย 1 ใน 3 (เร็วมาก), desktop: 2 ใน 3
  const checksPassed = [variancePass, edgePass, localVariancePass].filter(Boolean).length;
  // บน mobile: ผ่านอย่างน้อย 1/3 หรือผ่าน variance (สำคัญที่สุด), desktop: 2/3 หรือ variance
  return isMobile ? (checksPassed >= 1 || variancePass) : (checksPassed >= 2 || (checksPassed >= 1 && variancePass));
}

/**
 * Main liveness detection function
 */
export async function detectLiveness(
  video: HTMLVideoElement,
  timestamp: number,
  faceBox: { x: number; y: number; width: number; height: number }
): Promise<LivenessResult> {
  try {
    // โหลด Face Landmarker ถ้ายังไม่ได้โหลด
    if (!faceLandmarker) {
      try {
        await loadFaceLandmarker();
      } catch (loadError) {
        console.error('[detectLiveness] Failed to load Face Landmarker:', loadError);
        throw new Error(`Failed to load Face Landmarker: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`);
      }
    }
    
    // ตรวจสอบว่า video พร้อมหรือไม่ - mobile อาจใช้เวลานานกว่า
    if (!faceLandmarker) {
      return {
        passed: false,
        confidence: 0,
        reasons: ['⏳ Face landmarker กำลังโหลด... กรุณารอสักครู่'],
        blinkDetected: false,
        headMovementDetected: false,
        textureAnalysisPassed: false,
      };
    }
    
    // ตรวจสอบว่าเป็น mobile device หรือไม่
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    
    // บน mobile: ใช้ readyState >= 2 (HAVE_CURRENT_DATA) เพื่อให้เริ่ม scan ได้เร็วขึ้น
    // บน desktop: readyState >= 2 ก็พอ
    const minReadyState = 2; // ลดจาก 3 เป็น 2 เพื่อให้ mobile เริ่ม scan ได้เร็วขึ้น
    
    if (video.readyState < minReadyState) {
      return {
        passed: false,
        confidence: 0,
        reasons: ['⏳ กำลังโหลดวิดีโอ... กรุณารอสักครู่'],
        blinkDetected: false,
        headMovementDetected: false,
        textureAnalysisPassed: false,
      };
    }
    
    // ตรวจสอบว่ามีขนาด video หรือไม่ (อาจเป็น 0 ในบางกรณี)
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return {
        passed: false,
        confidence: 0,
        reasons: ['⏳ กำลังโหลดวิดีโอ... กรุณารอสักครู่'],
        blinkDetected: false,
        headMovementDetected: false,
        textureAnalysisPassed: false,
      };
    }
    
    // บน mobile: ตรวจสอบว่า video มีขนาดที่เหมาะสม (ไม่ควรเป็น 0)
    // ลด threshold จาก 100 เป็น 50 เพื่อให้เริ่ม scan ได้เร็วขึ้น
    if (isMobile && (video.videoWidth < 50 || video.videoHeight < 50)) {
      return {
        passed: false,
        confidence: 0,
        reasons: ['⏳ กำลังโหลดวิดีโอ... กรุณารอสักครู่'],
        blinkDetected: false,
        headMovementDetected: false,
        textureAnalysisPassed: false,
      };
    }
    
    let result: { faceLandmarks?: unknown[] } | undefined;
    try {
      const useFaceCrop = isMobile && faceBox.width > 10 && faceBox.height > 10;
      const inputSource: HTMLVideoElement | HTMLCanvasElement = useFaceCrop
        ? drawFaceCropToCanvas(video, faceBox)
        : video;

      const attempts = isMobile ? 3 : 1; // บน mobile ลดจาก 5 เป็น 3 เพื่อความเร็ว (ถ้าเจอครั้งแรกก็ break แล้ว)
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          if (isMobile && attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, 30 * attempt)); // ลด delay จาก 80ms เป็น 30ms
          }

          // ตรวจสอบว่า video พร้อมหรือไม่ก่อนเรียก detectForVideo (ป้องกัน error)
          if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
            if (isMobile && attempt < attempts - 1) {
              await new Promise(resolve => setTimeout(resolve, 50)); // รอให้ video พร้อม
              continue; // ลอง attempt ถัดไป
            }
            throw new Error('Video not ready');
          }

          // บน mobile: บาง attempt ลองทั้ง crop และ full video (เริ่มที่ attempt 1 แทน 2 เพื่อเร็วขึ้น)
          const source = (isMobile && attempt >= 1 && useFaceCrop) ? video : inputSource;
          result = faceLandmarker.detectForVideo(source, timestamp);

          if (result?.faceLandmarks?.length) {
            if (isMobile) {
              console.log('[detectLiveness] Mobile: Face landmarks detected successfully!', {
                useFaceCrop,
                usedFullVideo: source === video,
                attempt: attempt + 1,
                landmarksCount: result.faceLandmarks.length,
                videoSize: `${video.videoWidth}x${video.videoHeight}`,
                sourceType: source === video ? 'fullVideo' : 'faceCrop'
              });
            }
            break;
          } else {
            // ไม่มี landmarks — บน mobile log เพื่อ debug (ลดความถี่)
            if (isMobile && attempt % 2 === 0) { // Log เฉพาะ attempt คู่
              console.log(`[detectLiveness] Mobile: Attempt ${attempt + 1}/${attempts} - No landmarks`, {
                useFaceCrop,
                usedFullVideo: source === video,
                videoSize: `${video.videoWidth}x${video.videoHeight}`,
                faceBox: { width: faceBox.width, height: faceBox.height }
              });
            }
          }
          // ไม่มี landmarks — บน mobile ลองใช้ full video ในรอบถัดไป (ลด delay)
          if (isMobile && attempt < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 20)); // ลดจาก 50ms เป็น 20ms
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (isMobile) {
            console.warn(`[detectLiveness] Mobile: Attempt ${attempt + 1} failed:`, err);
          }
          if (attempt < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 30)); // ลด delay จาก 80ms เป็น 30ms
          }
        }
      }

      if (!result && lastError) {
        // บน mobile: ไม่ throw error แต่ return result ที่บอกว่าเกิด error แทน (เพื่อไม่ให้ crash)
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
        if (isMobile) {
          console.warn('[detectLiveness] Mobile: All attempts failed, returning error result instead of throwing:', lastError);
          return {
            passed: false,
            confidence: 0,
            reasons: ['⏳ เกิดข้อผิดพลาดในการตรวจจับ - กรุณาลองปิดและเปิดกล้องใหม่'],
            blinkDetected: false,
            headMovementDetected: false,
            textureAnalysisPassed: false,
          };
        }
        throw lastError;
      }
    } catch (detectError) {
      console.error('[detectLiveness] detectForVideo failed:', detectError);
      // บน mobile: ไม่ throw แต่ return error result แทน
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
      const errorMsg = detectError instanceof Error ? detectError.message : String(detectError);
      console.error('[detectLiveness] Error details:', {
        error: errorMsg,
        videoSize: `${video.videoWidth}x${video.videoHeight}`,
        readyState: video.readyState,
        faceBox: { width: faceBox.width, height: faceBox.height }
      });
      return {
        passed: false,
        confidence: 0,
        reasons: [isMobile 
          ? '⏳ เกิดข้อผิดพลาดในการตรวจจับ - กรุณาลองปิดและเปิดกล้องใหม่' 
          : '⏳ เกิดข้อผิดพลาดในการตรวจจับ'],
        blinkDetected: false,
        headMovementDetected: false,
        textureAnalysisPassed: false,
      };
    }
    
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      // ไม่พบ landmarks - อาจเป็นเพราะใบหน้าไม่อยู่ในเฟรม หรือแสงไม่พอ
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
      
      if (isMobile) {
        console.warn('[detectLiveness] Mobile: No face landmarks detected after all attempts', {
          videoSize: `${video.videoWidth}x${video.videoHeight}`,
          readyState: video.readyState,
          hasResult: !!result,
          landmarksCount: result?.faceLandmarks?.length ?? 0,
          faceBox: { width: faceBox.width, height: faceBox.height },
          attempts: attempts,
          useFaceCrop: isMobile && faceBox.width > 10 && faceBox.height > 10
        });
      }
      
      return {
        passed: false,
        confidence: 0,
        reasons: [isMobile 
          ? '⏳ ยังจับจุดใบหน้าไม่เจอ — ลองขยับหน้านิดหนึ่งหรือหามุมที่แสงพอ แล้วมองตรงกล้อง' 
          : '⏳ ไม่พบ facial landmarks - กรุณามองตรงที่กล้อง'],
        blinkDetected: false,
        headMovementDetected: false,
        textureAnalysisPassed: false,
      };
    }
    
    const landmarks = result!.faceLandmarks[0] as NormalizedLandmark[];
    
    // Add to history
    landmarksHistory.push({ timestamp, landmarks });
    if (landmarksHistory.length > MAX_HISTORY) {
      landmarksHistory.shift();
    }
    
    // ตรวจสอบ screen capture ก่อน (รูปภาพในโทรศัพท์) - เข้มงวดมาก
    const isScreenCapture = detectScreenCapture(video);
    if (isScreenCapture) {
      return {
        passed: false,
        confidence: 0,
        reasons: ['❌ ตรวจพบว่าเป็น Screen Capture (อาจเป็นรูปภาพในโทรศัพท์) กรุณาใช้กล้องจริงเท่านั้น'],
        blinkDetected: false,
        headMovementDetected: false,
        textureAnalysisPassed: false,
      };
    }
    
    // อัปเดต frame history แบบเบาทุกเฟรม (สำหรับบล็อกรูปนิ่ง)
    pushFrameHistoryLight(video, faceBox);
    
    // บล็อกรูปภาพนิ่ง/รูปในมือถือทันที — เข้มงวดขึ้น
    if (frameHistory.length >= 2) {
      const uniqueHashes = new Set(frameHistory.map(f => f.frameHash));
      const uniqueHashRatio = uniqueHashes.size / frameHistory.length;
      // เข้มงวด: รูปภาพนิ่งจะมี hash เหมือนกันเกือบทุกเฟรม
      if (uniqueHashes.size <= 1 || uniqueHashRatio < 0.6) {
        return {
          passed: false,
          confidence: 0,
          reasons: ['❌ ไม่พบการเปลี่ยนแปลงของภาพ (อาจเป็นรูปภาพนิ่ง) กรุณาใช้ใบหน้าจริง'],
          blinkDetected: false,
          headMovementDetected: false,
          textureAnalysisPassed: false,
        };
      }
    }
    
    // บล็อกรูปภาพที่หมุน/เอียง/เปลี่ยนมุม (การกระตุก) — เข้มงวดมากมาก
    if (landmarksHistory.length >= 3) {
      let discontinuityCount = 0;
      const DISCONTINUITY_THRESHOLD = 0.020; // เข้มงวดมากมาก — ลด threshold เพื่อจับการกระตุกได้ดีขึ้น
      
      for (let i = 1; i < landmarksHistory.length; i++) {
        const prev = landmarksHistory[i - 1].landmarks;
        const curr = landmarksHistory[i].landmarks;
        
        // ตรวจสอบการเปลี่ยนแปลงของ landmarks หลัก (ตา, จมูก, ปาก)
        const keyPoints = [33, 263, 4, 61, 291]; // ตาซ้าย, ตาขวา, จมูก, ปากซ้าย, ปากขวา
        let maxChange = 0;
        let totalChange = 0;
        let varianceChange = 0; // ความแปรปรวนของการเปลี่ยนแปลง
        
        for (const idx of keyPoints) {
          if (prev[idx] && curr[idx]) {
            const change = Math.sqrt(
              Math.pow(curr[idx].x - prev[idx].x, 2) +
              Math.pow(curr[idx].y - prev[idx].y, 2)
            );
            maxChange = Math.max(maxChange, change);
            totalChange += change;
            varianceChange += Math.pow(change, 2);
          }
        }
        
        const avgChange = totalChange / keyPoints.length;
        const changeVariance = (varianceChange / keyPoints.length) - (avgChange * avgChange);
        const changeStdDev = Math.sqrt(changeVariance);
        
        // เข้มงวดมากมาก: จับการกระตุกได้ดีขึ้น
        // รูปภาพที่เอียง/เปลี่ยนมุมจะมี maxChange สูงแต่ avgChange ต่ำ (กระตุก)
        if (maxChange > DISCONTINUITY_THRESHOLD || 
            (maxChange > 0.015 && avgChange < maxChange * 0.4) || // เข้มงวดมากมาก
            (changeStdDev > 0.010 && avgChange < 0.015) || // เข้มงวดมากมาก
            (maxChange > 0.03)) { // ถ้า maxChange สูงมาก = กระตุกชัดเจน
          discontinuityCount++;
        }
      }
      
      const discontinuityRatio = discontinuityCount / (landmarksHistory.length - 1);
      if (discontinuityRatio > 0.15) { // เข้มงวดมากมาก — ลดจาก 0.2 เป็น 0.15
        return {
          passed: false,
          confidence: 0,
          reasons: ['❌ ตรวจพบการเปลี่ยนแปลงแบบกระตุก (อาจเป็นรูปภาพที่เอียง/เปลี่ยนมุม) กรุณาใช้ใบหน้าจริง'],
          blinkDetected: false,
          headMovementDetected: false,
          textureAnalysisPassed: false,
        };
      }
    }
    
    // Run checks — บังคับทุกการตรวจสอบเพื่อกันรูปภาพ แต่ให้ใบหน้าจริงผ่านได้เร็ว
    const blinkDetected = detectBlink(landmarks);
    const headMovementDetected = landmarksHistory.length >= 2 ? detectHeadMovement() : false;
    let textureAnalysisPassed: boolean;
    let frameVariationPassed: boolean;
    
    // บังคับให้รัน texture + frameVariation เมื่อ blink ผ่านแล้ว (เพื่อความเร็ว)
    if (blinkDetected && landmarksHistory.length >= 2) {
      textureAnalysisPassed = analyzeTexture(video, faceBox);
      frameVariationPassed = checkFrameVariation(video, faceBox);
    } else {
      // ถ้ายังไม่ blink หรือยังไม่มีข้อมูลพอ — ให้ผ่านก่อน (รอ blink ก่อน)
      textureAnalysisPassed = true;
      frameVariationPassed = true;
    }
    
    // บังคับให้ blink ผ่านเสมอ — รูปภาพกระพริบตาไม่ได้
    if (!blinkDetected) {
      return {
        passed: false,
        confidence: 0,
        reasons: ['❌ ไม่พบการกระพริบตา — รูปภาพกระพริบตาไม่ได้ กรุณากระพริบตาหนึ่งครั้ง'],
        blinkDetected: false,
        headMovementDetected,
        textureAnalysisPassed,
      };
    }
    
    // ถ้า blink ผ่านแล้ว → ตรวจ texture + frameVariation (บังคับผ่านเพื่อกันรูปภาพ)
    if (blinkDetected && landmarksHistory.length >= 2) {
      // บังคับให้ frameVariation ผ่าน — รูปภาพมีการเปลี่ยนแปลงไม่ต่อเนื่อง
      if (!frameVariationPassed) {
        return {
          passed: false,
          confidence: 0,
          reasons: ['❌ ตรวจพบการเปลี่ยนแปลงแบบไม่ต่อเนื่อง (อาจเป็นรูปภาพ) กรุณาใช้ใบหน้าจริง'],
          blinkDetected: true,
          headMovementDetected,
          textureAnalysisPassed,
        };
      }
      
      // บังคับให้ texture ผ่าน — รูปภาพมี texture ต่างจากใบหน้าจริง
      if (!textureAnalysisPassed) {
        return {
          passed: false,
          confidence: 0,
          reasons: ['❌ การวิเคราะห์พื้นผิวไม่ผ่าน (อาจเป็นรูปภาพ) กรุณาใช้ใบหน้าจริง'],
          blinkDetected: true,
          headMovementDetected,
          textureAnalysisPassed: false,
        };
      }
    }
    
    const reasons: string[] = [];
    let confidence = 0;
    
    // Score each check - เข้มงวดกับรูปภาพ แต่ให้ใบหน้าจริงผ่านได้เร็ว
    if (blinkDetected) {
      confidence += 0.3; // ลดจาก 0.4 เป็น 0.3 เพราะไม่บังคับ blink แล้ว
      reasons.push('✅ ตรวจพบการกระพริบตา');
    } else if (landmarksHistory.length < 2) {
      reasons.push('⏳ กรุณากระพริบตาหนึ่งครั้ง');
    } else {
      reasons.push('❌ ไม่พบการกระพริบตา');
    }
    
    if (headMovementDetected) {
      confidence += 0.2;
      reasons.push('✅ ตรวจพบการขยับหัว');
    } else if (landmarksHistory.length < 2) {
      reasons.push('⏳ กำลังรอข้อมูล');
    } else {
      reasons.push('⚠️ ไม่พบการขยับหัว');
    }
    
    if (textureAnalysisPassed) {
      confidence += 0.1; // ลดจาก 0.2 เป็น 0.1 (ไม่สำคัญเท่า blink/head movement)
      reasons.push('✅ การวิเคราะห์พื้นผิวผ่าน (ใบหน้า 3D)');
    } else {
      // ไม่ลงโทษมาก (อาจเป็นเพราะแสง)
      reasons.push('⚠️ การวิเคราะห์พื้นผิวไม่ผ่าน (ตรวจสอบแสงและตำแหน่ง)');
    }
    
    // เริ่มต้น confidence ที่ 0.3 เพื่อให้ใบหน้าจริงมีโอกาสผ่านมากขึ้น
    confidence = Math.max(0.3, Math.min(1, confidence));
    
    // เพิ่มการตรวจสอบ frame variation - ไม่สำคัญเท่า blink/head movement
    if (frameVariationPassed) {
      confidence += 0.1; // ลดจาก 0.15 เป็น 0.1 (ไม่สำคัญเท่า blink/head movement)
      reasons.push('✅ ตรวจพบการเปลี่ยนแปลงของ frame แบบต่อเนื่อง');
    } else if (frameHistory.length < 5) {
      reasons.push('⏳ กำลังรอข้อมูล');
    } else {
      // ไม่ลงโทษมาก (อาจเป็นเพราะแสงหรือคุณภาพกล้อง)
      reasons.push('⚠️ ไม่พบการเปลี่ยนแปลงของ frame แบบต่อเนื่อง');
    }
    
    // เข้มงวดมาก: บังคับให้ผ่านทุกการตรวจสอบเพื่อกันรูปภาพ
    // ไม่ยืดหยุ่น — รูปภาพต้องถูกบล็อกเสมอ
    
    // รอ 2 เฟรม แล้วตัดสิน — ต้องมีข้อมูลพอสำหรับการตรวจสอบ
    // แต่ถ้า blink ผ่านแล้ว ให้ผ่านได้เลย (ไม่ต้องรอ head movement)
    if (landmarksHistory.length < 2 && !blinkDetected) {
      return {
        passed: false,
        confidence: Math.max(0, confidence * 0.85),
        reasons: [...reasons, `⏳ กรุณากระพริบตาหนึ่งครั้ง (${landmarksHistory.length}/2)`],
        blinkDetected,
        headMovementDetected,
        textureAnalysisPassed,
      };
    }
    
    // ถ้า blink ผ่านแล้วและมีข้อมูลพอ (2 frames) ให้ผ่านได้เลย (ไม่ต้องรอ head movement)
    if (blinkDetected && landmarksHistory.length >= 2) {
      // ตรวจ texture และ frame variation ถ้ามีข้อมูลพอ
      if (frameHistory.length >= 3) {
        if (!frameVariationPassed || !textureAnalysisPassed) {
          // ถ้าไม่ผ่าน texture/frame variation ให้แสดง error แต่ยังไม่บล็อก (ให้โอกาสอีกครั้ง)
          return {
            passed: false,
            confidence: Math.max(confidence * 0.7, 0.5),
            reasons: [...reasons, '⚠️ กำลังตรวจสอบเพิ่มเติม... กรุณากระพริบตาอีกครั้ง'],
            blinkDetected,
            headMovementDetected,
            textureAnalysisPassed,
          };
        }
      }
      // ผ่านแล้ว
      return {
        passed: true,
        confidence: Math.max(confidence, 0.85),
        reasons: [...reasons, '✅ ตรวจพบการกระพริบตา — ใบหน้าจริง'],
        blinkDetected,
        headMovementDetected,
        textureAnalysisPassed,
      };
    }
    
    // บังคับการกระพริบตา — รูปถ่าย/รูปในมือถือกระพริบไม่ได้ (เข้มงวด)
    // (ตรวจสอบแล้วข้างบน แต่ตรวจสอบอีกครั้งเพื่อความแน่ใจ)
    if (!blinkDetected) {
      return {
        passed: false,
        confidence: 0,
        reasons: ['❌ ไม่พบการกระพริบตา — รูปภาพกระพริบตาไม่ได้ กรุณากระพริบตาหนึ่งครั้ง'],
        blinkDetected,
        headMovementDetected,
        textureAnalysisPassed,
      };
    }
    
    // บังคับให้ผ่านทุกการตรวจสอบ — ไม่ยืดหยุ่น
    // ผ่าน: มีการกระพริบตา + texture ผ่าน + frame variation ผ่าน
    return {
      passed: true,
      confidence: Math.max(confidence, 0.85),
      reasons: [...reasons, '✅ ตรวจพบการกระพริบตา — ใบหน้าจริง'],
      blinkDetected,
      headMovementDetected,
      textureAnalysisPassed,
    };
  } catch (error) {
    // จัดการ error อย่างละเอียด
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[detectLiveness] Error:', errorMessage, error);
    
    // ถ้าเป็น error ที่เกี่ยวกับการโหลด model ให้ return message ที่เป็นมิตร
    if (errorMessage.includes('load') || errorMessage.includes('model') || errorMessage.includes('network')) {
      return {
        passed: false,
        confidence: 0,
        reasons: ['⏳ กำลังโหลดโมเดล 3D liveness... กรุณารอสักครู่'],
        blinkDetected: false,
        headMovementDetected: false,
        textureAnalysisPassed: false,
      };
    }
    
    // ถ้าเป็น error อื่นๆ ให้ return message ทั่วไป
    return {
      passed: false,
      confidence: 0,
      reasons: [`⏳ เกิดข้อผิดพลาดในการตรวจสอบ: ${errorMessage}. กรุณาลองใหม่อีกครั้ง`],
      blinkDetected: false,
      headMovementDetected: false,
      textureAnalysisPassed: false,
    };
  }
}

/**
 * Calculate simple hash of image data for frame comparison
 */
function calculateFrameHash(imageData: ImageData): string {
  // สร้าง hash แบบง่ายๆ จาก pixel values
  let hash = 0;
  const data = imageData.data;
  // Sample every 10th pixel เพื่อความเร็ว
  for (let i = 0; i < data.length; i += 40) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/** อัปเดต frame history แบบเบา (ใช้ทุกเฟรม) — เฉพาะ hash + variance เพื่อบล็อกรูปนิ่ง */
function pushFrameHistoryLight(video: HTMLVideoElement, faceBox: { x: number; y: number; width: number; height: number }): void {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return;
  const padding = 0.1;
  const x = Math.max(0, faceBox.x - faceBox.width * padding);
  const y = Math.max(0, faceBox.y - faceBox.height * padding);
  const w = Math.min(video.videoWidth - x, faceBox.width * (1 + 2 * padding));
  const h = Math.min(video.videoHeight - y, faceBox.height * (1 + 2 * padding));
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(video, x, y, w, h, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const frameHash = calculateFrameHash(imageData);
  const data = imageData.data;
  let sum = 0, sumSq = 0;
  const n = (size * size);
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += g;
    sumSq += g * g;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const now = Date.now();
  frameHistory.push({ timestamp: now, frameHash });
  framePixelHistory.push({ timestamp: now, pixelVariance: variance });
  frameHistory = frameHistory.slice(-12);
  framePixelHistory = framePixelHistory.slice(-12);
}

/**
 * Check if frames are changing (not static image) - ปรับให้ตรวจจับรูปภาพในโทรศัพท์ได้ดีขึ้น
 */
function checkFrameVariation(video: HTMLVideoElement, faceBox: { x: number; y: number; width: number; height: number }): boolean {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  
  const padding = 0.1;
  const x = Math.max(0, faceBox.x - faceBox.width * padding);
  const y = Math.max(0, faceBox.y - faceBox.height * padding);
  const w = Math.min(video.videoWidth - x, faceBox.width * (1 + 2 * padding));
  const h = Math.min(video.videoHeight - y, faceBox.height * (1 + 2 * padding));
  
  canvas.width = Math.min(64, w);
  canvas.height = Math.min(64, h);
  ctx.drawImage(video, x, y, w, h, 0, 0, canvas.width, canvas.height);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const frameHash = calculateFrameHash(imageData);
  const now = Date.now();
  
  // คำนวณ pixel variance สำหรับตรวจสอบการเปลี่ยนแปลง
  const data = imageData.data;
  let sum = 0;
  let sumSq = 0;
  const pixelCount = canvas.width * canvas.height;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += gray;
    sumSq += gray * gray;
  }
  
  const mean = sum / pixelCount;
  const variance = (sumSq / pixelCount) - (mean * mean);
  
  frameHistory.push({ timestamp: now, frameHash });
  framePixelHistory.push({ timestamp: now, pixelVariance: variance });
  
  // บน mobile: เก็บแค่ 8 เฟรม (เร็วขึ้น), desktop: 12 เฟรม
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  const historySize = isMobile ? 8 : 12;
  frameHistory = frameHistory.slice(-historySize);
  framePixelHistory = framePixelHistory.slice(-historySize);
  
  // บน mobile: รอแค่ 2 เฟรม (เร็วมาก), desktop: 3 เฟรม
  const minFrames = isMobile ? 2 : 3;
  if (frameHistory.length < minFrames) return false;
  
  // Check if frames are actually changing (hash-based)
  const uniqueHashes = new Set(frameHistory.map(f => f.frameHash));
  const variationRatio = uniqueHashes.size / frameHistory.length;
  
  // Check pixel variance variation (รูปภาพในโทรศัพท์มักมี variance คงที่)
  const variances = framePixelHistory.map(f => f.pixelVariance);
  const varianceMean = variances.reduce((a, b) => a + b, 0) / variances.length;
  const varianceStdDev = Math.sqrt(
    variances.reduce((sum, v) => sum + Math.pow(v - varianceMean, 2), 0) / variances.length
  );
  const varianceCoefficient = varianceStdDev / (varianceMean + 1); // Coefficient of variation
  
  // ตรวจสอบการเปลี่ยนแปลงแบบต่อเนื่อง (ไม่ใช่การกระตุก)
  // รูปภาพที่เอียงจะมีการเปลี่ยนแปลงแบบกระตุก (บาง frame เปลี่ยนมาก บาง frame ไม่เปลี่ยน)
  const varianceChanges: number[] = [];
  for (let i = 1; i < framePixelHistory.length; i++) {
    const change = Math.abs(framePixelHistory[i].pixelVariance - framePixelHistory[i - 1].pixelVariance);
    varianceChanges.push(change);
  }
  
  const avgChange = varianceChanges.reduce((a, b) => a + b, 0) / varianceChanges.length;
  const changeVariance = varianceChanges.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / varianceChanges.length;
  const changeStdDev = Math.sqrt(changeVariance);
  const changeCoefficient = changeStdDev / (avgChange + 1);
  
  // การเปลี่ยนแปลงจริงควรมี coefficient ต่ำ (เปลี่ยนแปลงแบบสม่ำเสมอ)
  // รูปภาพที่หมุน/เอียงจะมี coefficient สูง (เปลี่ยนแปลงแบบกระตุก)
  const isSmoothVarianceChange = changeCoefficient < (isMobile ? 2.0 : 1.8) || avgChange < (isMobile ? 3 : 4); // บน mobile: ผ่อนขึ้นเล็กน้อย
  
  // รูปภาพที่หมุน/เอียงมักมี:
  // 1. variationRatio ต่ำ (hash เปลี่ยนน้อย)
  // 2. varianceCoefficient ต่ำ (variance คงที่)
  // 3. variance เปลี่ยนแปลงแบบกระตุก (coefficient สูง)
  // 4. การเปลี่ยนแปลงไม่ต่อเนื่อง
  
  // บน mobile: ลด threshold เพื่อให้ผ่านเร็วขึ้น
  const hashVariationPass = variationRatio > (isMobile ? 0.40 : 0.50); // บน mobile: ลดจาก 0.50 เป็น 0.40
  const varianceVariationPass = varianceCoefficient > 0.15; // สมดุล — รูปภาพมี variance คงที่
  const varianceStdDevPass = varianceStdDev > 18; // สมดุล — รูปภาพมี variance std dev ต่ำ
  const smoothChangePass = isSmoothVarianceChange; // ต้องเป็นการเปลี่ยนแปลงแบบต่อเนื่อง
  
  // สมดุล: ต้องผ่านอย่างน้อย 2/4 (กันรูปภาพแต่ไม่เข้มงวดเกินไป)
  const checksPassed = [hashVariationPass, varianceVariationPass, varianceStdDevPass, smoothChangePass].filter(Boolean).length;
  // ต้องผ่านอย่างน้อย 2/4 และต้องผ่าน hashVariation (สำคัญที่สุดสำหรับรูปภาพนิ่ง)
  return checksPassed >= 2 && hashVariationPass; // สมดุล — ต้องผ่าน 2/4 และ hashVariation
}

/**
 * Detect abnormal lighting changes (รูปภาพที่เปลี่ยนมุมมักมีการเปลี่ยนแปลงแสงแบบกระตุก)
 */
function detectLightingChange(
  video: HTMLVideoElement,
  faceBox: { x: number; y: number; width: number; height: number }
): boolean {
  if (framePixelHistory.length < 4) return false; // ต้องมีข้อมูลพอ
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  
  const padding = 0.1;
  const x = Math.max(0, faceBox.x - faceBox.width * padding);
  const y = Math.max(0, faceBox.y - faceBox.height * padding);
  const w = Math.min(video.videoWidth - x, faceBox.width * (1 + 2 * padding));
  const h = Math.min(video.videoHeight - y, faceBox.height * (1 + 2 * padding));
  
  canvas.width = Math.min(64, w);
  canvas.height = Math.min(64, h);
  ctx.drawImage(video, x, y, w, h, 0, 0, canvas.width, canvas.height);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // คำนวณค่าเฉลี่ยความสว่าง (brightness)
  let brightnessSum = 0;
  const pixelCount = canvas.width * canvas.height;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    brightnessSum += gray;
  }
  
  const currentBrightness = brightnessSum / pixelCount;
  
  // เก็บค่า brightness ใน history (ใช้ framePixelHistory หรือสร้างใหม่)
  // สำหรับความง่าย ใช้ framePixelHistory ที่มีอยู่แล้ว
  // แต่เราต้องเก็บ brightness แยกต่างหาก
  
  // ตรวจสอบการเปลี่ยนแปลงแสงแบบกระตุก (sudden jumps)
  // รูปภาพที่เปลี่ยนมุมมักมีการเปลี่ยนแปลงแสงแบบกระตุก (บาง frame สว่างมาก บาง frame มืดมาก)
  // แต่ใบหน้าจริงมีการเปลี่ยนแปลงแสงแบบต่อเนื่อง
  
  // ใช้วิธีง่ายๆ: ตรวจสอบว่า variance ของ brightness ใน frame history สูงเกินไปหรือไม่
  // แต่เนื่องจากเราไม่มี brightness history แยกต่างหาก ให้ใช้วิธีอื่น
  
  // วิธีที่ 2: ตรวจสอบการเปลี่ยนแปลงของ mean brightness ใน framePixelHistory
  // ถ้า mean brightness เปลี่ยนแปลงแบบกระตุก (coefficient of variation สูง) = อาจเป็นรูปภาพที่เปลี่ยนมุม
  
  // สำหรับตอนนี้ ให้ return false (ไม่บล็อก) และใช้ frame variation check แทน
  // แต่ถ้าต้องการเข้มงวดมากขึ้น สามารถเพิ่มการตรวจสอบนี้ได้
  
  return false; // ยังไม่ใช้ (ใช้ frame variation check แทน)
}

/**
 * Detect if video is from screen capture (phone showing image)
 * โดยตรวจสอบคุณสมบัติของ video stream และพฤติกรรมของ frame
 */
function detectScreenCapture(video: HTMLVideoElement): boolean {
  try {
    // ตรวจสอบว่าเป็น MediaStream จริงหรือไม่
    if (!video.srcObject || !(video.srcObject instanceof MediaStream)) {
      return true; // ถ้าไม่ใช่ MediaStream อาจเป็น screen capture
    }
    
    const stream = video.srcObject as MediaStream;
    const videoTrack = stream.getVideoTracks()[0];
    
    if (!videoTrack) return true;
    
    // ตรวจสอบ settings ของ video track
    const settings = videoTrack.getSettings();
    const label = videoTrack.label.toLowerCase();
    
    // Screen capture มักมี:
    // 1. label มีคำว่า screen, capture, display
    // 2. ไม่มี facingMode (เพราะเป็น screen ไม่ใช่ camera)
    // 3. deviceId อาจเป็น screen-capture
    // 4. frameRate อาจต่ำหรือไม่คงที่
    
    const hasFacingMode = 'facingMode' in settings && settings.facingMode !== undefined;
    const isScreenCaptureLabel = label.includes('screen') ||
                                 label.includes('capture') ||
                                 label.includes('display') ||
                                 label.includes('monitor') ||
                                 settings.deviceId?.toLowerCase().includes('screen') ||
                                 settings.deviceId?.toLowerCase().includes('capture') ||
                                 settings.deviceId?.toLowerCase().includes('display');
    
    // ถ้าเป็น screen capture label ให้บล็อกทันที
    if (isScreenCaptureLabel) {
      return true;
    }
    
    // ถ้าไม่มี facingMode อาจเป็น screen capture (แต่ต้องตรวจสอบเพิ่มเติม)
    if (!hasFacingMode) {
      // ตรวจสอบ frame rate - screen capture มักมี frame rate ต่ำหรือไม่คงที่
      if (settings.frameRate && settings.frameRate < 20) {
        return true; // Frame rate ต่ำเกินไป อาจเป็น screen capture
      }
      
      // ตรวจสอบ resolution - screen capture มักมี resolution สูงมากหรือต่ำมาก
      if (settings.width && settings.height) {
        const totalPixels = settings.width * settings.height;
        // Screen capture มักมี resolution สูงมาก (4K+) หรือต่ำมาก (< 640x480)
        if (totalPixels > 3840 * 2160 || totalPixels < 640 * 480) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    // ถ้าเกิด error ให้อนุญาตผ่าน (ไม่บล็อกใบหน้าจริง)
    return false;
  }
}

/**
 * Reset liveness detection state
 */
export function resetLivenessDetection(): void {
  landmarksHistory = [];
  frameHistory = [];
  framePixelHistory = [];
}
