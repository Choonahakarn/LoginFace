import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClassRoom } from '@/hooks/useClassRoom';
import { useStudents } from '@/hooks/useStudents';
import { useBackendFace } from '@/hooks/useBackendFace';
import { captureFrameAsBase64, captureFaceCropAsBase64 } from '@/lib/captureFrame';
import { loadMediaPipeFaceDetector, detectFaceFromVideo, isMediaPipeLoaded } from '@/lib/mediapipeApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  UserCheck,
  Users,
  RefreshCw,
  GraduationCap,
  Plus,
  Trash2,
  X,
  FlipHorizontal,
  User,
  LogOut
} from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface FaceEnrollmentSectionProps {
  onBack: () => void;
  initialStudentId?: string | null;
}

export function FaceEnrollmentSection({ onBack, initialStudentId }: FaceEnrollmentSectionProps) {
  const { authUser, signOut } = useAuth();
  const { selectedClassId, selectedClass, classrooms } = useClassRoom();
  
  // Get classroom name directly from classrooms array to avoid showing placeholder
  const currentClassroom = selectedClassId ? classrooms.find(c => c.id === selectedClassId) : null;
  const displayClassName = currentClassroom?.name || selectedClass?.name || '';
  const classId = selectedClassId;
  const { students } = useStudents();
  const backendFace = useBackendFace();
  
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
  const [backendFaceCounts, setBackendFaceCounts] = useState<Record<string, number>>({});
  const [backendFaceRecords, setBackendFaceRecords] = useState<Record<string, { enrolledAt: string; confidence: number }[]>>({});
  
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

  // Cache for face counts and records
  const faceCountsCache = React.useRef<Map<string, { count: number; timestamp: number }>>(new Map());
  const faceRecordsCache = React.useRef<Map<string, { records: { enrolledAt: string; confidence: number }[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 30000; // 30 seconds

  const resolvedFaceCount = useCallback((sid: string) => backendFaceCounts[sid] ?? 0, [backendFaceCounts]);
  const resolvedFaceRecords = useCallback((sid: string) => backendFaceRecords[sid] ?? [], [backendFaceRecords]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId ?? null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isLoadingFaceCounts, setIsLoadingFaceCounts] = useState(true);
  const [hasInitializedCache, setHasInitializedCache] = useState(false);

  // Load face counts for all students in class - use cache and optimistic updates
  useEffect(() => {
    const classStudents = students.filter(s => s.classIds.includes(classId));
    if (classStudents.length === 0) {
      setIsLoadingFaceCounts(false);
      setHasInitializedCache(true);
      return;
    }

    // Initialize with cached values immediately (optimistic) - this prevents flickering
    const cachedCounts: Record<string, number> = {};
    let hasCachedData = false;
    classStudents.forEach(student => {
      const cached = faceCountsCache.current.get(`${classId}-${student.id}`);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        cachedCounts[student.id] = cached.count;
        hasCachedData = true;
      }
    });
    
    // Set cached values immediately for fast UI - prevents showing 0/5 briefly
    if (hasCachedData) {
      setBackendFaceCounts(prev => {
        const updated = { ...prev, ...cachedCounts };
        // Mark as initialized only if we have cached data for ALL students
        const allStudentsHaveCachedData = classStudents.every(s => {
          const cacheKey = `${classId}-${s.id}`;
          const cached = faceCountsCache.current.get(cacheKey);
          return cached && (Date.now() - cached.timestamp) < CACHE_TTL;
        });
        if (allStudentsHaveCachedData) {
          // All students have cached data - we can show UI immediately
          setHasInitializedCache(true);
          setIsLoadingFaceCounts(false);
        } else {
          // Some students don't have cached data - wait for fetch
          setHasInitializedCache(false);
        }
        return updated;
      });
    } else {
      // No cache at all - we need to wait for data to load
      setHasInitializedCache(false);
    }

    // Fetch all counts in parallel (non-blocking)
    Promise.all(
      classStudents.map(async student => {
        const cacheKey = `${classId}-${student.id}`;
        const cached = faceCountsCache.current.get(cacheKey);
        
        // Use cache if valid
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
          return { studentId: student.id, count: cached.count };
        }

        try {
          const c = await backendFace.getFaceEnrollmentCount(classId, student.id);
          faceCountsCache.current.set(cacheKey, { count: c, timestamp: Date.now() });
          return { studentId: student.id, count: c };
        } catch (e) {
          // ถ้าเกิด error (เช่น นักเรียนยังไม่เคยลงทะเบียน) ให้เป็น 0
          faceCountsCache.current.set(cacheKey, { count: 0, timestamp: Date.now() });
          return { studentId: student.id, count: 0 };
        }
      })
    ).then(results => {
      const counts: Record<string, number> = {};
      results.forEach(({ studentId, count }) => {
        counts[studentId] = count;
      });
      // Update state synchronously to prevent flickering
      setBackendFaceCounts(prev => {
        const updated = { ...prev, ...counts };
        // Only mark as initialized after we have data for ALL students
        const allStudentsHaveData = classStudents.every(s => updated[s.id] !== undefined);
        if (allStudentsHaveData) {
          setHasInitializedCache(true);
          setIsLoadingFaceCounts(false);
        }
        return updated;
      });
    }).catch(err => {
      console.error('[FaceEnrollment] Error loading face counts:', err);
      // Even on error, mark as initialized so UI can show
      setHasInitializedCache(true);
      setIsLoadingFaceCounts(false);
    });
  }, [classId, backendFace, backendFace.faceVersion, students]);

  // Load face count and records for selected student - use cache and parallel loading
  useEffect(() => {
    if (!selectedStudentId) return;
    const sid = selectedStudentId;
    const cacheKey = `${classId}-${sid}`;

    // Check cache for count
    const cachedCount = faceCountsCache.current.get(cacheKey);
    if (cachedCount && (Date.now() - cachedCount.timestamp) < CACHE_TTL) {
      setBackendFaceCounts(prev => ({ ...prev, [sid]: cachedCount.count }));
    }

    // Check cache for records
    const cachedRecords = faceRecordsCache.current.get(cacheKey);
    if (cachedRecords && (Date.now() - cachedRecords.timestamp) < CACHE_TTL) {
      setBackendFaceRecords(prev => ({
        ...prev,
        [sid]: cachedRecords.records,
      }));
    }

    // Fetch both in parallel (non-blocking)
    Promise.all([
      backendFace.getFaceEnrollmentCount(classId, sid),
      backendFace.getStudentFacesAsync(classId, sid)
    ]).then(([count, recs]) => {
      // Update cache
      faceCountsCache.current.set(cacheKey, { count, timestamp: Date.now() });
      faceRecordsCache.current.set(cacheKey, {
        records: recs.map(r => ({ enrolledAt: r.enrolledAt, confidence: r.confidence })),
        timestamp: Date.now()
      });

      // Update state
      setBackendFaceCounts(prev => ({ ...prev, [sid]: count }));
      setBackendFaceRecords(prev => ({
        ...prev,
        [sid]: recs.map(r => ({ enrolledAt: r.enrolledAt, confidence: r.confidence })),
      }));
    }).catch(err => {
      console.error('[FaceEnrollment] Error loading student face data:', err);
    });
  }, [selectedStudentId, classId, backendFace, backendFace.faceVersion]);

  useEffect(() => {
    if (initialStudentId) setSelectedStudentId(initialStudentId);
  }, [initialStudentId]);

  /** แสดงเฉพาะที่ยังไม่ครบ 5 รูป — แสดงทุกคนที่ยังไม่ครบ 5 รูป */
  // Only filter if we have initialized cache to prevent showing 0/5 briefly
  const studentsNeedingEnrollment = hasInitializedCache
    ? students
        .filter(s => s.classIds.includes(classId))
        .filter(s => resolvedFaceCount(s.id) < 5)
    : [];
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user'); // 'user' = กล้องหน้า, 'environment' = กล้องหลัง
  /** เก็บรูปเมื่อ error "โมเดลไม่ตรง" เพื่อให้กดปุ่มล้างข้อมูลเก่าและลงทะเบียนใหม่ได้ */
  const [retryWithForceNewModelBase64, setRetryWithForceNewModelBase64] = useState<string | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    duplicateStudentId: string;
    similarity: number;
    imageBase64: string;
  } | null>(null);
  const duplicateResolveRef = useRef<(() => void) | null>(null);
  const duplicateRejectRef = useRef<((error: Error) => void) | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Preload MediaPipe models when component mounts to speed up first capture
  useEffect(() => {
    if (!isMediaPipeLoaded()) {
      console.log('[FaceEnrollment] Preloading MediaPipe face detector...');
      loadMediaPipeFaceDetector()
        .then(() => {
          console.log('[FaceEnrollment] ✓ MediaPipe preloaded');
        })
        .catch(err => {
          console.error('[FaceEnrollment] Error preloading MediaPipe:', err);
        });
    }
  }, []);

  const startCamera = useCallback(async (facing?: 'user' | 'environment') => {
    const facingModeToUse = facing ?? facingMode;
    try {
      setError(null);
      setRetryWithForceNewModelBase64(null);
      
      // ปิด stream เดิมก่อน (ถ้ามี)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // MediaPipe should already be loaded from preload, but check anyway
      if (!isMediaPipeLoaded()) {
        setIsModelsLoading(true);
        await loadMediaPipeFaceDetector();
        setIsModelsLoading(false);
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingModeToUse },
        audio: false
      });
      streamRef.current = stream;
      setFacingMode(facingModeToUse);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setIsModelsLoading(false);
      setError(err instanceof Error ? err.message : 'ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง');
    }
  }, [facingMode]);
  
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
  }, []);

  const captureFace = useCallback(async () => {
    if (!selectedStudentId || !videoRef.current) return;

    setIsCapturing(true);
    setCaptureProgress(0);
    setError(null);
    setRetryWithForceNewModelBase64(null);

    try {
      const countBefore = backendFaceCounts[selectedStudentId] ?? 0;
      if (countBefore >= 5) {
        setError('นักเรียนคนนี้มีข้อมูลใบหน้าครบ 5 รายการแล้ว กรุณาลบรายการเก่าก่อนเพิ่มใหม่');
        setIsCapturing(false);
        return;
      }
      
      // ลบ delay ที่ไม่จำเป็น - ทำให้เร็วขึ้น
      const video = videoRef.current!;
      const ts = performance.now();
      
      // Update progress immediately
      setCaptureProgress(10);
      
      const detection = await detectFaceFromVideo(video, ts);
      
      // Update progress after face detection
      setCaptureProgress(30);

      // การลงทะเบียน: ใช้กล้อง (3D) เท่านั้น - เก็บ face embedding จากกล้องจริง
      // ข้อมูลที่เก็บคือ face embedding (เวกเตอร์) ที่สามารถใช้สำหรับการเช็คชื่อ (3D) ได้
      // การเช็คชื่อจะบังคับให้ใช้ใบหน้า 3D จริงเท่านั้น (มี liveness detection)

      const tryEnroll = async (base64: string, opts?: { allowDuplicate?: boolean; forceNewModel?: boolean }) => {
        const result = await backendFace.enrollFace(classId, selectedStudentId, base64, opts);
        if (!result.success && result.reason === 'duplicate') {
          // แสดง Dialog แทน confirm() เพื่อให้ดูดีกว่า
          return new Promise<void>((resolve, reject) => {
            duplicateResolveRef.current = resolve;
            duplicateRejectRef.current = reject;
            setDuplicateDialog({
              open: true,
              duplicateStudentId: result.duplicate.student_id,
              similarity: result.duplicate.similarity,
              imageBase64: base64,
            });
          });
        }
      };

      let base64: string | null = null;
      if (detection?.box) {
        base64 = captureFaceCropAsBase64(video, detection.box);
      }
      if (!base64) {
        base64 = captureFrameAsBase64(video, 0.92);
      }
      if (!base64) {
        setError('ไม่สามารถถ่ายภาพได้');
        setIsCapturing(false);
        return;
      }

      console.log('[captureFace] กำลังส่งไป Backend — studentId=', selectedStudentId, 'base64_len=', base64.length);
      
      // Update progress before sending to backend
      setCaptureProgress(50);
      
      try {
        await tryEnroll(base64);
        
        // Update progress after enrollment
        setCaptureProgress(80);
        
        // ถ้า tryEnroll สำเร็จ (ไม่ใช่ duplicate) ให้ดำเนินการต่อ
        // ถ้าเป็น duplicate จะแสดง Dialog และรอให้ผู้ใช้เลือก (ไม่มาถึงบรรทัดนี้)
        
        // Show success immediately with optimistic count
        const optimisticCount = countBefore + 1;
        setBackendFaceCounts(prev => ({ ...prev, [selectedStudentId]: optimisticCount }));
        setSuccess(
          optimisticCount >= 5
            ? 'ครบ 5 รายการแล้ว!'
            : `บันทึกใบหน้าที่ ${optimisticCount} สำเร็จ! — ตอนนี้ ${optimisticCount}/5 กด "บันทึกใบหน้า" อีกครั้งเพื่อเพิ่มหน้าถัดไป`
        );
        setTimeout(() => setSuccess(null), 4000);
        if (optimisticCount >= 5) setTimeout(() => setShowAddDialog(false), 2000);
        setIsCapturing(false);
        setCaptureProgress(100);
        
        // Fetch actual count and records in background (non-blocking)
        Promise.all([
          backendFace.getFaceEnrollmentCount(classId, selectedStudentId),
          backendFace.getStudentFacesAsync(classId, selectedStudentId)
        ]).then(([newCount, recs]) => {
          const cacheKey = `${classId}-${selectedStudentId}`;
          const records = recs.map(r => ({ enrolledAt: r.enrolledAt, confidence: r.confidence }));
          
          // Update cache
          faceCountsCache.current.set(cacheKey, { count: newCount, timestamp: Date.now() });
          faceRecordsCache.current.set(cacheKey, { records, timestamp: Date.now() });
          
          // Update with actual data
          setBackendFaceCounts(prev => ({ ...prev, [selectedStudentId]: newCount }));
          setBackendFaceRecords(prev => ({
            ...prev,
            [selectedStudentId]: records,
          }));
          
          // Update success message if count changed
          if (newCount !== optimisticCount) {
            setSuccess(
              newCount >= 5
                ? 'ครบ 5 รายการแล้ว!'
                : `บันทึกใบหน้าที่ ${newCount} สำเร็จ! — ตอนนี้ ${newCount}/5 กด "บันทึกใบหน้า" อีกครั้งเพื่อเพิ่มหน้าถัดไป`
            );
            setTimeout(() => setSuccess(null), 4000);
            if (newCount >= 5) setTimeout(() => setShowAddDialog(false), 2000);
          }
        }).catch(err => {
          console.error('[captureFace] Error fetching count/records:', err);
          // Keep optimistic count if fetch fails
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'ลงทะเบียนไม่สำเร็จ';
        if (msg.includes('ไม่พบใบหน้า') && base64) {
          const fullFrame = captureFrameAsBase64(video, 0.92);
          if (fullFrame && fullFrame !== base64) {
            try {
              await tryEnroll(fullFrame);
            } catch {
              const debug = await backendFace.debugExtractFace(fullFrame).catch(() => null);
              const debugInfo = debug
                ? ` (image: ${debug.image_dims || 'unknown'}, errors: ${(debug.errors || []).join('; ') || 'none'})`
                : '';
              setError(msg + debugInfo);
              setIsCapturing(false);
              return;
            }
          } else {
            const debug = await backendFace.debugExtractFace(base64).catch(() => null);
            const debugInfo = debug
              ? ` (image: ${debug.image_dims || 'unknown'}, errors: ${(debug.errors || []).join('; ') || 'none'})`
              : '';
            setError(msg + debugInfo);
            setIsCapturing(false);
            return;
          }
        } else {
          if (msg.includes('โมเดลไม่ตรง') || msg.includes('expected dim')) {
            setRetryWithForceNewModelBase64(base64);
            const debug = await backendFace.debugExtractFace(base64).catch(() => null);
            const debugInfo = debug
              ? ` (image: ${debug.image_dims || 'unknown'}, errors: ${(debug.errors || []).join('; ') || 'none'})`
              : '';
            setError(msg + debugInfo);
            setIsCapturing(false);
            return;
          }
          const debug = await backendFace.debugExtractFace(base64).catch(() => null);
          const debugInfo = debug
            ? ` (image: ${debug.image_dims || 'unknown'}, errors: ${(debug.errors || []).join('; ') || 'none'})`
            : '';
          setError(msg + debugInfo);
          setIsCapturing(false);
          return;
        }
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'เกิดข้อผิดพลาด';
      // ถ้าเป็น error "ยกเลิกการลงทะเบียน" ไม่ต้องแสดง error (ผู้ใช้เลือกเอง)
      if (!errorMsg.includes('ยกเลิกการลงทะเบียน')) {
        setError(errorMsg);
      }
      setIsCapturing(false);
    }
  }, [selectedStudentId, classId, backendFace, backendFaceCounts]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleRemoveFaceByIndex = async (studentId: string, index: number) => {
    const recs = resolvedFaceRecords(studentId);
    const isLast = recs.length <= 1;
    if (!confirm(isLast ? 'ลบรายการนี้? หลังลบจะไม่มีข้อมูลใบหน้าคงเหลือ' : 'ลบรายการนี้?')) return;
    await backendFace.removeFaceByIndex(classId, studentId, index);
    const cacheKey = `${classId}-${studentId}`;
    const [c, recs2] = await Promise.all([
      backendFace.getFaceEnrollmentCount(classId, studentId),
      backendFace.getStudentFacesAsync(classId, studentId)
    ]);
    const records = recs2.map(r => ({ enrolledAt: r.enrolledAt, confidence: r.confidence }));
    
    // Update cache
    faceCountsCache.current.set(cacheKey, { count: c, timestamp: Date.now() });
    faceRecordsCache.current.set(cacheKey, { records, timestamp: Date.now() });
    
    setBackendFaceCounts(prev => ({ ...prev, [studentId]: c }));
    setBackendFaceRecords(prev => ({
      ...prev,
      [studentId]: records,
    }));
    if (isLast) setSelectedStudentId(null);
  };

  const handleRemoveAllFaces = async (studentId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลใบหน้าทั้งหมดของนักเรียนคนนี้?')) return;
    await backendFace.removeFaceEnrollment(classId, studentId);
    const cacheKey = `${classId}-${studentId}`;
    
    // Update cache
    faceCountsCache.current.set(cacheKey, { count: 0, timestamp: Date.now() });
    faceRecordsCache.current.set(cacheKey, { records: [], timestamp: Date.now() });
    
    setBackendFaceCounts(prev => ({ ...prev, [studentId]: 0 }));
    setBackendFaceRecords(prev => ({ ...prev, [studentId]: [] }));
    setSelectedStudentId(null);
  };

  /** กดปุ่ม "ล้างข้อมูลเก่าและลงทะเบียนใหม่" — ส่ง POST ไป backend เดียว (backend จะล้างข้อมูลเก่าอัตโนมัติเมื่อ dim ไม่ตรง) */
  const handleRetryWithForceNewModel = useCallback(async () => {
    if (!retryWithForceNewModelBase64 || !selectedStudentId) return;
    const base64 = retryWithForceNewModelBase64;
    setIsCapturing(true);
    try {
      await backendFace.enrollFace(classId, selectedStudentId, base64);
      setError(null);
      setRetryWithForceNewModelBase64(null);
      const cacheKey = `${classId}-${selectedStudentId}`;
      const [newCount, recs] = await Promise.all([
        backendFace.getFaceEnrollmentCount(classId, selectedStudentId),
        backendFace.getStudentFacesAsync(classId, selectedStudentId)
      ]);
      const records = recs.map(r => ({ enrolledAt: r.enrolledAt, confidence: r.confidence }));
      
      // Update cache
      faceCountsCache.current.set(cacheKey, { count: newCount, timestamp: Date.now() });
      faceRecordsCache.current.set(cacheKey, { records, timestamp: Date.now() });
      
      setBackendFaceCounts(prev => ({ ...prev, [selectedStudentId]: newCount }));
      setBackendFaceRecords(prev => ({
        ...prev,
        [selectedStudentId]: records,
      }));
      setSuccess('ล้างข้อมูลเก่าและลงทะเบียนใหม่สำเร็จ — ตอนนี้ใช้โมเดลปัจจุบันแล้ว');
      setTimeout(() => setSuccess(null), 5000);
      if (newCount >= 5) setTimeout(() => setShowAddDialog(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ลงทะเบียนไม่สำเร็จ';
      setError(msg);
      setRetryWithForceNewModelBase64(base64);
    }
    setIsCapturing(false);
  }, [classId, selectedStudentId, retryWithForceNewModelBase64, backendFace]);

  const selectedStudent = selectedStudentId ? students.find(s => s.id === selectedStudentId) : null;
  const faceData = selectedStudentId
    ? resolvedFaceRecords(selectedStudentId).map((r, i) => ({
        enrolledAt: r.enrolledAt,
        confidence: r.confidence,
        index: i,
      }))
    : null;

  const classStudents = students.filter(s => s.classIds.includes(classId));
  // Only calculate allEnrolled if we have initialized cache and loaded face counts for all students
  // This prevents flickering between "0/5" and "all enrolled" states
  const hasLoadedAllCounts = hasInitializedCache && classStudents.length > 0 && classStudents.every(s => {
    // Check if we have data for this student in state
    return backendFaceCounts[s.id] !== undefined;
  });
  const allEnrolled = hasLoadedAllCounts && classStudents.length > 0 && classStudents.every(s => resolvedFaceCount(s.id) >= 5);

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
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">จัดการใบหน้า</h1>
                {displayClassName && (
                  <p className="text-xs text-gray-500 hidden sm:block">
                    ห้อง {displayClassName} — แสดงเฉพาะนักเรียนในห้องนี้ที่ยังไม่มีใบหน้า
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 py-6 lg:py-8 min-w-0">
        {!selectedStudentId ? (
          <Card>
            <CardHeader>
              <CardTitle>เลือกนักเรียน</CardTitle>
            </CardHeader>
            <CardContent>
              {classStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-700">ยังไม่มีนักเรียนในห้องนี้</p>
                  <p className="text-sm mt-1">กรุณาไปที่ จัดการนักเรียน เพื่อเพิ่มนักเรียนลงในห้องก่อน</p>
                </div>
              ) : !hasInitializedCache || !hasLoadedAllCounts ? (
                // Show loading state while face counts are being fetched
                // Don't show UI until we have data for ALL students
                <div className="text-center py-12 text-gray-500">
                  <div className="w-16 h-16 mx-auto mb-4 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm mt-1">กำลังโหลดข้อมูล...</p>
                </div>
              ) : allEnrolled ? (
                <div className="text-center py-12 text-gray-500">
                  <UserCheck className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium text-gray-700">นักเรียนทุกคนลงทะเบียนใบหน้าแล้ว</p>
                  <p className="text-sm mt-1">ไม่มีรายชื่อที่ต้องลงทะเบียนในหน้านี้</p>
                  <p className="text-sm mt-3 text-gray-600">หากต้องการลงทะเบียนเพิ่ม ให้ไปเพิ่มนักเรียนในหน้า จัดการนักเรียน</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentsNeedingEnrollment.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-200">
                        <span className="text-lg font-bold text-gray-500">
                          {student.firstName[0]}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{student.firstName} {student.lastName}</p>
                        <p className="text-sm text-gray-500">{student.studentId}</p>
                      </div>
                      <Badge variant="secondary">{resolvedFaceCount(student.id)}/5</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Student Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {selectedStudent?.firstName[0]}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {selectedStudent?.firstName} {selectedStudent?.lastName}
                      </h2>
                      <p className="text-gray-500">{selectedStudent?.studentId}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedStudentId(null)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      กลับ
                    </Button>
                  </div>
                </div>
                {(faceData?.length ?? 0) < 5 ? (
                  <div className="mt-4 p-2 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      ต้องลงทะเบียนให้ครบ 5 รูปก่อน ถึงจะสแกนเช็คชื่อได้
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      ตอนนี้ลงทะเบียนแล้ว {faceData?.length ?? 0}/5 รูป — ต้องลงทะเบียนอีก {5 - (faceData?.length ?? 0)} รูป
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-2 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      ครบ 5 ภาพแล้ว — สามารถเช็คชื่อได้แล้ว
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Face List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Embedding ที่ลงทะเบียน (ไม่เก็บรูป/วิดีโอ)
                    <Badge>{faceData?.length ?? 0}/5</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    เก็บเฉพาะ embedding + model_version + วันที่ + confidence (ไม่เก็บรูป/วิดีโอ ตาม PDPA)
                  </p>
                </div>
                {(faceData?.length ?? 0) < 5 && (
                  <Button
                    onClick={() => {
                      // แสดง Consent Dialog ทุกครั้งที่กด "เพิ่มใบหน้า" (ตาม PDPA - ควรขอความยินยอมทุกครั้งสำหรับข้อมูลอ่อนไหว)
                      setConsentChecked(false);
                      setShowConsentDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มใบหน้า
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {faceData && faceData.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {faceData.map((record, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                          <UserCheck className="w-12 h-12 text-blue-500" />
                        </div>
                        <div className="absolute top-1 right-1">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); handleRemoveFaceByIndex(selectedStudentId, index); }}
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-center text-sm text-gray-500 mt-1">
                          #{index + 1} · conf {(record.confidence * 100).toFixed(0)}%
                        </p>
                        <p className="text-center text-xs text-gray-400">
                          {new Date(record.enrolledAt).toLocaleDateString('th-TH')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <UserCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>ยังไม่มี embedding ใบหน้า</p>
                    <p className="text-sm">กด &quot;เพิ่มใบหน้า&quot; เพื่อลงทะเบียน (เก็บเฉพาะเวกเตอร์ ไม่เก็บรูป)</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Consent Dialog (PDPA) — แสดงก่อนลงทะเบียนใบหน้า */}
            <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>ความยินยอมในการเก็บข้อมูลใบหน้า</DialogTitle>
                  <DialogDescription asChild>
                    <div className="space-y-3 text-left">
                      <p>
                        ระบบจะเก็บเฉพาะ <strong>ข้อมูลใบหน้าในรูปแบบ embedding</strong> (เวกเตอร์ตัวเลข)
                        เพื่อใช้ในการเช็คชื่อเข้าเรียน <strong>ไม่เก็บรูปภาพหรือวิดีโอ</strong> ของใบหน้า
                        ข้อมูลนี้ใช้เทียบความเหมือนเท่านั้น แปลงย้อนกลับเป็นใบหน้าไม่ได้
                      </p>
                      <p>
                        คุณสามารถถอนความยินยอมและลบข้อมูลได้ตลอดเวลาผ่านปุ่มลบในหน้านี้
                        อ่านรายละเอียดเพิ่มเติมได้ที่{' '}
                        <a
                          href="#privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(`${window.location.origin}/#privacy`, '_blank');
                          }}
                        >
                          นโยบายความเป็นส่วนตัว
                        </a>
                      </p>
                      <label className="flex items-start gap-3 cursor-pointer rounded-md border p-3 hover:bg-gray-50">
                        <Checkbox
                          checked={consentChecked}
                          onCheckedChange={(checked) => setConsentChecked(checked === true)}
                        />
                        <span className="text-sm">
                          ข้าพเจ้ายินยอมให้เก็บและใช้ข้อมูลใบหน้าดังกล่าวเพื่อวัตถุประสงค์ในการเช็คชื่อเข้าเรียน
                        </span>
                      </label>
                    </div>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowConsentDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button
                    disabled={!consentChecked}
                    onClick={() => {
                      // ไม่เก็บ consent ใน sessionStorage - แสดงทุกครั้งเพื่อให้แน่ใจว่าผู้ใช้ยินยอมทุกครั้ง
                      setShowConsentDialog(false);
                      setConsentChecked(false);
                      setShowAddDialog(true);
                      startCamera();
                    }}
                  >
                    ยืนยัน
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Face Dialog */}
            {showAddDialog && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>เพิ่มใบหน้าใหม่</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => { setShowAddDialog(false); stopCamera(); setError(null); setRetryWithForceNewModelBase64(null); }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {error && (
                    <div className="space-y-2">
                      <Alert variant="destructive">
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                      {(error.includes('โมเดลไม่ตรง') || error.includes('expected dim')) && retryWithForceNewModelBase64 && (
                        <Button
                          variant="default"
                          className="w-full bg-amber-600 hover:bg-amber-700"
                          onClick={handleRetryWithForceNewModel}
                          disabled={isCapturing}
                        >
                          {isCapturing ? 'กำลังล้างและลงทะเบียนใหม่...' : 'ล้างข้อมูลเก่าและลงทะเบียนใหม่ (ตกลง)'}
                        </Button>
                      )}
                    </div>
                  )}

                  {success && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <AlertDescription className="text-green-700">{success}</AlertDescription>
                    </Alert>
                  )}

                  {/* Camera Preview — ปรับขนาดพอดีทุกจอ */}
                  <div className="relative w-full max-w-xl mx-auto aspect-[4/5] min-h-[220px] max-h-[60vh] sm:max-h-[65vh] lg:max-h-[70vh] bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* กรอบช่วยจัดวางใบหน้า — ขนาดพอดีกับศีรษะถึงคาง */}
                    {isCameraActive && !isModelsLoading && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative w-[70%] min-w-[180px] max-w-[420px] aspect-[3/4]">
                          <div className="absolute inset-0 border-2 border-white/60 rounded-[45%] border-dashed shadow-lg" style={{ borderRadius: '45% 45% 50% 50%' }} />
                          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-white/95 text-sm font-medium drop-shadow-lg bg-black/50 px-3 py-1.5 rounded-full">
                            วางใบหน้าในกรอบนี้ • มองตรงที่กล้อง
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {isModelsLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/70">
                        <RefreshCw className="w-12 h-12 mb-2 animate-spin" />
                        <p>กำลังโหลดโมเดล Deep Learning...</p>
                      </div>
                    )}
                    {!isCameraActive && !isModelsLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <Camera className="w-12 h-12 mb-2 opacity-50" />
                        <p>กำลังเปิดกล้อง...</p>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  {isCapturing && (
                    <div className="space-y-2 max-w-xl mx-auto">
                      <div className="flex justify-between text-sm">
                        <span>กำลังบันทึก...</span>
                        <span>{Math.round(captureProgress)}%</span>
                      </div>
                      <Progress value={captureProgress} />
                      <p className="text-sm text-gray-500 text-center">
                        กรุณาอยู่นิ่งและมองตรงที่กล้อง
                      </p>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex justify-center gap-2 sm:gap-4 flex-wrap">
                    <Button 
                      onClick={captureFace} 
                      size="lg"
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                      disabled={!isCameraActive || isCapturing}
                    >
                      {isCapturing ? (
                        <>กำลังบันทึก...</>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 mr-2" />
                          <span className="hidden sm:inline">บันทึกใบหน้า (3D)</span>
                          <span className="sm:hidden">บันทึก</span>
                        </>
                      )}
                    </Button>
                    {isMobileDevice && (
                      <Button 
                        onClick={switchCamera} 
                        variant="outline" 
                        size="lg"
                        disabled={isCapturing}
                        className="w-full sm:w-auto border-purple-500 text-purple-700 hover:bg-purple-100 disabled:opacity-50 bg-purple-50"
                        title={facingMode === 'user' ? 'สลับเป็นกล้องหลัง' : 'สลับเป็นกล้องหน้า'}
                      >
                        <FlipHorizontal className="w-5 h-5 mr-2" />
                        {facingMode === 'user' ? 'กล้องหลัง' : 'กล้องหน้า'}
                      </Button>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="bg-blue-50 p-4 rounded-lg max-w-xl mx-auto">
                    <h4 className="font-medium text-blue-800 mb-2">คำแนะนำการบันทึกจากกล้อง (3D):</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>วางใบหน้าในกรอบ</strong> ให้ตรงกลาง ไม่บังแสง</li>
                      <li>• อยู่ในที่แสงสว่างพอเหมาะ — ถ้าบันทึกไม่ติด ลองย้ายไปที่แสงดีกว่า</li>
                      <li>• มองตรงที่กล้อง ไม่สวมแว่นบังตา (ถ้าทำได้)</li>
                      <li>• ไม่มีอะไรบังใบหน้า • อยู่นิ่งขณะบันทึก ~2 วินาที</li>
                      <li>• <strong>หมายเหตุ:</strong> ข้อมูลที่เก็บคือ face embedding (เวกเตอร์) จากกล้องจริง (3D)</li>
                      <li>• ข้อมูลนี้จะใช้สำหรับการเช็คชื่อ (3D) ที่ต้องใช้ใบหน้าจริงเท่านั้น</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delete All Button */}
            {faceData && faceData.length > 0 && (
              <div className="flex justify-center">
                <Button 
                  variant="destructive" 
                  onClick={() => selectedStudentId && handleRemoveAllFaces(selectedStudentId)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบข้อมูลใบหน้าทั้งหมด
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={duplicateDialog?.open ?? false} onOpenChange={(open) => {
        if (!open) {
          setDuplicateDialog(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              พบใบหน้าที่คล้ายกันมาก
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                ใบหน้าที่จะลงทะเบียนนี้มีความคล้ายกันกับนักเรียนรหัส{' '}
                <strong className="text-amber-600">{duplicateDialog?.duplicateStudentId}</strong>{' '}
                ถึง <strong className="text-amber-600">{Math.round((duplicateDialog?.similarity ?? 0) * 100)}%</strong>
              </p>
              <p className="text-sm text-gray-600">
                คุณต้องการบันทึกใบหน้านี้ต่อหรือไม่?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              if (duplicateRejectRef.current) {
                duplicateRejectRef.current(new Error('ยกเลิกการลงทะเบียน'));
                duplicateRejectRef.current = null;
                duplicateResolveRef.current = null;
              }
              setDuplicateDialog(null);
              setError('ยกเลิกการลงทะเบียน');
            }}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!duplicateDialog || !selectedStudentId) return;
                const { imageBase64 } = duplicateDialog;
                try {
                  const override = await backendFace.enrollFace(classId, selectedStudentId, imageBase64, { allowDuplicate: true });
                  if (!override.success) {
                    throw new Error('ลงทะเบียนไม่สำเร็จ');
                  }
                  if (duplicateResolveRef.current) {
                    duplicateResolveRef.current();
                    duplicateResolveRef.current = null;
                    duplicateRejectRef.current = null;
                  }
                  setDuplicateDialog(null);
                  setCaptureProgress(100);
                  const cacheKey = `${classId}-${selectedStudentId}`;
                  const [newCount, recs] = await Promise.all([
                    backendFace.getFaceEnrollmentCount(classId, selectedStudentId),
                    backendFace.getStudentFacesAsync(classId, selectedStudentId)
                  ]);
                  const records = recs.map(r => ({ enrolledAt: r.enrolledAt, confidence: r.confidence }));
                  
                  // Update cache
                  faceCountsCache.current.set(cacheKey, { count: newCount, timestamp: Date.now() });
                  faceRecordsCache.current.set(cacheKey, { records, timestamp: Date.now() });
                  
                  setBackendFaceCounts(prev => ({ ...prev, [selectedStudentId]: newCount }));
                  setBackendFaceRecords(prev => ({
                    ...prev,
                    [selectedStudentId]: records,
                  }));
                  setSuccess(
                    newCount >= 5
                      ? 'ครบ 5 รายการแล้ว!'
                      : `บันทึกใบหน้าที่ ${newCount} สำเร็จ! — ตอนนี้ ${newCount}/5 กด "บันทึกใบหน้า" อีกครั้งเพื่อเพิ่มหน้าถัดไป`
                  );
                  setTimeout(() => setSuccess(null), 4000);
                  if (newCount >= 5) setTimeout(() => setShowAddDialog(false), 2000);
                } catch (e) {
                  if (duplicateRejectRef.current) {
                    duplicateRejectRef.current(e instanceof Error ? e : new Error('ลงทะเบียนไม่สำเร็จ'));
                    duplicateRejectRef.current = null;
                    duplicateResolveRef.current = null;
                  }
                  setDuplicateDialog(null);
                  setError(e instanceof Error ? e.message : 'ลงทะเบียนไม่สำเร็จ');
                }
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              บันทึกต่อ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
