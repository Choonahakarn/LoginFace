import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClassRoom } from '@/hooks/useClassRoom';
import { useStudents } from '@/hooks/useStudents';
import { useBackendFace } from '@/hooks/useBackendFace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Search, 
  Plus, 
  UserCheck, 
  UserX, 
  Edit, 
  Trash2,
  ArrowLeft,
  GraduationCap,
  User,
  LogOut
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentManagementSectionProps {
  onBack: () => void;
  onNavigateToEnroll?: (studentId: string) => void;
}

export function StudentManagementSection({ onBack, onNavigateToEnroll }: StudentManagementSectionProps) {
  const { authUser, signOut } = useAuth();
  const { selectedClassId, selectedClass, classrooms } = useClassRoom();
  
  // Get classroom name directly from classrooms array to avoid showing placeholder
  const currentClassroom = selectedClassId ? classrooms.find(c => c.id === selectedClassId) : null;
  const displayClassName = currentClassroom?.name || selectedClass?.name || '';
  const classId = selectedClassId ?? 'class-1';
  const { students, addStudent, updateStudent, deleteStudent } = useStudents();
  const backendFace = useBackendFace();
  const [faceCounts, setFaceCounts] = useState<Record<string, number>>({});
  const [faceCountsLoading, setFaceCountsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setFaceCountsLoading(true);

    // Fast path: one request returns counts for whole class
    backendFace
      .getFaceCountsForClassAsync(classId)
      .then((counts) => {
        if (cancelled) return;
        setFaceCounts(counts);
      })
      .catch(async () => {
        // Fallback: older backend (no /counts) — compute counts for enrolled IDs (slower)
        const ids = await backendFace.getEnrolledStudentIdsAsync(classId).catch(() => []);
        const counts: Record<string, number> = {};
        await Promise.all(
          ids.map(async (id) => {
            const c = await backendFace.getFaceEnrollmentCount(classId, id).catch(() => 0);
            counts[id] = c;
          })
        );
        if (!cancelled) setFaceCounts(counts);
      })
      .finally(() => {
        if (!cancelled) setFaceCountsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classId, backendFace, backendFace.faceVersion]);

  const getFaceCount = useCallback((studentId: string) => faceCounts[studentId] ?? 0, [faceCounts]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<{
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const [newStudent, setNewStudent] = useState({
    studentId: '',
    firstName: '',
    lastName: ''
  });

  const filteredStudents = students
    .filter(student => student.classIds.includes(classId))
    .filter(student =>
      student.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleAddStudent = async () => {
    if (newStudent.studentId && newStudent.firstName && newStudent.lastName) {
      try {
        await addStudent({
          studentId: newStudent.studentId,
          firstName: newStudent.firstName,
          lastName: newStudent.lastName,
          status: 'active',
          classIds: [classId]
        });
        setNewStudent({ studentId: '', firstName: '', lastName: '' });
        setIsAddDialogOpen(false);
      } catch (error) {
        console.error('Error adding student:', error);
        const msg = error instanceof Error ? error.message : String(error);
        const displayMsg = msg.includes('รหัสนักเรียน') ? msg : 'เพิ่มนักเรียนไม่สำเร็จ: ' + msg;
        toast.error(displayMsg, { duration: 5000 });
      }
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบนักเรียนคนนี้?')) return;
    const student = students.find(s => s.id === id);
    if (student) {
      for (const cid of student.classIds) {
        try {
          await backendFace.removeFaceEnrollment(cid, id);
        } catch {
          // ignore
        }
      }
    }
    deleteStudent(id);
    setFaceCounts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRemoveFace = async (id: string) => {
    if (!confirm('ลบข้อมูลใบหน้าของนักเรียนคนนี้? หลังลบแล้วสามารถลงทะเบียนใบหน้าใหม่ได้')) return;
    try {
      await backendFace.removeFaceEnrollment(classId, id);
      setFaceCounts(prev => ({ ...prev, [id]: 0 }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ลบไม่สำเร็จ';
      alert(`ลบข้อมูลใบหน้าไม่สำเร็จ: ${msg}\n\nกรุณาตรวจสอบว่า Backend รันอยู่ (พอร์ต 8000) แล้วลองใหม่`);
    }
  };

  const handleOpenEdit = (student: typeof students[0]) => {
    setEditingStudent({
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    if (!editingStudent.studentId.trim() || !editingStudent.firstName.trim() || !editingStudent.lastName.trim()) return;
    try {
      await updateStudent(editingStudent.id, {
        studentId: editingStudent.studentId.trim(),
        firstName: editingStudent.firstName.trim(),
        lastName: editingStudent.lastName.trim()
      });
      setEditingStudent(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg.includes('รหัสนักเรียน') ? msg : 'แก้ไขนักเรียนไม่สำเร็จ: ' + msg, { duration: 5000 });
    }
  };

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
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">จัดการนักเรียน</h1>
                {displayClassName && (
                  <p className="text-xs text-gray-500 hidden sm:block">
                    เฉพาะห้อง {displayClassName} — รายชื่อและใบหน้าแยกตามห้อง (บันทึกในเครื่อง)
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
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 py-6 lg:py-8 min-w-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>รายชื่อนักเรียน</CardTitle>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มนักเรียน
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>เพิ่มนักเรียนใหม่</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>รหัสนักเรียน</Label>
                    <Input
                      placeholder="เช่น STD006"
                      value={newStudent.studentId}
                      onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ชื่อ</Label>
                    <Input
                      placeholder="ชื่อ"
                      value={newStudent.firstName}
                      onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>นามสกุล</Label>
                    <Input
                      placeholder="นามสกุล"
                      value={newStudent.lastName}
                      onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleAddStudent} className="w-full">
                    บันทึก
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>แก้ไขข้อมูลนักเรียน</DialogTitle>
                </DialogHeader>
                {editingStudent && (
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>รหัสนักเรียน</Label>
                      <Input
                        placeholder="เช่น STD001"
                        value={editingStudent.studentId}
                        onChange={(e) => setEditingStudent({ ...editingStudent, studentId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ชื่อ</Label>
                      <Input
                        placeholder="ชื่อ"
                        value={editingStudent.firstName}
                        onChange={(e) => setEditingStudent({ ...editingStudent, firstName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>นามสกุล</Label>
                      <Input
                        placeholder="นามสกุล"
                        value={editingStudent.lastName}
                        onChange={(e) => setEditingStudent({ ...editingStudent, lastName: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleSaveEdit} className="w-full">
                      บันทึกการแก้ไข
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="ค้นหานักเรียน..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ใบหน้า</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.studentId}</TableCell>
                        <TableCell>
                          {student.firstName} {student.lastName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                            {student.status === 'active' ? 'กำลังศึกษา' : 
                             student.status === 'graduated' ? 'จบการศึกษา' : 
                             student.status === 'transferred' ? 'ย้ายสถานศึกษา' : 'ไม่active'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {faceCountsLoading ? (
                            <span className="text-sm text-gray-400">กำลังโหลด...</span>
                          ) : getFaceCount(student.id) > 0 ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onNavigateToEnroll?.(student.id)}
                                className={`flex items-center gap-2 text-left transition-colors ${
                                  onNavigateToEnroll
                                    ? 'cursor-pointer hover:text-green-700 hover:underline'
                                    : 'cursor-default'
                                }`}
                                title={onNavigateToEnroll ? 'คลิกเพื่อดู/จัดการใบหน้าที่ลงทะเบียน' : undefined}
                              >
                                <UserCheck className="w-4 h-4 text-green-500 shrink-0" />
                                <span className="text-sm text-green-600">
                                  {getFaceCount(student.id)} รูป
                                </span>
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveFace(student.id)}
                                title="ลบข้อมูลใบหน้า เพื่อลงทะเบียนใหม่"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <UserX className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="text-sm text-gray-500">ยังไม่ลงทะเบียน</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="แก้ไข"
                              onClick={() => handleOpenEdit(student)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteStudent(student.id)}
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        ไม่พบข้อมูลนักเรียน
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
