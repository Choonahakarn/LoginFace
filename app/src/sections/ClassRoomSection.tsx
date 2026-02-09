import { useState } from 'react';
import { useClassRoom } from '@/hooks/useClassRoom';
import { useStudents } from '@/hooks/useStudents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, GraduationCap, Plus, School, ChevronRight, Search } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants';

const FACEBOOK_CONTACT_URL = 'https://www.facebook.com/MasterPe.ELLIE';
const FACEBOOK_CONTACT_NAME = 'Chunhakran Putpa';

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

interface ClassRoomSectionProps {
  onEnter: () => void;
}

export function ClassRoomSection({ onEnter }: ClassRoomSectionProps) {
  const { classrooms, selectedClassId, setSelectedClassId, addClassroom } = useClassRoom();
  const { students, updateStudent } = useStudents();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClassrooms = searchQuery.trim()
    ? classrooms.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : classrooms;

  const handleCreateClass = () => {
    const name = newClassName.trim();
    if (!name) return;
    const isFirstClass = classrooms.length === 0;
    const newClass = addClassroom(name);
    // เมื่อสร้างห้องแรก ให้เพิ่มนักเรียนที่มีอยู่ (รวม mock) เข้าห้องนี้
    if (isFirstClass) {
      students.forEach((s) => {
        if (!s.classIds.includes(newClass.id)) {
          updateStudent(s.id, { classIds: [...s.classIds, newClass.id] });
        }
      });
    }
    setSelectedClassId(newClass.id);
    setNewClassName('');
    setShowAddDialog(false);
  };

  const handleUseClass = (classId: string) => {
    setSelectedClassId(classId);
    onEnter();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 min-w-0">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <School className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">ห้องเรียน {APP_VERSION}</h1>
                <p className="text-xs text-gray-500">เลือกหรือสร้างห้องเพื่อเช็คชื่อ</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => setShowManualDialog(true)}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                คู่มือการใช้งาน
              </Button>
              <a
                href={FACEBOOK_CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={`ติดต่อปัญหา / สอบถาม: Facebook ${FACEBOOK_CONTACT_NAME}`}
                className="inline-flex items-center justify-center w-10 h-10 rounded-md text-[#1877F2] hover:bg-blue-50 transition-colors"
              >
                <FacebookIcon className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 py-6 lg:py-8 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              เลือกหรือสร้างห้องเรียน
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              สร้างห้องเรียนใหม่ หรือเลือกห้องที่มีอยู่เพื่อเข้าไปเช็คชื่อตามห้องนั้น
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={() => setShowAddDialog(true)}
              className="w-full sm:w-auto"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              สร้างห้องเรียน
            </Button>

            {classrooms.length > 0 ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="search"
                    placeholder="ค้นหาชื่อห้อง... เช่น ม.1, ม.4/5"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <h3 className="text-sm font-medium text-gray-700">ห้องเรียนที่มี</h3>
                <ul className="space-y-2">
                  {filteredClassrooms.length > 0 ? (
                    filteredClassrooms.map((c) => (
                    <li key={c.id}>
                      <Card
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedClassId === c.id
                            ? 'ring-2 ring-blue-500 bg-blue-50/50'
                            : 'hover:border-blue-200'
                        }`}
                        onClick={() => setSelectedClassId(c.id)}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                              <School className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{c.name}</p>
                              <p className="text-xs text-gray-500">ห้องเรียน</p>
                            </div>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUseClass(c.id);
                            }}
                          >
                            ใช้ห้องนี้
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    </li>
                    ))
                  ) : (
                    <li className="text-center py-8 text-gray-500">
                      ไม่พบห้องที่ตรงกับคำค้นหา
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50">
                <School className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 mb-4">ยังไม่มีห้องเรียน</p>
                <Button onClick={() => setShowAddDialog(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  สร้างห้องเรียนแรก
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog คู่มือการใช้งาน */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <BookOpen className="w-5 h-5" />
              คู่มือการใช้งาน
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">1. เลือกหรือสร้างห้องเรียน</h3>
              <p>กด "สร้างห้องเรียน" เพื่อเพิ่มห้องใหม่ หรือเลือกห้องที่มีอยู่แล้ว แล้วกด "ใช้ห้องนี้"</p>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">2. จัดการนักเรียน</h3>
              <p>หลังเข้าไปยังห้อง ไปที่ "จัดการนักเรียน" เพื่อเพิ่ม/แก้ไขรายชื่อนักเรียนในห้อง</p>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">3. ลงทะเบียนใบหน้า</h3>
              <p>ไปที่ "ลงทะเบียนใบหน้า" เพื่อให้นักเรียนสแกนใบหน้าครั้งแรก — ระบบจะเก็บข้อมูลใบหน้าเพื่อใช้เช็คชื่อ</p>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">4. สแกนเช็คชื่อ</h3>
              <p>ไปที่ "สแกนเช็คชื่อ" เพื่อเปิดกล้องให้นักเรียนสแกนใบหน้าเช็คชื่อประจำวัน — กด "หยุดสแกน" เมื่อเสร็จสิ้น</p>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">5. รายงาน</h3>
              <p>ไปที่ "รายงาน" เพื่อดูสรุปการมาเรียน และดาวน์โหลด PDF หรือ Excel ได้</p>
            </section>
            <section className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <h3 className="font-semibold text-gray-800 mb-2">ติดต่อปัญหา / สอบถาม</h3>
              <p className="mb-2">ติดต่อได้ที่ Facebook: {FACEBOOK_CONTACT_NAME}</p>
              <a
                href={FACEBOOK_CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#1877F2] hover:underline font-medium"
              >
                <FacebookIcon className="w-5 h-5" />
                เปิด Facebook
              </a>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowManualDialog(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog สร้างห้องเรียน */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้างห้องเรียน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="class-name">ชื่อห้องเรียน</Label>
              <Input
                id="class-name"
                placeholder="เช่น ม.1/2, ม.1/5, ม.4/5"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateClass()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleCreateClass} disabled={!newClassName.trim()}>
              สร้างห้องเรียน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
