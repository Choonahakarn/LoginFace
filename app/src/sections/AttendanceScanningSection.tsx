import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClassRoom } from '@/hooks/useClassRoom';
import { useStudents } from '@/hooks/useStudents';
import { useAttendance } from '@/hooks/useAttendance';
import { loadMediaPipeFaceDetector, detectFaceFromVideo, isMediaPipeLoaded } from '@/lib/mediapipeApi';
import { captureFrameAsBase64, captureFaceCropAsBase64 } from '@/lib/captureFrame';
import { useBackendFace } from '@/hooks/useBackendFace';
import { detectLiveness, isFaceLandmarkerLoaded, loadFaceLandmarker, resetLivenessDetection } from '@/lib/livenessDetection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Camera, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  GraduationCap,
  Users,
  Clock,
  RotateCcw,
  Maximize2,
  Minimize2,
  UserX,
  FlipHorizontal,
  User,
  LogOut
} from 'lucide-react';

interface AttendanceScanningSectionProps {
  onBack: () => void;
}

export function AttendanceScanningSection({ onBack }: AttendanceScanningSectionProps) {
  const { authUser, signOut } = useAuth();
  const { selectedClassId, selectedClass, classrooms } = useClassRoom();
  
  // Get classroom name directly from classrooms array to avoid showing placeholder
  const currentClassroom = selectedClassId ? classrooms.find(c => c.id === selectedClassId) : null;
  const displayClassName = currentClassroom?.name || selectedClass?.name || '';
  const { getStudentsByClass } = useStudents();
  const { recordAttendance, getTodayAttendance, getStudentStatusToday, getStudentStatusTodaySync, clearTodayAttendance } = useAttendance();
  const classId = selectedClassId;
  const lateGraceMinutes = selectedClass?.lateGraceMinutes ?? 15;
  
  if (!classId) {
    return (
      <div className="p-4">
        <Alert>
          <AlertDescription>กรุณาเลือกห้องเรียนก่อน</AlertDescription>
        </Alert>
        <Button onClick={onBack} className="mt-4">กลับ</Button>
      </div>
    );
  }
  
  // ตรวจสอบว่าเป็น mobile device หรือ tablet (รวม iPad)
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  useEffect(() => {
    const checkMobileDevice = () => {
      // ตรวจสอบ touch device หรือ screen width <= 1024px (ครอบคลุม iPad)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 1024;
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileDevice(isTouchDevice && (isSmallScreen || isMobileUserAgent));
    };
    checkMobileDevice();
    window.addEventListener('resize', checkMobileDevice);
    return () => window.removeEventListener('resize', checkMobileDevice);
  }, []);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    studentName: string;
    status: string;
    similarity: number;
    alreadyRecorded?: boolean;
  } | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [faceBoxLabel, setFaceBoxLabel] = useState<{ isUnknown: boolean; similarity: number; hint?: string } | null>(null);
  const [livenessStatus, setLivenessStatus] = useState<{
    blink: boolean;
    headMovement: boolean;
    texture: boolean;
    confidence: number;
  } | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user'); // 'user' = กล้องหน้า, 'environment' = กล้องหลัง
  /** Reuse face box เพื่อ skip detector บางเฟรม — เพิ่มความเร็ว */
  const lastFaceBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const detectorFrameCountRef = useRef<number>(0);
  const isMobile = isMobileDevice || window.innerWidth <= 768;
  const SCAN_INTERVAL_MS = isMobile ? 3 : 5;  // บน mobile: ลดเป็น 3ms เพื่อสแกนถี่มากมาก (เร็วมากมาก)
  const SCAN_COOLDOWN_MS = isMobile ? 5 : 10; // บน mobile: ลดเป็น 5ms
  const DETECTOR_SKIP_FRAMES = isMobile ? 0 : 1; // บน mobile: รัน detector ทุกเฟรม (0 = ไม่ skip), desktop: ทุก 2 เฟรม
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanInProgressRef = useRef(false);
  const recentScansRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  // Multi-frame verification: เก็บผลการจดจำหลายครั้งก่อนยืนยัน
  const recognitionHistoryRef = useRef<Array<{ studentId: string; similarity: number; timestamp: number }>>([]);
  const REQUIRED_CONSISTENT_MATCHES = 1; // จดจำได้ 1 ครั้งก็ผ่าน — เพิ่มความเร็ว
  const VERIFICATION_WINDOW_MS = isMobile ? 150 : 300; // บน mobile: ลดเป็น 150ms เพื่อความเร็วมาก
  // Debouncing สำหรับ error message — ป้องกันข้อความเด้งรัวๆ
  const lastErrorRef = useRef<string | null>(null);
  const errorDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ERROR_DEBOUNCE_MS = 300; // รอ 300ms ก่อนแสดง error ใหม่ (ป้องกันเด้งรัว)
  /** เก็บเวลาที่กด "เริ่มสแกน" — ภายใน X นาที = เข้าเรียนแล้ว เกิน X นาที = มาสาย (ตั้งค่าได้ต่อห้อง) */
  const scanStartTimeRef = useRef<number | null>(null);
  const faceCropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** เก็บใบหน้า "ฐาน" เมื่อแรกเห็น — เปรียบเทียบกับใบหน้าปัจจุบัน (กันรูปนิ่ง) */
  const baselineFaceCropRef = useRef<ImageData | null>(null);
  const baselineFaceCropTimeRef = useRef<number>(0);
  /** ตำแหน่งกรอบใบหน้าเมื่อเก็บ ref — ใช้ crop ที่ตำแหน่งเดิมเสมอ */
  const refFaceBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  /** ผ่าน liveness (กรอบคงที่ + การเปลี่ยนพอ) เมื่อไหร่ — ภายใน 3 วินาที อนุญาตให้เช็คชื่อได้ */
  const livenessPassedAtRef = useRef<number>(0);
  /** กัน popup ซ้อน — ห้ามแสดง popup ใหม่ภายใน 2 วินาทีหลังปิด */
  const lastPopupClosedAtRef = useRef<number>(0);
  /** เมื่อแสดง "เช็คชื่อไปแล้ว" เก็บ studentId — ป้องกัน popup เขียว overwrite ใน 3 วินาที */
  const lastAlreadyRecordedRef = useRef<{ studentId: string; at: number } | null>(null);
  /** mirror ของ lastResult — ใช้เช็คว่าตอนนี้กำลังแสดง popup สีส้มอยู่หรือไม่ ห้าม overwrite เป็นเขียว */
  const lastResultRef = useRef<{ studentName: string; status: string; similarity: number; alreadyRecorded?: boolean } | null>(null);
  /** เก็บสีล่าสุดก่อนปิด — ตอน lastResult=null (ระหว่างปิด) ไม่ให้ fallback เป็นสีเขียว */
  const lastDisplayedStyleRef = useRef<'amber' | 'yellow' | 'green'>('amber');

  const [enrolledIdsFromBackend, setEnrolledIdsFromBackend] = useState<string[]>([]);
  const backendFace = useBackendFace();
  const { getEnrolledStudentIdsAsync } = backendFace;
  const classStudents = getStudentsByClass(classId);
  const enrolledStudents = classStudents.filter((s) => enrolledIdsFromBackend.includes(s.id));
  useEffect(() => {
    getEnrolledStudentIdsAsync(classId).then(setEnrolledIdsFromBackend);
  }, [classId, getEnrolledStudentIdsAsync]);
  const todayAttendance = getTodayAttendance(classId);
  const attendedTodayIds = new Set(
    todayAttendance.filter(a => a.status === 'present' || a.status === 'late').map(a => a.studentId)
  );
  const hasStartedAttendanceToday = todayAttendance.length > 0;
  const absentStudents = hasStartedAttendanceToday
    ? enrolledStudents.filter(s => !attendedTodayIds.has(s.id))
    : [];

  // ตรวจสอบว่า video stream มาจากกล้องจริง (ไม่ใช่ไฟล์)
  const isRealCameraStream = useCallback((video: HTMLVideoElement): boolean => {
    if (!video.srcObject) return false;
    // MediaStream มาจาก getUserMedia (กล้องจริง)
    // MediaSource/Blob URL มาจากไฟล์ (ต้องบล็อก)
    return video.srcObject instanceof MediaStream;
  }, []);

  /**
   * กันรูปภาพ: เมื่อกรอบใบหน้าคงที่ครบเวลาที่กำหนด ต้องมี pixel เปลี่ยนอย่างน้อย minChangeToAllow% ถึงจะผ่าน
   * หน้าจริงมีการเปลี่ยน (แสง/สี/การขยับ) รูปนิ่งบนจอมักเปลี่ยนน้อยกว่า
   * คืนค่า true = อนุญาต, false = บล็อก (น่าจะเป็นรูปนิ่ง)
   */
  const checkNotObviouslyStaticPhoto = useCallback((
    video: HTMLVideoElement,
    faceBox: { x: number; y: number; width: number; height: number },
    skipMinSec = false  // true เมื่อเรียกหลัง Liveness — ไม่รอเวลา เพื่อให้เข้า 1–2 วิ
  ): boolean => {
    if (!faceCropCanvasRef.current) {
      faceCropCanvasRef.current = document.createElement('canvas');
    }
    const canvas = faceCropCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return true;

    const now = Date.now();
    const size = 64;
    const pad = 0.1;
    // หลัง Liveness (skipMinSec): ไม่บังคับกรอบนิ่ง — ตรวจแค่ pixel เปลี่ยน (กันติด loop ไม่ผ่าน static)
    const stabilityPx = skipMinSec ? 9999 : 44;
    const stabilitySizeRatio = skipMinSec ? 1 : 0.22;
    // หลัง Liveness: เข้มงวดขึ้นเพื่อกันรูปภาพ — แต่ยังเร็วพอ
    const minChangeToAllow = skipMinSec ? 1.2 : 3;  // หลัง Liveness: 1.2% (เข้มงวดขึ้น)
    const threshold = skipMinSec ? 3 : 6;  // หลัง Liveness: threshold เพิ่มขึ้น (เข้มงวดขึ้น)
    const minSecToDecide = skipMinSec ? 0 : 0.04;  // หลัง Liveness ไม่รอเวลา

    const boxToRect = (box: { x: number; y: number; width: number; height: number }) => {
      const x = Math.max(0, box.x - box.width * pad);
      const y = Math.max(0, box.y - box.height * pad);
      const w = Math.min(video.videoWidth - x, box.width * (1 + 2 * pad));
      const h = Math.min(video.videoHeight - y, box.height * (1 + 2 * pad));
      return { x, y, w, h };
    };

    const cropAtBox = (box: { x: number; y: number; width: number; height: number }): ImageData | null => {
      const { x, y, w, h } = boxToRect(box);
      if (w <= 0 || h <= 0) return null;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(video, x, y, w, h, 0, 0, size, size);
      return ctx.getImageData(0, 0, size, size);
    };

    if (!refFaceBoxRef.current) {
      refFaceBoxRef.current = { ...faceBox };
      const crop = cropAtBox(refFaceBoxRef.current);
      if (!crop) return false;
      baselineFaceCropRef.current = crop;
      baselineFaceCropTimeRef.current = now;
      return false; // ยังไม่ตัดสิน — ต้องรอกรอบคงที่ + การเปลี่ยนพอก่อน
    }

    const ref = refFaceBoxRef.current;
    const cx = faceBox.x + faceBox.width / 2;
    const cy = faceBox.y + faceBox.height / 2;
    const refCx = ref.x + ref.width / 2;
    const refCy = ref.y + ref.height / 2;
    const dist = Math.sqrt((cx - refCx) ** 2 + (cy - refCy) ** 2);
    const sizeChange = Math.max(
      Math.abs(faceBox.width - ref.width) / ref.width,
      Math.abs(faceBox.height - ref.height) / ref.height
    );
    const isStable = dist <= stabilityPx && sizeChange <= stabilitySizeRatio;

    if (!isStable) {
      if (baselineFaceCropRef.current && (now - baselineFaceCropTimeRef.current) / 1000 > 2) {
        refFaceBoxRef.current = null;
        baselineFaceCropRef.current = null;
        baselineFaceCropTimeRef.current = 0;
      }
      // อนุญาตเฉพาะถ้าเคยผ่าน liveness ใน 1.5 วินาทีที่แล้ว (กันการขยับรูปให้ผ่าน)
      if (livenessPassedAtRef.current && now - livenessPassedAtRef.current < 1500) return true;
      return false;
    }

    const currentCrop = cropAtBox(refFaceBoxRef.current);
    if (!currentCrop || !baselineFaceCropRef.current) return true;

    // หลัง Liveness: ยังต้องเช็ค pixel change (กันรูปภาพ) แต่ผ่อนเกณฑ์
    // ไม่ให้ผ่านทันที — ต้องมี pixel เปลี่ยนจริง

    const secSinceRef = (now - baselineFaceCropTimeRef.current) / 1000;
    if (secSinceRef < minSecToDecide) return false; // ยังดูไม่นาน — ยังไม่ผ่าน

    const base = baselineFaceCropRef.current;
    let diffPixels = 0;
    const quadrantPixels = (size / 2) * (size / 2);
    const quadDiff = [0, 0, 0, 0];
    for (let i = 0; i < currentCrop.data.length; i += 4) {
      const rDiff = Math.abs(currentCrop.data[i] - base.data[i]);
      const gDiff = Math.abs(currentCrop.data[i + 1] - base.data[i + 1]);
      const bDiff = Math.abs(currentCrop.data[i + 2] - base.data[i + 2]);
      const avgDiff = (rDiff + gDiff + bDiff) / 3;
      if (avgDiff > threshold) {
        diffPixels++;
        const px = (i / 4) % size;
        const py = Math.floor((i / 4) / size);
        const q = (py < size / 2 ? 0 : 2) + (px < size / 2 ? 0 : 1);
        quadDiff[q]++;
      }
    }
    const totalPixels = size * size;
    const changePercent = (diffPixels / totalPixels) * 100;

    // ต้องมีการเปลี่ยนอย่างน้อย minChangeToAllow%
    if (changePercent < minChangeToAllow) {
      refFaceBoxRef.current = null;
      baselineFaceCropRef.current = null;
      baselineFaceCropTimeRef.current = 0;
      return false; // เปลี่ยนน้อยเกินไป — น่าจะเป็นรูปภาพนิ่ง
    }

    // หลัง Liveness: ไม่บังคับ quadrant — เร็วขึ้น (แต่ยังกันรูปภาพด้วย minChangeToAllow)
    const minQuads = skipMinSec ? 0 : 2;  // หลัง Liveness: ไม่บังคับ quadrant (เร็วขึ้น)
    const quadsWithChange = quadDiff.filter(q => q > quadrantPixels * 0.01).length;
    if (!skipMinSec && quadsWithChange < minQuads) {
      refFaceBoxRef.current = null;
      baselineFaceCropRef.current = null;
      baselineFaceCropTimeRef.current = 0;
      return false; // เปลี่ยนไม่กระจาย — น่าจะเป็นจอ/แสงสะท้อน
    }

    livenessPassedAtRef.current = now; // ผ่าน liveness — อนุญาตให้เช็คชื่อได้ (ใช้ได้ 1.5 วินาที)
    return true;
  }, []);

  const startCamera = useCallback(async (facing?: 'user' | 'environment') => {
    const facingModeToUse = facing ?? facingMode;
    try {
      setError(null);
      baselineFaceCropRef.current = null;
      baselineFaceCropTimeRef.current = 0;
      refFaceBoxRef.current = null;
      livenessPassedAtRef.current = 0;
      lastFaceBoxRef.current = null;
      detectorFrameCountRef.current = 0;
      
      // ปิด stream เดิมก่อน (ถ้ามี)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (!isMediaPipeLoaded()) {
        setIsModelsLoading(true);
        await loadMediaPipeFaceDetector();
        setIsModelsLoading(false);
      }
      // Load face landmarker for liveness detection
      try {
        setIsModelsLoading(true);
        await loadFaceLandmarker();
        resetLivenessDetection();
        setIsModelsLoading(false);
      } catch (err) {
        console.warn('Failed to load face landmarker:', err);
        // Continue without advanced liveness detection
      }
      // ปรับ resolution ตาม device: mobile ใช้ 640x480 (เร็วและพอใช้), desktop ใช้ 1280x720
      const isMobile = isMobileDevice || window.innerWidth <= 768;
      const videoConstraints = isMobile
        ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: facingModeToUse } // Mobile: ใช้ 640x480 เพื่อความเร็วและบางครั้ง landmarker ทำงานได้ดีกว่าด้วย resolution ต่ำกว่า
        : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingModeToUse };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
      streamRef.current = stream;
      setFacingMode(facingModeToUse);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // บน mobile: รอให้ video พร้อมก่อนตั้ง isCameraActive
        const isMobile = isMobileDevice || window.innerWidth <= 768;
        if (isMobile) {
          // รอให้ video element พร้อม (loadedmetadata event)
          await new Promise<void>((resolve) => {
            const video = videoRef.current!;
            const onLoadedMetadata = () => {
              video.removeEventListener('loadedmetadata', onLoadedMetadata);
              // รอเพิ่มอีก 500ms เพื่อให้ video stream พร้อมจริงๆ (เพิ่มจาก 200ms)
              setTimeout(() => {
                console.log('[startCamera] Mobile: Video ready', {
                  videoSize: `${video.videoWidth}x${video.videoHeight}`,
                  readyState: video.readyState,
                  facingMode: facingModeToUse
                });
                setIsCameraActive(true);
                resolve();
              }, 500);
            };
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            // Timeout fallback (ถ้า event ไม่เกิด) - เพิ่มเป็น 3000ms
            setTimeout(() => {
              video.removeEventListener('loadedmetadata', onLoadedMetadata);
              console.log('[startCamera] Mobile: Video ready (timeout fallback)', {
                videoSize: `${video.videoWidth}x${video.videoHeight}`,
                readyState: video.readyState,
                facingMode: facingModeToUse
              });
              setIsCameraActive(true);
              resolve();
            }, 3000);
          });
        } else {
          setIsCameraActive(true);
        }
      }
    } catch (err) {
      setIsModelsLoading(false);
      setError(err instanceof Error ? err.message : 'ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง');
    }
  }, [facingMode, isMobileDevice]);
  
  const handleStartCamera = useCallback(() => {
    startCamera();
  }, [startCamera]);
  
  const switchCamera = useCallback(async () => {
    if (!isCameraActive) return;
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newFacingMode);
  }, [isCameraActive, facingMode, startCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
      setFaceBox(null);
      setFaceBoxLabel(null);
      setLivenessStatus(null);
      recognitionHistoryRef.current = []; // ล้าง recognition history
      baselineFaceCropRef.current = null;
      baselineFaceCropTimeRef.current = 0;
      refFaceBoxRef.current = null;
      livenessPassedAtRef.current = 0;
      lastFaceBoxRef.current = null;
      detectorFrameCountRef.current = 0;
      // Clear error debounce timer
      if (errorDebounceTimerRef.current) {
        clearTimeout(errorDebounceTimerRef.current);
        errorDebounceTimerRef.current = null;
      }
      lastErrorRef.current = null;
    // Reset liveness detection (async without blocking)
    import('../lib/livenessDetection')
      .then(({ resetLivenessDetection }) => {
        resetLivenessDetection();
      })
      .catch(() => {
        // Ignore errors
      });
  }, []);

  const stopScanningInterval = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const performScan = useCallback(async () => {
    const isMobile = isMobileDevice || window.innerWidth <= 768;
    
    // Debug logging บน mobile
    if (isMobile && Math.random() < 0.01) { // ~1% chance = ~ทุก 100 calls
      console.log('[performScan] Mobile: Called', {
        isCameraActive,
        scanCooldown,
        hasVideo: !!videoRef.current,
        scanInProgress: scanInProgressRef.current,
        videoReadyState: videoRef.current?.readyState,
        videoSize: videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : 'N/A'
      });
    }
    
    if (!isCameraActive || scanCooldown || !videoRef.current || scanInProgressRef.current) {
      if (isMobile && Math.random() < 0.05) { // ~5% chance
        console.warn('[performScan] Mobile: Early return', {
          isCameraActive,
          scanCooldown,
          hasVideo: !!videoRef.current,
          scanInProgress: scanInProgressRef.current
        });
      }
      return;
    }
    scanInProgressRef.current = true;

    try {
      const video = videoRef.current;

      // ตรวจสอบว่า stream มาจากกล้องจริง (ไม่ใช่ไฟล์) - เข้มงวดมาก
      if (!isRealCameraStream(video)) {
        setError('❌ กรุณาใช้กล้องจริงเท่านั้น ไม่สามารถใช้รูปภาพหรือวิดีโอไฟล์ได้');
        setFaceBox(null);
        setFaceBoxLabel(null);
        scanInProgressRef.current = false;
        return;
      }
      
      // ตรวจสอบเพิ่มเติม: ตรวจสอบว่าเป็น screen capture หรือไม่ - ปรับให้ไม่บล็อก mobile ที่ถูกต้อง
      try {
        const stream = video.srcObject as MediaStream;
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const label = videoTrack.label.toLowerCase();
            const settings = videoTrack.getSettings();
            const isMobile = isMobileDevice || window.innerWidth <= 768;
            
            // บน mobile: ตรวจสอบเบาลง (เพราะบางครั้ง facingMode อาจไม่มีหรือ frameRate อาจต่ำ)
            // บน desktop: ตรวจสอบเข้มงวดตามเดิม
            let isScreenCapture = false;
            
            if (isMobile) {
              // บน mobile: ตรวจสอบเฉพาะ label และ deviceId เท่านั้น (ไม่ตรวจ frameRate)
              isScreenCapture = Boolean(
                label.includes('screen') ||
                label.includes('capture') ||
                label.includes('display') ||
                label.includes('monitor') ||
                settings.deviceId?.toLowerCase().includes('screen') ||
                settings.deviceId?.toLowerCase().includes('capture')
              );
            } else {
              // บน desktop: ตรวจสอบเข้มงวดตามเดิม
              isScreenCapture = Boolean(
                label.includes('screen') ||
                label.includes('capture') ||
                label.includes('display') ||
                label.includes('monitor') ||
                settings.deviceId?.toLowerCase().includes('screen') ||
                settings.deviceId?.toLowerCase().includes('capture') ||
                (!('facingMode' in settings) && settings.frameRate != null && settings.frameRate < 20)
              );
            }
            
            if (isScreenCapture) {
              const errorMsg = isMobile 
                ? '❌ ตรวจพบ Screen Capture กรุณาใช้กล้องจริงเท่านั้น'
                : '❌ ตรวจพบ Screen Capture กรุณาใช้กล้องจริงเท่านั้น ไม่สามารถใช้รูปภาพในโทรศัพท์ได้';
              setError(errorMsg);
              setFaceBox(null);
              setFaceBoxLabel(null);
              scanInProgressRef.current = false;
              if (isMobile) {
                console.warn('[performScan] Mobile: Screen capture detected', {
                  label,
                  deviceId: settings.deviceId,
                  facingMode: settings.facingMode,
                  frameRate: settings.frameRate
                });
              }
              return;
            }
          }
        }
      } catch (err) {
        // บน mobile: ไม่บล็อกถ้าเกิด error (อาจเป็นเพราะ browser ไม่รองรับบาง API)
        const isMobile = isMobileDevice || window.innerWidth <= 768;
        if (isMobile) {
          console.warn('[performScan] Mobile: Screen capture detection error (continuing):', err);
        } else {
          console.warn('Screen capture detection error:', err);
        }
        // ไม่ return - ให้ผ่านไปต่อ
      }

      const ts = performance.now();
      // Skip detector บางเฟรม — ใช้ face box จากเฟรมก่อนหน้าเพื่อเพิ่มความเร็ว
      detectorFrameCountRef.current++;
      let detection: { box: { x: number; y: number; width: number; height: number } } | null = null;
      
      if (detectorFrameCountRef.current % (DETECTOR_SKIP_FRAMES + 1) === 0) {
        // รัน detector เฉพาะบางเฟรม
        detection = await detectFaceFromVideo(video, ts);
        if (detection) {
          lastFaceBoxRef.current = detection.box;
          // Debug logging บน mobile
          const isMobile = isMobileDevice || window.innerWidth <= 768;
          if (isMobile) {
            console.log('[performScan] Mobile: Face detected', {
              box: detection.box,
              videoSize: `${video.videoWidth}x${video.videoHeight}`,
              readyState: video.readyState
            });
          }
        } else {
          lastFaceBoxRef.current = null;
          // Debug logging บน mobile เมื่อไม่พบใบหน้า
          const isMobile = isMobileDevice || window.innerWidth <= 768;
          if (isMobile && detectorFrameCountRef.current % 30 === 0) { // Log ทุก 30 เฟรม
            console.warn('[performScan] Mobile: No face detected', {
              videoSize: `${video.videoWidth}x${video.videoHeight}`,
              readyState: video.readyState
            });
          }
        }
      } else {
        // ใช้ face box จากเฟรมก่อนหน้า
        if (lastFaceBoxRef.current) {
          detection = { box: lastFaceBoxRef.current };
        } else {
          // ถ้าไม่มี box เก่า ให้รัน detector ทันที
          detection = await detectFaceFromVideo(video, ts);
          if (detection) {
            lastFaceBoxRef.current = detection.box;
          }
        }
      }
      
      if (!detection) {
        setFaceBox(null);
        setFaceBoxLabel(null);
        lastFaceBoxRef.current = null;
        return;
      }

      const scanStart = scanStartTimeRef.current ?? 0;
      const elapsedSec = (Date.now() - scanStart) / 1000;

      if (elapsedSec < 0.005) {
        setFaceBox(detection.box);
        setFaceBoxLabel({ isUnknown: true, similarity: 0, hint: 'กระพริบตา' });
        return;
      }

      // รัน Liveness ก่อน (สะสม 4 เฟรม + กระพริบ) — ไม่รอ static ก่อน เพื่อให้ความเร็วสม่ำเสมอ
      // ตรวจ "รูปภาพนิ่ง" หลังผ่าน Liveness แล้ว (ครั้งเดียวก่อนส่ง API)
      // ==========================================
      // 3D Liveness Detection - สำหรับการเช็คชื่อเท่านั้น
      // บังคับให้ใช้ใบหน้า 3D จริงเท่านั้น (ไม่สามารถใช้รูปภาพ 2D ได้)
      // ==========================================
      let livenessResult: any = null;
      let livenessErrorOccurred = false;
      
      try {
        // ตรวจสอบว่า Face Landmarker โหลดแล้วหรือยัง
        if (!isFaceLandmarkerLoaded()) {
          // ถ้ายังไม่โหลด ให้ลองโหลดก่อน
          try {
            await loadFaceLandmarker();
          } catch (loadError) {
            console.warn('[3D Liveness] ⚠️ Failed to load Face Landmarker:', loadError);
            // ไม่บล็อก - ให้ผ่านไปทำ recognition ได้ (fallback)
            livenessErrorOccurred = true;
          }
        }
        
        if (!livenessErrorOccurred) {
          const isMobile = isMobileDevice || window.innerWidth <= 768;
          if (isMobile) {
            console.log('[performScan] Mobile: Calling detectLiveness', {
              faceBox: detection.box,
              videoSize: `${video.videoWidth}x${video.videoHeight}`,
              readyState: video.readyState,
              timestamp: ts
            });
          }
          livenessResult = await detectLiveness(video, ts, detection.box);
          if (isMobile) {
            console.log('[performScan] Mobile: detectLiveness result', {
              passed: livenessResult.passed,
              reasons: livenessResult.reasons,
              blinkDetected: livenessResult.blinkDetected,
              headMovementDetected: livenessResult.headMovementDetected,
              textureAnalysisPassed: livenessResult.textureAnalysisPassed
            });
          }
        }
      } catch (livenessError) {
        // ถ้า liveness detection ล้มเหลว ให้แสดง warning แต่ไม่บล็อก (fallback)
        console.error('[3D Liveness] ⚠️ Detection error (fallback to recognition):', livenessError);
        livenessErrorOccurred = true;
        // ไม่บล็อก - ให้ผ่านไปทำ recognition ได้ (fallback mechanism)
        // แต่แสดง warning ใน console
      }
      
      // ถ้ามี liveness result ให้ตรวจสอบ (null = error บน mobile, ให้ข้าม liveness check)
      if (livenessResult === null && (isMobileDevice || window.innerWidth <= 768)) {
        // บน mobile: ถ้าเกิด error ให้ข้าม liveness check และไปทำ recognition เลย (fallback)
        console.warn('[performScan] Mobile: Liveness detection failed, skipping liveness check and proceeding to recognition');
        setError(null); // ล้าง error เพื่อให้ทำ recognition ได้
        setFaceBox(detection.box);
        setFaceBoxLabel({ isUnknown: true, similarity: 0, hint: 'กำลังจดจำ…' });
        // ต่อไปทำ recognition (ไม่ return)
      } else if (livenessResult) {
        // ถ้ายังรอข้อมูล ให้แสดงสถานะและรอต่อ (บล็อกการทำ recognition)
        if (!livenessResult.passed && livenessResult.reasons.some((r: string) => r.includes('⏳'))) {
          setLivenessStatus({
            blink: livenessResult.blinkDetected,
            headMovement: livenessResult.headMovementDetected,
            texture: livenessResult.textureAnalysisPassed,
            confidence: livenessResult.confidence,
          });
          const waitingMsg = `⏳ ${livenessResult.reasons.find((r: string) => r.includes('⏳')) || 'กำลังตรวจสอบ...'}`;
          // ไม่ต้อง debounce สำหรับ waiting message (แสดงทันที)
          lastErrorRef.current = waitingMsg;
          setError(waitingMsg);
          setFaceBox(detection.box);
          setFaceBoxLabel({ isUnknown: true, similarity: 0, hint: 'กระพริบตา' });
          scanInProgressRef.current = false;
          return;
        } else if (!livenessResult.passed) {
          // ไม่ผ่านและมีข้อมูลเพียงพอแล้ว - บล็อกทันที (ไม่มีข้อยกเว้น)
          // รูปภาพ 2D ไม่สามารถผ่านได้ - ต้องใช้ใบหน้า 3D จริงเท่านั้น
          const errorMsg = livenessResult.reasons.length > 0 
            ? `❌ 3D Liveness ไม่ผ่าน: ${livenessResult.reasons.filter((r: string) => !r.includes('⏳')).join('. ')}`
            : '❌ ไม่ผ่านการตรวจสอบ 3D liveness กรุณาใช้ใบหน้าจริงเท่านั้น (ไม่สามารถใช้รูปภาพ 2D ได้)';
          
          // Debounce error message — ป้องกันเด้งรัวๆ
          if (errorDebounceTimerRef.current) {
            clearTimeout(errorDebounceTimerRef.current);
          }
          errorDebounceTimerRef.current = setTimeout(() => {
            // เปลี่ยน error เฉพาะเมื่อข้อความเปลี่ยนจริงๆ
            if (lastErrorRef.current !== errorMsg) {
              lastErrorRef.current = errorMsg;
              setError(errorMsg);
            }
          }, ERROR_DEBOUNCE_MS);
          
          setFaceBox(detection.box);
          setFaceBoxLabel({ isUnknown: true, similarity: 0 });
          scanInProgressRef.current = false;
          return; // บล็อก - ไม่ให้ทำ recognition
        } else {
          // ผ่าน Liveness แล้ว — ตรวจ "รูปภาพนิ่ง" ครั้งเดียว (ไม่รอ minSec) เพื่อให้เข้า 1–2 วิ
          const notStaticPhoto = checkNotObviouslyStaticPhoto(video, detection.box, true);
          if (!notStaticPhoto) {
            const errorMsg = '❌ 3D Liveness ไม่ผ่าน: ❌ ไม่พบการเปลี่ยนแปลงของภาพ (อาจเป็นรูปภาพนิ่ง) กรุณาใช้ใบหน้าจริง';
            
            // Debounce error message — ป้องกันเด้งรัวๆ
            if (errorDebounceTimerRef.current) {
              clearTimeout(errorDebounceTimerRef.current);
            }
            errorDebounceTimerRef.current = setTimeout(() => {
              // เปลี่ยน error เฉพาะเมื่อข้อความเปลี่ยนจริงๆ
              if (lastErrorRef.current !== errorMsg) {
                lastErrorRef.current = errorMsg;
                setError(errorMsg);
              }
            }, ERROR_DEBOUNCE_MS);
            
            setFaceBox(detection.box);
            setFaceBoxLabel({ isUnknown: true, similarity: 0, hint: 'กระพริบตา' });
            scanInProgressRef.current = false;
            return;
          }
          // ผ่านแล้ว - ใบหน้า 3D จริง - แสดง "กำลังจดจำ…" ทันที แล้ว allow recognition
          setLivenessStatus({
            blink: livenessResult.blinkDetected,
            headMovement: livenessResult.headMovementDetected,
            texture: livenessResult.textureAnalysisPassed,
            confidence: livenessResult.confidence,
          });
          // Clear error ทันทีเมื่อผ่าน (ไม่ต้อง debounce)
          if (errorDebounceTimerRef.current) {
            clearTimeout(errorDebounceTimerRef.current);
            errorDebounceTimerRef.current = null;
          }
          lastErrorRef.current = null;
          setError(null);
          setFaceBox(detection.box);
          setFaceBoxLabel({ isUnknown: true, similarity: 0, hint: 'กำลังจดจำ…' });
          console.log('[3D Liveness] ✅ Passed - ใบหน้า 3D จริง:', {
            blink: livenessResult.blinkDetected,
            headMovement: livenessResult.headMovementDetected,
            texture: livenessResult.textureAnalysisPassed,
            confidence: livenessResult.confidence,
          });
        }
      } else if (livenessErrorOccurred) {
        // ถ้า liveness detection ล้มเหลว ให้แสดง warning แต่ไม่บล็อก (fallback)
        console.warn('[3D Liveness] ⚠️ Detection failed, allowing fallback to recognition');
        // ไม่บล็อก - ให้ผ่านไปทำ recognition ได้ (fallback mechanism)
        // แต่แสดง warning ใน console เท่านั้น
        setError(null); // ล้าง error เพื่อให้ทำ recognition ได้
      }

      // แสดงกรอบใบหน้าที่ตรวจพบ
      setFaceBox(detection.box);
      setError(null);

      // บน mobile: ลด quality เป็น 0.5 เพื่อความเร็วมาก, desktop: 0.65
      const imageQuality = isMobile ? 0.5 : 0.65;
      const minSize = isMobile ? 120 : 140;
      let base64 = captureFaceCropAsBase64(video, detection.box, 0.25, imageQuality, minSize);
      if (!base64) {
        base64 = captureFrameAsBase64(video, imageQuality);
      }
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      let match: { student: { id: string; firstName: string; lastName: string }; similarity: number } | null = null;
      if (base64 && classId) {
        try {
          const res = await backendFace.recognize(classId, base64, abortController.signal);
          // Check if request was cancelled
          if (abortController.signal.aborted) {
            return;
          }
          console.log('[Face Recognition] Result:', { matched: res.matched, student_id: res.student_id, similarity: res.similarity });
          if (res.matched && res.student_id) {
            // Multi-frame verification: เพิ่มผลการจดจำเข้า history
            const now = Date.now();
            recognitionHistoryRef.current.push({
              studentId: res.student_id,
              similarity: res.similarity,
              timestamp: now,
            });
            
            // ลบข้อมูลเก่าที่เกิน window
            recognitionHistoryRef.current = recognitionHistoryRef.current.filter(
              r => now - r.timestamp < VERIFICATION_WINDOW_MS
            );
            
            // ตรวจสอบว่ามีการจดจำได้เหมือนกันหลายครั้งหรือไม่
            const sameStudentMatches = recognitionHistoryRef.current.filter(
              r => r.studentId === res.student_id
            );
            
            // บน mobile: ลด threshold เพื่อความเร็วมาก
            const MIN_SIMILARITY_THRESHOLD = isMobile ? 0.60 : 0.65; // บน mobile: ลดเป็น 0.60
            
            // ตรวจสอบว่า similarity สูงพอและจดจำได้เหมือนกันหลายครั้ง
            if (sameStudentMatches.length >= REQUIRED_CONSISTENT_MATCHES && res.similarity >= MIN_SIMILARITY_THRESHOLD) {
              // บน mobile: ถ้า similarity >= 0.70 ผ่านเลย (ไม่ต้องรอหลายครั้ง), desktop: >= 0.75
              const requiredMatches = isMobile 
                ? (res.similarity >= 0.70 ? REQUIRED_CONSISTENT_MATCHES : Math.max(REQUIRED_CONSISTENT_MATCHES, 2))
                : (res.similarity >= 0.75 ? REQUIRED_CONSISTENT_MATCHES : Math.max(REQUIRED_CONSISTENT_MATCHES, 2));
              
              if (sameStudentMatches.length >= requiredMatches) {
                const student = classStudents.find((s) => String(s.id) === String(res.student_id));
                if (student) {
                  match = { student, similarity: res.similarity };
                  // ล้าง history หลังจากยืนยันแล้ว
                  recognitionHistoryRef.current = [];
                }
              } else {
                // ยังไม่ยืนยัน - แสดงสถานะว่ากำลังตรวจสอบ (ต้องจดจำได้หลายครั้ง)
                setFaceBoxLabel({ 
                  isUnknown: false, 
                  similarity: res.similarity,
                  hint: `กำลังยืนยัน... (${sameStudentMatches.length}/${requiredMatches})`
                });
              }
            } else {
              // ยังไม่ยืนยัน - แสดงสถานะว่ากำลังตรวจสอบ
              if (res.similarity < MIN_SIMILARITY_THRESHOLD) {
                setFaceBoxLabel({ 
                  isUnknown: true, 
                  similarity: res.similarity,
                  hint: `ความมั่นใจต่ำ (${Math.round(res.similarity * 100)}%)`
                });
              } else {
                setFaceBoxLabel({ 
                  isUnknown: false, 
                  similarity: res.similarity,
                  hint: `กำลังยืนยัน... (${sameStudentMatches.length}/${REQUIRED_CONSISTENT_MATCHES})`
                });
              }
            }
          } else {
            // ไม่พบ match - ล้าง history
            console.log('[Face Recognition] No match:', { matched: res.matched, student_id: res.student_id, similarity: res.similarity });
            recognitionHistoryRef.current = [];
            setFaceBoxLabel({ isUnknown: true, similarity: res.similarity, hint: res.matched ? 'ไม่พบข้อมูลในระบบ' : `ไม่ตรงกับข้อมูล (${Math.round(res.similarity * 100)}%)` });
          }
        } catch (err) {
          // Ignore abort errors
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          setFaceBoxLabel({ isUnknown: true, similarity: 0 });
        }
      } else {
        setFaceBoxLabel({ isUnknown: true, similarity: 0 });
      }

      if (match) {
        setFaceBoxLabel(null);
        if (recentScansRef.current.has(match.student.id)) return;

        // เพิ่มทันทีเมื่อพบ match เพื่อกัน race — scan อื่นที่เจอคนเดียวกันจะ return ทันที
        recentScansRef.current.add(match.student.id);
        setRecentScans(prev => [...prev, match.student.id]);

        const existingRecord = getStudentStatusTodaySync(match.student.id, classId);

        const popupCooldownMs = 1200;
        if (Date.now() - lastPopupClosedAtRef.current < popupCooldownMs) return;

        if (existingRecord) {
          lastAlreadyRecordedRef.current = { studentId: match.student.id, at: Date.now() };
          const payload = { studentName: `${match.student.firstName} ${match.student.lastName}`, status: existingRecord.status, similarity: match.similarity, alreadyRecorded: true as const };
          lastResultRef.current = payload;
          setLastResult(payload);
          setTimeout(() => {
            recentScansRef.current.delete(match.student.id);
            setRecentScans(prev => prev.filter(id => id !== match.student.id));
          }, 15000);
          setScanCooldown(true);
          setTimeout(() => setScanCooldown(false), SCAN_COOLDOWN_MS);
        } else {
          // double-check จาก localStorage ก่อนบันทึก — กัน stale closure (รอบใหม่ที่นักเรียนเช็คชื่อไปแล้ว)
          const recheck = getStudentStatusTodaySync(match.student.id, classId);
          if (recheck) {
            if (Date.now() - lastPopupClosedAtRef.current < popupCooldownMs) return;
            lastAlreadyRecordedRef.current = { studentId: match.student.id, at: Date.now() };
            const payload = { studentName: `${match.student.firstName} ${match.student.lastName}`, status: recheck.status, similarity: match.similarity, alreadyRecorded: true as const };
            lastResultRef.current = payload;
            setLastResult(payload);
            setTimeout(() => {
              recentScansRef.current.delete(match.student.id);
              setRecentScans(prev => prev.filter(id => id !== match.student.id));
            }, 15000);
            setScanCooldown(true);
            setTimeout(() => setScanCooldown(false), SCAN_COOLDOWN_MS);
            return;
          }

          // เช็คอีกครั้งก่อนบันทึก — กัน race 2 scan พร้อมกัน (อีกอันบันทึกไปแล้ว)
          const finalCheck = getStudentStatusTodaySync(match.student.id, classId);
          if (finalCheck) {
            lastAlreadyRecordedRef.current = { studentId: match.student.id, at: Date.now() };
            const payload = { studentName: `${match.student.firstName} ${match.student.lastName}`, status: finalCheck.status, similarity: match.similarity, alreadyRecorded: true as const };
            lastResultRef.current = payload;
            setLastResult(payload);
            setTimeout(() => {
              recentScansRef.current.delete(match.student.id);
              setRecentScans(prev => prev.filter(id => id !== match.student.id));
            }, 15000);
            setScanCooldown(true);
            setTimeout(() => setScanCooldown(false), SCAN_COOLDOWN_MS);
            return;
          }

          const now = Date.now();
          const start = scanStartTimeRef.current ?? now;
          const elapsedMinutes = (now - start) / (60 * 1000);
          const isLate = elapsedMinutes > lateGraceMinutes;
          const status = isLate ? 'late' : 'present';

          if (Date.now() - lastPopupClosedAtRef.current < popupCooldownMs) return;
          const justShownAlready = lastAlreadyRecordedRef.current?.studentId === match.student.id &&
            Date.now() - lastAlreadyRecordedRef.current.at < 3000;
          if (justShownAlready) return;
          const fullStudent = classStudents.find(s => String(s.id) === String(match!.student.id));
          if (fullStudent) recordAttendance(fullStudent, classId, status, {
            faceRecognized: true,
            matchScore: match.similarity
          });

          // ห้าม overwrite popup สีส้ม "เช็คชื่อไปแล้ว" ด้วยสีเขียว — ตอนปิดจะไม่กลายเป็นสีเขียว
          if (lastAlreadyRecordedRef.current?.studentId === match.student.id) return;
          if (lastResultRef.current?.alreadyRecorded === true) return;
          setLastResult({
            studentName: `${match.student.firstName} ${match.student.lastName}`,
            status,
            similarity: match.similarity,
            alreadyRecorded: false
          });

          setTimeout(() => {
            recentScansRef.current.delete(match.student.id);
            setRecentScans(prev => prev.filter(id => id !== match.student.id));
          }, 8000);

          setScanCooldown(true);
          setTimeout(() => setScanCooldown(false), SCAN_COOLDOWN_MS);
        }
      }
      // เมื่อ match เป็น null จะ setFaceBoxLabel ไว้แล้วในบล็อกด้านบน
    } catch (err) {
      setFaceBox(null);
      setFaceBoxLabel(null);
    } finally {
      scanInProgressRef.current = false;
    }
  }, [isCameraActive, scanCooldown, classStudents, getStudentStatusTodaySync, recordAttendance, isRealCameraStream, checkNotObviouslyStaticPhoto, classId, lateGraceMinutes, isMobileDevice]);

  const clearLastResultPopup = useCallback(() => {
    if (lastResultRef.current) {
      lastDisplayedStyleRef.current = lastResultRef.current.alreadyRecorded
        ? 'amber'
        : lastResultRef.current.status === 'late'
          ? 'yellow'
          : 'green';
    }
    lastPopupClosedAtRef.current = Date.now();
    lastResultRef.current = null;
    setLastResult(null);
  }, []);

  const toggleScanning = useCallback(() => {
    const isMobile = isMobileDevice || window.innerWidth <= 768;
    
    if (isScanning) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      recentScansRef.current.clear();
      setRecentScans([]);
      lastAlreadyRecordedRef.current = null;
      lastResultRef.current = null;
      clearLastResultPopup();
      setScanCooldown(false);
      setIsScanning(false);
      setFaceBox(null);
      setFaceBoxLabel(null);
      setShowAbsentModal(true); // แสดงรายชื่อคนที่ขาดหลังหยุดสแกน
    } else {
      lastPopupClosedAtRef.current = 0;
      scanStartTimeRef.current = Date.now();
      setIsScanning(true);
      
      // Debug logging บน mobile
      if (isMobile) {
        console.log('[toggleScanning] Mobile: Starting scan interval', {
          isCameraActive,
          hasVideo: !!videoRef.current,
          videoReadyState: videoRef.current?.readyState,
          videoSize: videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : 'N/A',
          SCAN_INTERVAL_MS
        });
      }
      
      scanIntervalRef.current = setInterval(() => { performScan(); }, SCAN_INTERVAL_MS); // เร่งสแกนให้ถี่ขึ้น
    }
  }, [isScanning, performScan, clearLastResultPopup, isCameraActive, isMobileDevice]);

  // Sync video stream ไปยัง expanded video element
  // Fullscreen: ฟัง fullscreenchange
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const enterFullscreen = useCallback(() => {
    const el = fullscreenContainerRef.current;
    if (el && !document.fullscreenElement) {
      el.requestFullscreen?.() ?? (el as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.() ?? (document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
    }
  }, []);

  // ฟังก์ชันวาดกรอบบน canvas
  const drawFaceBox = useCallback((
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    box: { x: number; y: number; width: number; height: number } | null,
    label: { isUnknown: boolean; similarity: number; hint?: string } | null
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !video) return;

    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (box && isScanning) {
      // สำหรับ object-cover: วิดีโอจะถูก scale เพื่อเติมพื้นที่ทั้งหมด
      // คำนวณ scale โดยใช้ค่าที่มากกว่าของ scaleX หรือ scaleY
      const videoAspect = video.videoWidth / video.videoHeight;
      const displayAspect = rect.width / rect.height;
      
      let scaleX = 1;
      let scaleY = 1;
      let offsetX = 0;
      let offsetY = 0;

      if (videoAspect > displayAspect) {
        // วิดีโอกว้างกว่า → scale ตามความสูง (อาจตัดซ้าย/ขวา)
        scaleX = scaleY = rect.height / video.videoHeight;
        offsetX = (rect.width - video.videoWidth * scaleX) / 2;
      } else {
        // วิดีโอสูงกว่า → scale ตามความกว้าง (อาจตัดบน/ล่าง)
        scaleX = scaleY = rect.width / video.videoWidth;
        offsetY = (rect.height - video.videoHeight * scaleY) / 2;
      }

      const x = box.x * scaleX + offsetX;
      const y = box.y * scaleY + offsetY;
      const width = box.width * scaleX;
      const height = box.height * scaleY;

      const isUnknown = label?.isUnknown ?? false;
      ctx.strokeStyle = isUnknown ? '#3b82f6' : '#10b981'; // สีน้ำเงินแทนสีแดง
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // วาด label เหนือกรอบ — แสดงเฉพาะ hint (เช่น "กระพริบตา", "กำลังจดจำ…") ไม่แสดง "Unknown"
      if (isUnknown && label?.hint) {
        const text = label.hint;
        ctx.font = 'bold 16px system-ui, sans-serif';
        const textWidth = ctx.measureText(text).width;
        const labelX = x + (width - textWidth) / 2;
        const labelY = y - 6;
        ctx.fillStyle = '#3b82f6'; // สีน้ำเงิน
        ctx.fillRect(labelX - 6, labelY - 16, textWidth + 12, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, labelX, labelY - 2);
      }

      const cornerLength = Math.min(width, height) * 0.15;
      ctx.lineWidth = 4;
      
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLength);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLength, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + width - cornerLength, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerLength);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerLength);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerLength, y + height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + width - cornerLength, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerLength);
      ctx.stroke();
    }
  }, [isScanning]);

  // วาดกรอบสี่เหลี่ยมบนใบหน้าที่ตรวจพบ (main view)
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlayCanvas || !video) return;

    drawFaceBox(overlayCanvas, video, faceBox, faceBoxLabel);
    
    const resizeObserver = new ResizeObserver(() => {
      drawFaceBox(overlayCanvas, video, faceBox, faceBoxLabel);
    });
    resizeObserver.observe(video);

    return () => {
      resizeObserver.disconnect();
    };
  }, [faceBox, faceBoxLabel, isScanning, drawFaceBox]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // sync lastResultRef — ใช้เช็คก่อน overwrite popup สีส้มด้วยสีเขียว
  useEffect(() => {
    lastResultRef.current = lastResult;
  }, [lastResult]);

  // ปิด Popup เช็คชื่ออัตโนมัติ — เช็คชื่อไปแล้ว 0.6 วินาที, มาสาย 0.5 วินาที, กรณีอื่น 0.8 วินาที
  useEffect(() => {
    if (!lastResult) return;
    const ms = lastResult.alreadyRecorded ? 1500 : lastResult.status === 'late' ? 1200 : 2000;
    const t = setTimeout(clearLastResultPopup, ms);
    return () => clearTimeout(t);
  }, [lastResult, clearLastResultPopup]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 min-w-0">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">เช็คชื่อด้วยใบหน้า</h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {displayClassName ? `ห้อง ${displayClassName}` : 'สแกนใบหน้าเพื่อบันทึกการเข้าเรียน'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowResetConfirm(true)} 
                className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs sm:text-sm px-2 sm:px-3 hidden md:flex"
              >
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Reset วันใหม่</span>
              </Button>
              <span className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" aria-hidden />
              <span className="flex items-center gap-1 text-xs sm:text-sm text-gray-700 max-w-[100px] sm:max-w-none">
                <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                <span className="truncate hidden sm:inline">
                  {authUser?.firstName && authUser?.lastName
                    ? `${authUser.firstName} ${authUser.lastName}`
                    : authUser?.firstName || authUser?.email || 'ผู้ใช้'}
                </span>
                <span className="truncate sm:hidden">
                  {authUser?.firstName || authUser?.email?.split('@')[0] || 'ผู้ใช้'}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut().catch(() => {})}
                className="text-gray-600 hover:text-red-600 h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset วันใหม่</AlertDialogTitle>
            <AlertDialogDescription>
              จะลบรายการเช็คชื่อของวันนี้ทั้งหมด คุณสามารถเช็คชื่อวันนี้อีกรอบหรือเริ่มข้อมูลใหม่ได้ ข้อมูลวันอื่นจะไม่ถูกลบ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                clearTodayAttendance(classId);
                recentScansRef.current.clear();
                setRecentScans([]);
                setLastResult(null);
                setShowResetConfirm(false);
              }}
            >
              ยืนยันรีเซ็ต
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Popup เช็คชื่อสำเร็จ - เด้งขึ้นกลางหน้าจอ ชัดเจน ปิดเร็ว */}
      <Dialog open={!!lastResult} onOpenChange={(open) => !open && clearLastResultPopup()}>
        <DialogContent
          showCloseButton={false}
          className="max-w-xl border-0 p-0 overflow-hidden rounded-2xl shadow-2xl ring-4 ring-white/60 animate-in zoom-in-95 duration-200"
        >
          <div
            className={`px-10 py-10 text-center text-white ${
              lastResult
                ? lastResult.alreadyRecorded
                  ? 'bg-gradient-to-br from-amber-500 to-amber-700'
                  : lastResult.status === 'late'
                    ? 'bg-gradient-to-br from-yellow-500 to-amber-600'
                    : 'bg-gradient-to-br from-green-500 to-green-700'
                : lastDisplayedStyleRef.current === 'amber'
                  ? 'bg-gradient-to-br from-amber-500 to-amber-700'
                  : lastDisplayedStyleRef.current === 'yellow'
                    ? 'bg-gradient-to-br from-yellow-500 to-amber-600'
                    : 'bg-gradient-to-br from-green-500 to-green-700'
            }`}
          >
            <div className="flex justify-center mb-5">
              <div className="w-24 h-24 rounded-full bg-white/30 flex items-center justify-center ring-4 ring-white/40">
                <CheckCircle className="w-14 h-14" strokeWidth={2.5} />
              </div>
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-3xl font-extrabold text-white border-0 tracking-tight drop-shadow-sm text-center">
                {lastResult?.studentName}
              </DialogTitle>
            </DialogHeader>
            <p className="text-xl font-semibold mt-3 text-white/95 text-center">
              {lastResult?.alreadyRecorded ? 'เช็คชื่อไปแล้ว' : 'เช็คชื่อสำเร็จ!'}
            </p>
            {!lastResult?.alreadyRecorded && (
              <div
                className={`mt-5 inline-flex items-center rounded-full px-6 py-2.5 text-lg font-bold ${
                  lastResult?.status === 'late' ? 'bg-amber-400/90 text-amber-900' : 'bg-white/30'
                }`}
              >
                {lastResult?.status === 'present' ? 'เข้าเรียนแล้ว' : 'มาสาย'}
              </div>
            )}
          </div>
          <DialogFooter className="p-5 bg-white border-t border-gray-100 flex justify-center sm:justify-center">
            <Button
              onClick={clearLastResultPopup}
              size="lg"
              className="min-w-[160px] text-base font-semibold"
            >
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal รายชื่อนักเรียนที่ไม่ได้เข้าเรียน วันนี้ (หลังกดหยุดสแกน) */}
      <Dialog open={showAbsentModal} onOpenChange={setShowAbsentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-2">
              <UserX className="w-6 h-6 text-amber-600" />
              นักเรียนที่ไม่ได้เข้าเรียน วันนี้
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!hasStartedAttendanceToday ? (
              <p className="text-center text-gray-600 py-4">ยังไม่ได้เริ่มเช็คชื่อวันนี้</p>
            ) : (
              <>
                <p className="text-center text-lg font-semibold text-amber-700">
                  ขาด <span className="text-2xl font-bold">{absentStudents.length}</span> คน
                </p>
                {absentStudents.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto rounded-lg border bg-gray-50 p-3">
                    <ul className="space-y-2">
                      {absentStudents.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm shadow-sm"
                        >
                          <UserX className="w-4 h-4 shrink-0 text-amber-500" />
                          <span className="font-medium">{s.firstName} {s.lastName}</span>
                          <span className="text-gray-500">({s.studentId})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">ทุกคนเข้าเรียนครบแล้ว</p>
                )}
              </>
            )}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowAbsentModal(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 py-6 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:gap-6">
          {/* Camera Section - พื้นที่สแกนกว้างใหญ่แบบเต็มจอ */}
          <div className="lg:col-span-8 min-w-0">
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* Camera Preview - ขยายพื้นที่สแกนให้กว้างใหญ่ (แบบระบบเช็คชื่อด้วยใบหน้า AI) */}
                <div
                  ref={fullscreenContainerRef}
                  className={`relative w-full bg-black rounded-xl overflow-hidden [&:fullscreen]:aspect-auto [&:fullscreen]:min-h-0 [&:fullscreen]:max-h-none [&:fullscreen]:h-full [&:fullscreen]:w-full [&:fullscreen]:rounded-none ${
                    isMobileDevice 
                      ? 'aspect-[9/16] min-h-[300px] max-h-[70vh]' // Mobile: portrait orientation
                      : 'aspect-video min-h-[200px] max-h-[50vh] sm:max-h-[58vh] lg:max-h-[65vh]' // Desktop: landscape
                  }`}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ 
                      transform: facingMode === 'environment' && isMobileDevice ? 'scaleX(-1)' : 'none',
                      WebkitTransform: facingMode === 'environment' && isMobileDevice ? 'scaleX(-1)' : 'none'
                    }}
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ imageRendering: 'pixelated' }}
                  />

                  {/* Cooldown Overlay */}
                  {scanCooldown && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="bg-white rounded-lg px-6 py-4 text-center">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                        <p className="text-sm">รอสักครู่...</p>
                      </div>
                    </div>
                  )}

                  {isModelsLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/70">
                      <RefreshCw className="w-16 h-16 mb-4 animate-spin" />
                      <p className="text-lg">กำลังโหลดโมเดล Deep Learning...</p>
                    </div>
                  )}
                  {!isCameraActive && !isModelsLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <Camera className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg">กดปุ่มด้านล่างเพื่อเปิดกล้อง</p>
                    </div>
                  )}

                  {/* ปุ่มออกจากเต็มจอ - แสดงเมื่ออยู่โหมดเต็มจอ */}
                  {isFullscreen && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white border-0"
                      onClick={exitFullscreen}
                    >
                      <Minimize2 className="w-5 h-5 mr-2" />
                      ออกจากเต็มจอ
                    </Button>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Controls */}
                <div className="space-y-3">
                  <div className="text-center">
                    <p className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-600`}>
                      กำลังสแกนเช็คชื่อวันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {selectedClass && (
                      <p className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-700 font-medium mt-1`}>
                        ห้อง {selectedClass.name}
                      </p>
                    )}
                  </div>
                  <div className={`flex justify-center flex-wrap ${isMobileDevice ? 'gap-2' : 'gap-2 sm:gap-4'}`}>
                  {!isCameraActive ? (
                    <Button onClick={handleStartCamera} size="lg" className="w-full sm:w-auto">
                      <Camera className="w-5 h-5 mr-2" />
                      เปิดกล้อง
                    </Button>
                  ) : (
                    <>
                      <Button 
                        onClick={toggleScanning} 
                        size="lg"
                        className={`w-full sm:w-auto ${isScanning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                      >
                        {isScanning ? (
                          <>
                            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                            หยุดสแกน
                          </>
                        ) : (
                          <>
                            <Camera className="w-5 h-5 mr-2" />
                            เริ่มสแกน
                          </>
                        )}
                      </Button>
                      {isMobileDevice && (
                        <Button 
                          onClick={switchCamera} 
                          variant="outline" 
                          size="lg"
                          disabled={isScanning}
                          className="w-full sm:w-auto border-purple-500 text-purple-700 hover:bg-purple-100 disabled:opacity-50 bg-purple-50"
                          title={facingMode === 'user' ? 'สลับเป็นกล้องหลัง' : 'สลับเป็นกล้องหน้า'}
                        >
                          <FlipHorizontal className="w-5 h-5 mr-2" />
                          {facingMode === 'user' ? 'กล้องหลัง' : 'กล้องหน้า'}
                        </Button>
                      )}
                      <Button 
                        onClick={enterFullscreen} 
                        variant="outline" 
                        size="lg"
                        disabled={!isCameraActive}
                        className="w-full sm:w-auto border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        <Maximize2 className="w-5 h-5 mr-2" />
                        <span className="hidden sm:inline">ขยายเต็มจอ</span>
                        <span className="sm:hidden">เต็มจอ</span>
                      </Button>
                      <Button onClick={stopCamera} variant="outline" size="lg" className="w-full sm:w-auto">
                        ปิดกล้อง
                      </Button>
                    </>
                  )}
                  </div>
                </div>

                {/* Instructions */}
                <div className={`bg-blue-50 rounded-lg ${isMobileDevice ? 'p-3' : 'p-4'}`}>
                  <h4 className={`font-medium text-blue-800 mb-2 ${isMobileDevice ? 'text-sm' : ''}`}>วิธีใช้:</h4>
                  <ol className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-blue-700 space-y-1 list-decimal list-inside`}>
                    <li>เปิดกล้องและกด เริ่มสแกน</li>
                    <li><strong>วางใบหน้าในกรอบ</strong> มองตรงที่กล้อง แล้ว<strong>กระพริบตาหนึ่งครั้ง</strong></li>
                    <li>อยู่ที่แสงสว่างพอ — ถ้าสแกนไม่ติด ลองกระพริบตาอีกครั้ง</li>
                    <li>รอ 1–2 วินาทีก่อนเช็คชื่อคนต่อไป</li>
                  </ol>
                  <p className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-blue-600 mt-2 border-t border-blue-200 pt-2`}>
                    ⏱ นับจากกด &quot;เริ่มสแกน&quot; — ภายใน {lateGraceMinutes} นาที = <strong>เข้าเรียนแล้ว</strong>, เกิน {lateGraceMinutes} นาที = <strong>มาสาย</strong>
                  </p>
                  <p className={`${isMobileDevice ? 'text-xs' : 'text-xs'} text-blue-500 mt-1`}>
                    ระบบจะบล็อกเมื่อตรวจพบรูปภาพนิ่งบนหน้าจอ — แนะนำให้ใช้ในห้องที่ครูดูแล
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  สรุปวันนี้
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {todayAttendance.filter(a => a.status === 'present').length}
                    </p>
                    <p className="text-sm text-green-700">เข้าเรียนแล้ว</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {todayAttendance.filter(a => a.status === 'late').length}
                    </p>
                    <p className="text-sm text-yellow-700">มาสาย</p>
                  </div>
                </div>

                <div className="mt-4 border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">
                    ลงทะเบียนครบ 5 ภาพ (เช็คชื่อได้): {enrolledStudents.length}/{classStudents.length} คน
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${classStudents.length > 0 ? (enrolledStudents.length / classStudents.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Attendance */}
            <Card>
              <CardHeader>
                <CardTitle>รายการล่าสุด</CardTitle>
              </CardHeader>
              <CardContent>
                {todayAttendance.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {todayAttendance.slice(-10).reverse().map((record) => {
                      const timeStr = record.recordedAt
                        ? new Date(record.recordedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '';
                      return (
                        <div 
                          key={record.id} 
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              record.status === 'present' ? 'bg-green-500' :
                              record.status === 'late' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-sm">{record.studentName}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-xs block ${
                              record.status === 'present' ? 'text-green-600' :
                              record.status === 'late' ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {record.status === 'present' ? 'มา' :
                               record.status === 'late' ? 'สาย' : 'ขาด'}
                            </span>
                            {timeStr && <span className="text-xs text-gray-500">{timeStr}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">ยังไม่มีการเช็คชื่อวันนี้</p>
                )}
              </CardContent>
            </Card>

            {/* นักเรียนที่ขาดวันนี้ — นับจริงเมื่อกดหยุดสแกนแล้วเท่านั้น (ระหว่างสแกนไม่แสดงจำนวนขาด) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="w-5 h-5 text-amber-600" />
                  นักเรียนที่ขาดวันนี้
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!hasStartedAttendanceToday ? (
                  <p className="text-sm text-gray-500 py-2">ยังไม่ได้เริ่มเช็คชื่อวันนี้</p>
                ) : isScanning ? (
                  <>
                    <p className="text-sm font-medium text-amber-700 mb-1">
                      กำลังสแกนเช็คชื่อวันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {selectedClass && (
                      <p className="text-sm font-medium text-amber-700 mb-1">
                        ห้อง {selectedClass.name}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 py-1">กดหยุดสแกนเพื่อดูจำนวนขาดเรียน</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-1">
                      เช็คชื่อวันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {selectedClass && (
                      <p className="text-sm text-gray-600 font-medium mb-1">
                        ห้อง {selectedClass.name}
                      </p>
                    )}
                    <p className="text-2xl font-bold text-amber-600 mb-3">
                      ขาด {absentStudents.length} คน
                    </p>
                    {absentStudents.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {absentStudents.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-2 text-sm"
                          >
                            <UserX className="w-4 h-4 shrink-0 text-amber-500" />
                            <span>{s.firstName} {s.lastName}</span>
                            <span className="text-gray-500 text-xs">({s.studentId})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-2">ทุกคนเข้าเรียนครบแล้ว</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Enrolled Students List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">นักเรียนที่ลงทะเบียน</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {enrolledStudents.map(student => (
                    <div key={student.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>{student.firstName}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
