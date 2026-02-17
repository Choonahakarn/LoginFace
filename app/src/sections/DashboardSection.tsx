import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClassRoom } from '@/hooks/useClassRoom';
import { useStudents } from '@/hooks/useStudents';
import { useAttendance } from '@/hooks/useAttendance';
import { useBackendFace } from '@/hooks/useBackendFace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Users,
  UserCheck,
  UserX,
  Calendar,
  Camera,
  GraduationCap,
  TrendingUp,
  School,
  Settings,
  Trash2,
  User,
  LogOut,
  ArrowLeft,
} from 'lucide-react';

import type { AppPage } from '@/types';

interface DashboardSectionProps {
  onNavigate: (page: AppPage) => void;
}

// Cache for enrolled IDs to avoid repeated fetches
const faceCountsCache = new Map<string, { counts: Record<string, number>; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function DashboardSection({ onNavigate }: DashboardSectionProps) {
  const { authUser, signOut, user } = useAuth();
  const { selectedClassId, selectedClass, classrooms, updateClassroomName, updateLateGraceMinutes, deleteClassroom, loading: classroomsLoading } = useClassRoom();
  
  // Get classroom name directly from classrooms array to avoid showing placeholder
  const currentClassroom = selectedClassId ? classrooms.find(c => c.id === selectedClassId) : null;
  const displayClassName = currentClassroom?.name || selectedClass?.name || '';
  const { students, getStudentsByClass, loading: studentsLoading } = useStudents();
  const { getTodayAttendance, getAttendanceStats } = useAttendance();
  const backendFace = useBackendFace();
  // null = ยังไม่ได้รับข้อมูลจาก API, {} = โหลดแล้วแต่ไม่มีใครมีใบหน้า (นับเป็น 0)
  const [faceCountsFromApi, setFaceCountsFromApi] = useState<Record<string, number> | null>(null);
  const [faceCountsLoading, setFaceCountsLoading] = useState(true);
  
  // Track last fetched classId and faceVersion to prevent unnecessary refetches
  const lastFetchedRef = useRef<{ classId: string | null; faceVersion: number }>({ classId: null, faceVersion: -1 });

  const classId = selectedClassId ?? null;
  const classStudents = classId ? getStudentsByClass(classId) : [];
  
  // Load face counts from API - reliable for dashboard "not enrolled"
  useEffect(() => {
    // IMPORTANT: wait for authenticated user; otherwise getEnrolledStudentIdsAsync returns []
    // and Dashboard will incorrectly show "not enrolled" count = total students.
    if (!user || !classId) {
      if (!user) {
        console.log('[Dashboard] Waiting for user authentication...');
      }
      if (!classId) {
        console.log('[Dashboard] Waiting for classId...');
      }
      setFaceCountsFromApi(null);
      setFaceCountsLoading(true);
      lastFetchedRef.current = { classId: null, faceVersion: -1 };
      return;
    }
    
    console.log('[Dashboard] Fetching counts for classId:', classId, 'userId:', user.id);
    
    const currentFaceVersion = backendFace.faceVersion;
    
    // Check if faceVersion changed - if so, always fetch fresh data
    const faceVersionChanged = lastFetchedRef.current.classId === classId && 
                                lastFetchedRef.current.faceVersion !== currentFaceVersion;
    
    let cancelled = false;

    const setResult = (counts: Record<string, number>) => {
      if (cancelled) return;
      faceCountsCache.set(classId, { counts, timestamp: Date.now() });
      setFaceCountsFromApi(counts);
      setFaceCountsLoading(false);
      lastFetchedRef.current = { classId, faceVersion: currentFaceVersion };
    };

    const setLoadingOnly = () => {
      if (cancelled) return;
      setFaceCountsFromApi(null);
      setFaceCountsLoading(true);
    };

    const fetchWithFallback = async () => {
      setLoadingOnly();
      try {
        const counts = await backendFace.getFaceCountsForClassAsync(classId);
        console.log('[Dashboard] Face counts from API:', counts);
        console.log('[Dashboard] Counts keys:', Object.keys(counts));
        
        // Get current students (may have loaded after API call)
        const currentStudents = classId ? getStudentsByClass(classId) : [];
        console.log('[Dashboard] Current class students IDs:', currentStudents.map(s => s.id));
        
        // If counts is empty but we have students, fetch individual counts
        if (Object.keys(counts).length === 0 && currentStudents.length > 0) {
          console.log('[Dashboard] Empty counts but students exist, fetching individual counts...');
          const individualCounts: Record<string, number> = {};
          await Promise.all(
            currentStudents.map(async (s) => {
              try {
                const c = await backendFace.getFaceEnrollmentCount(classId, s.id);
                console.log(`[Dashboard] Student ${s.id} individual count: ${c}`);
                individualCounts[s.id] = c;
              } catch (err) {
                console.error(`[Dashboard] Failed to get count for ${s.id}:`, err);
                individualCounts[s.id] = 0;
              }
            })
          );
          console.log('[Dashboard] Individual counts result:', individualCounts);
          setResult(individualCounts);
          return;
        }
        
        // Check for missing IDs even if counts is not empty
        if (currentStudents.length > 0) {
          const missingIds = currentStudents.filter(s => !(s.id in counts) || counts[s.id] === 0).map(s => s.id);
          if (missingIds.length > 0) {
            console.warn('[Dashboard] Students with missing/zero counts:', missingIds);
            // Fetch individual counts for missing students
            const individualCounts: Record<string, number> = { ...counts };
            await Promise.all(
              missingIds.map(async (studentId) => {
                try {
                  const c = await backendFace.getFaceEnrollmentCount(classId, studentId);
                  console.log(`[Dashboard] Missing student ${studentId} individual count: ${c}`);
                  individualCounts[studentId] = c;
                } catch {
                  individualCounts[studentId] = 0;
                }
              })
            );
            console.log('[Dashboard] Updated counts with individual:', individualCounts);
            setResult(individualCounts);
            return;
          }
        }
        
        setResult(counts);
        return;
      } catch (err) {
        console.error('[Dashboard] Failed to fetch counts:', err);
        // Fallback: use /enrolled to know "has any enrollment"
        // (enough for dashboard "not enrolled" count even if /counts isn't deployed yet)
        try {
          const ids = await backendFace.getEnrolledStudentIdsAsync(classId);
          console.log('[Dashboard] Fallback enrolled IDs:', ids);
          const fallbackCounts: Record<string, number> = {};
          for (const id of ids) fallbackCounts[id] = 1;
          setResult(fallbackCounts);
          return;
        } catch (fallbackErr) {
          console.error('[Dashboard] Fallback also failed:', fallbackErr);
          // Last resort: fetch individual counts for each student
          if (classStudents.length > 0) {
            console.log('[Dashboard] Trying individual counts as last resort...');
            const individualCounts: Record<string, number> = {};
            await Promise.all(
              classStudents.map(async (s) => {
                try {
                  const c = await backendFace.getFaceEnrollmentCount(classId, s.id);
                  individualCounts[s.id] = c;
                } catch {
                  individualCounts[s.id] = 0;
                }
              })
            );
            console.log('[Dashboard] Last resort individual counts:', individualCounts);
            if (!cancelled) {
              setResult(individualCounts);
            }
            return;
          }
          // On error, show empty counts (0 enrolled) instead of loading forever
          if (!cancelled) {
            setFaceCountsFromApi({});
            setFaceCountsLoading(false);
          }
        }
      }
    };

    // If faceVersion changed, always clear cache and fetch fresh data
    if (faceVersionChanged) {
      faceCountsCache.delete(classId);
      fetchWithFallback().catch(() => {});
      return () => {
        cancelled = true;
      };
    }
    
    // Check if we've already fetched for this classId + faceVersion combination
    if (
      lastFetchedRef.current.classId === classId &&
      lastFetchedRef.current.faceVersion === currentFaceVersion
    ) {
      // Already fetched for this exact combination - use cache if available
      const cached = faceCountsCache.get(classId);
      if (cached) {
        setFaceCountsFromApi(cached.counts);
        setFaceCountsLoading(false);
        return;
      }
    }
    
    // Check cache first (only if faceVersion hasn't changed)
    const cached = faceCountsCache.get(classId);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Use cached data immediately
      setFaceCountsFromApi(cached.counts);
      setFaceCountsLoading(false);
      lastFetchedRef.current = { classId, faceVersion: currentFaceVersion };
      return; // Don't fetch again - use cache
    }
    
    // No cache or expired - fetch immediately (with fallback)
    fetchWithFallback().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [classId, backendFace.faceVersion, user?.id, backendFace.getFaceCountsForClassAsync, getStudentsByClass]);

  // Only when faceCountsFromApi is not null have we received API result

  const notEnrolledCount =
    !classId || faceCountsFromApi === null
      ? null // Still loading - haven't received API result yet - show loading indicator
      : (() => {
          const count = Math.max(
            0,
            classStudents.reduce((acc, s) => {
              const studentCount = faceCountsFromApi[s.id] ?? 0;
              // Debug: log if student has zero count
              if (studentCount === 0 && classStudents.length <= 3) {
                console.log(`[Dashboard] Student ${s.id} (${s.firstName} ${s.lastName}) has count: ${studentCount}`);
              }
              return acc + (studentCount > 0 ? 0 : 1);
            }, 0)
          );
          if (count > 0 && classStudents.length <= 3) {
            console.log(`[Dashboard] Not enrolled count: ${count}, total students: ${classStudents.length}`);
          }
          return count;
        })();
  
  const todayAttendance = classId ? getTodayAttendance(classId) : [];
  const stats = classId ? getAttendanceStats(classId) : { present: 0, late: 0, absent: 0, total: 0 };
  
  // Only show loading for critical data (classrooms/students), not enrolledIds
  const isLoading = classroomsLoading || studentsLoading;

  const presentToday = todayAttendance.filter(a => a.status === 'present').length;
  const lateToday = todayAttendance.filter(a => a.status === 'late').length;
  const attendedToday = presentToday + lateToday;
  const hasStartedAttendanceToday = todayAttendance.length > 0;
  const absentToday = hasStartedAttendanceToday ? Math.max(0, classStudents.length - attendedToday) : 0;
  const [showClassSettings, setShowClassSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [classNameDraft, setClassNameDraft] = useState('');
  const [lateGraceDraft, setLateGraceDraft] = useState('15');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 min-w-0">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onNavigate('classroom')}
                className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
                title="กลับไปเลือกห้องเรียน"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">ระบบเช็คชื่อ</h1>
                {displayClassName && (
                  <p className="text-xs text-gray-500 hidden sm:block">
                    ห้อง {displayClassName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('classroom')}
                className="text-gray-600 text-xs sm:text-sm px-2 sm:px-3"
              >
                <School className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">เปลี่ยนห้อง</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setClassNameDraft(selectedClass?.name ?? '');
                  setLateGraceDraft(String(selectedClass?.lateGraceMinutes ?? 15));
                  setShowClassSettings(true);
                }}
                className="text-gray-600 text-xs sm:text-sm px-2 sm:px-3 hidden md:flex"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">ตั้งค่าห้องเรียน</span>
              </Button>
              <span className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" aria-hidden />
              <span className="flex items-center gap-1 text-xs sm:text-sm text-gray-700 max-w-[120px] sm:max-w-none">
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
                className="text-gray-600 hover:text-red-600"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ตั้งค่าห้องเรียน (อยู่ข้างในห้องเรียน) */}
      <Dialog open={showClassSettings} onOpenChange={setShowClassSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ตั้งค่าห้องเรียน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-sm text-gray-500">ห้องที่กำลังใช้งาน</p>
              <p className="text-lg font-bold text-gray-800">
                {selectedClass ? selectedClass.name : classId}
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="font-semibold text-gray-800">แก้ไขชื่อห้องเรียน</p>
              <div className="space-y-2">
                <Label htmlFor="class-name-edit">ชื่อห้องเรียน</Label>
                <Input
                  id="class-name-edit"
                  value={classNameDraft}
                  onChange={(e) => setClassNameDraft(e.target.value)}
                  placeholder="เช่น ม.1/2"
                />
              </div>
              <Button
                className="w-full"
                disabled={!classNameDraft.trim() || !selectedClassId}
                onClick={() => {
                  if (!selectedClassId) return;
                  updateClassroomName(selectedClassId, classNameDraft);
                  setShowClassSettings(false);
                }}
              >
                บันทึกชื่อใหม่
              </Button>
              <p className="text-xs text-gray-500">
                ชื่อห้องจะถูกอัปเดตในหน้าห้องเรียนและหัวข้อด้านบนทันที
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="font-semibold text-gray-800">ตั้งค่าเวลา “มาสาย”</p>
              <div className="space-y-2">
                <Label htmlFor="late-grace-minutes">มาสายเมื่อเกิน (นาที)</Label>
                <Input
                  id="late-grace-minutes"
                  inputMode="numeric"
                  type="number"
                  min={0}
                  max={180}
                  value={lateGraceDraft}
                  onChange={(e) => setLateGraceDraft(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!selectedClassId}
                onClick={() => {
                  if (!selectedClassId) return;
                  const minutes = Number(lateGraceDraft);
                  updateLateGraceMinutes(selectedClassId, minutes);
                  setShowClassSettings(false);
                }}
              >
                บันทึกเวลาใหม่
              </Button>
              <p className="text-xs text-gray-500">
                ค่านี้ใช้ตอนเช็คชื่อ: ภายใน X นาที = เข้าเรียนแล้ว, เกิน X นาที = มาสาย
              </p>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-700">โซนอันตราย</p>
              <p className="text-sm text-red-600 mt-1">
                การลบห้องจะลบข้อมูลใบหน้าและประวัติการเช็คชื่อของห้องนี้ในเครื่อง
              </p>
              <Button
                variant="outline"
                className="mt-3 w-full text-red-700 border-red-200 hover:bg-red-100"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบห้องเรียนนี้
              </Button>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={() => setShowClassSettings(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm ลบห้องเรียน */} 
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันลบห้องเรียน</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบห้อง <strong>{selectedClass ? selectedClass.name : classId}</strong> ใช่ไหม?
              <br />
              ระบบจะลบข้อมูลใบหน้าและประวัติการเช็คชื่อของห้องนี้ในเครื่อง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!classId) {
                  setShowDeleteConfirm(false);
                  setShowClassSettings(false);
                  return;
                }
                deleteClassroom(classId);
                setShowDeleteConfirm(false);
                setShowClassSettings(false);
                onNavigate('classroom');
              }}
            >
              ลบห้องเรียน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 py-6 lg:py-8 min-w-0">
        {/* Stats Cards — จอ 1024px แสดง 2 คอลัมน์, 1280px+ แสดง 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">นักเรียนทั้งหมด</p>
                  {isLoading ? (
                    <div className="h-9 w-16 bg-blue-400/50 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-3xl font-bold">{classStudents.length}</p>
                  )}
                </div>
                <Users className="w-10 h-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">ยังไม่ได้ลงทะเบียนใบหน้า</p>
                  {(isLoading || faceCountsLoading || notEnrolledCount === null) ? (
                    <div className="h-9 w-16 bg-green-400/50 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-3xl font-bold">{notEnrolledCount}</p>
                  )}
                </div>
                <UserCheck className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">มาเรียนวันนี้</p>
                  {isLoading ? (
                    <div className="h-9 w-16 bg-emerald-400/50 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-3xl font-bold">{attendedToday}</p>
                  )}
                </div>
                <TrendingUp className="w-10 h-10 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">ขาดเรียนวันนี้</p>
                  {isLoading ? (
                    <div className="h-9 w-16 bg-red-400/50 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-3xl font-bold">{absentToday}</p>
                  )}
                </div>
                <UserX className="w-10 h-10 text-red-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          เมนูหลัก{displayClassName ? ` - ห้อง ${displayClassName}` : ''}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
            onClick={() => onNavigate('attendance')}
          >
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-800">เช็คชื่อด้วยใบหน้า</h3>
              <p className="text-sm text-gray-500 mt-2">สแกนใบหน้านักเรียนเพื่อเช็คชื่อ</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-green-500"
            onClick={() => onNavigate('enroll')}
          >
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-800">ลงทะเบียนใบหน้า</h3>
              <p className="text-sm text-gray-500 mt-2">เพิ่มข้อมูลใบหน้านักเรียน</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-purple-500"
            onClick={() => onNavigate('students')}
          >
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-800">จัดการนักเรียน</h3>
              <p className="text-sm text-gray-500 mt-2">ดูและแก้ไขข้อมูลนักเรียน</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-orange-500"
            onClick={() => onNavigate('reports')}
          >
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-bold text-gray-800">รายงาน</h3>
              <p className="text-sm text-gray-500 mt-2">ดูสถิติและรายงานการเข้าเรียน</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Attendance Preview */}
        <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">สรุปการเข้าเรียนวันนี้</h2>
        <Card>
          <CardContent className="p-6">
            {todayAttendance.length > 0 ? (
              <div className="space-y-2">
                {todayAttendance.slice(0, 5).map((record) => (
                  <div 
                    key={record.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        record.status === 'present' ? 'bg-green-500' :
                        record.status === 'late' ? 'bg-yellow-500' :
                        record.status === 'excused' ? 'bg-blue-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium">{record.studentName}</span>
                      {record.faceRecognized && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          จดจำใบหน้า
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      record.status === 'present' ? 'text-green-600' :
                      record.status === 'late' ? 'text-yellow-600' :
                      record.status === 'excused' ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {record.status === 'present' ? 'มาเรียน' :
                       record.status === 'late' ? 'มาสาย' :
                       record.status === 'excused' ? 'ลา' : 'ขาด'}
                    </span>
                  </div>
                ))}
                {todayAttendance.length > 5 && (
                  <p className="text-center text-sm text-gray-500 mt-2">
                    และอีก {todayAttendance.length - 5} รายการ...
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>ยังไม่มีการเช็คชื่อวันนี้</p>
                <Button 
                  className="mt-4" 
                  onClick={() => onNavigate('attendance')}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  เริ่มเช็คชื่อ
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
