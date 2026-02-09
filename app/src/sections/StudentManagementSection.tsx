import { useState, useEffect, useCallback } from 'react';
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
  GraduationCap
} from 'lucide-react';

interface StudentManagementSectionProps {
  onBack: () => void;
  onNavigateToEnroll?: (studentId: string) => void;
}

export function StudentManagementSection({ onBack, onNavigateToEnroll }: StudentManagementSectionProps) {
  const { selectedClassId, selectedClass } = useClassRoom();
  const classId = selectedClassId ?? 'class-1';
  const { students, addStudent, updateStudent, deleteStudent } = useStudents();
  const backendFace = useBackendFace();
  const [faceCounts, setFaceCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    backendFace.getEnrolledStudentIdsAsync(classId).then(async ids => {
      const counts: Record<string, number> = {};
      await Promise.all(
        ids.map(async id => {
          const c = await backendFace.getFaceEnrollmentCount(classId, id);
          counts[id] = c;
        })
      );
      setFaceCounts(prev => ({ ...prev, ...counts }));
    });
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

  const handleAddStudent = () => {
    if (newStudent.studentId && newStudent.firstName && newStudent.lastName) {
      addStudent({
        studentId: newStudent.studentId,
        firstName: newStudent.firstName,
        lastName: newStudent.lastName,
        status: 'active',
        classIds: [classId]
      });
      setNewStudent({ studentId: '', firstName: '', lastName: '' });
      setIsAddDialogOpen(false);
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

  const handleSaveEdit = () => {
    if (!editingStudent) return;
    if (!editingStudent.studentId.trim() || !editingStudent.firstName.trim() || !editingStudent.lastName.trim()) return;
    updateStudent(editingStudent.id, {
      studentId: editingStudent.studentId.trim(),
      firstName: editingStudent.firstName.trim(),
      lastName: editingStudent.lastName.trim()
    });
    setEditingStudent(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 min-w-0">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">จัดการนักเรียน</h1>
                <p className="text-xs text-gray-500">
                  {selectedClass ? `เฉพาะห้อง ${selectedClass.name}` : 'เฉพาะห้องที่เลือก'} — รายชื่อและใบหน้าแยกตามห้อง (บันทึกในเครื่อง)
                </p>
              </div>
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
                          {getFaceCount(student.id) > 0 ? (
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
