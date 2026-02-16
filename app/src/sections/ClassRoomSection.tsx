import { useState } from 'react';
import { useClassRoom } from '@/hooks/useClassRoom';
import { useStudents } from '@/hooks/useStudents';
import { useAuth } from '@/hooks/useAuth';
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
import { BookOpen, GraduationCap, Plus, School, ChevronRight, Search, User, LogOut } from 'lucide-react';
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
  const { classrooms, selectedClassId, setSelectedClassId, addClassroom, loading: classroomsLoading } = useClassRoom();
  const { students, updateStudent, loading: studentsLoading } = useStudents();
  const { user, authUser, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClassrooms = searchQuery.trim()
    ? classrooms.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : classrooms;

  const handleCreateClass = async () => {
    const name = newClassName.trim();
    if (!name) return;
    
    // รอให้ auth loading เสร็จก่อน
    if (authLoading) {
      alert('กำลังตรวจสอบการ Login กรุณารอสักครู่...');
      return;
    }
    
    // ตรวจสอบ authentication
    if (!isAuthenticated) {
      alert('กรุณา Login ก่อนสร้างห้องเรียน');
      console.error('User not authenticated:', { isAuthenticated, user, authLoading });
      return;
    }
    
    if (classroomsLoading) {
      alert('กำลังโหลดข้อมูลห้องเรียน กรุณารอสักครู่...');
      return;
    }
    
    try {
      const isFirstClass = classrooms.length === 0;
      const newClass = await addClassroom(name);
      // เมื่อสร้างห้องแรก ให้เพิ่มนักเรียนที่มีอยู่ (รวม mock) เข้าห้องนี้
      if (isFirstClass) {
        for (const s of students) {
          if (!s.classIds.includes(newClass.id)) {
            await updateStudent(s.id, { classIds: [...s.classIds, newClass.id] });
          }
        }
      }
      setSelectedClassId(newClass.id);
      setNewClassName('');
      setShowAddDialog(false);
    } catch (error) {
      console.error('Error creating classroom:', error);
      alert('สร้างห้องเรียนไม่สำเร็จ: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleUseClass = (classId: string) => {
    setSelectedClassId(classId);
    onEnter();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 min-w-0">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <School className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">ห้องเรียน {APP_VERSION}</h1>
                <p className="text-xs text-gray-500 hidden sm:block">เลือกหรือสร้างห้องเพื่อเช็คชื่อ</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setShowManualDialog(true)}
              >
                <BookOpen className="w-3 h-3 sm:w-5 sm:h-5 sm:mr-2" />
                <span className="hidden sm:inline">คู่มือการใช้งาน</span>
              </Button>
              <a
                href={FACEBOOK_CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={`ติดต่อปัญหา / สอบถาม: Facebook ${FACEBOOK_CONTACT_NAME}`}
                className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-md text-[#1877F2] hover:bg-blue-50 transition-colors flex-shrink-0"
              >
                <FacebookIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600 text-xl">
              <BookOpen className="w-6 h-6" />
              คู่มือการใช้งานระบบเช็คชื่อด้วยใบหน้า
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
            {/* 1. สร้างห้องเรียน */}
            <section className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                สร้างห้องเรียน
              </h3>
              <div className="space-y-2 ml-8">
                <p className="font-medium text-gray-800">ขั้นตอนการสร้างห้องเรียน:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-700">
                  <li>กดปุ่ม <strong>"สร้างห้องเรียน"</strong> ที่มุมซ้ายบนของหน้าจอ</li>
                  <li>กรอกชื่อห้องเรียน เช่น <code className="bg-gray-100 px-1 rounded">ม.1/5</code>, <code className="bg-gray-100 px-1 rounded">ม.4/2</code></li>
                  <li>กดปุ่ม <strong>"สร้างห้องเรียน"</strong> เพื่อยืนยัน</li>
                  <li>ระบบจะสร้างห้องเรียนใหม่และเลือกห้องนั้นให้อัตโนมัติ</li>
                </ol>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800"><strong>💡 คำแนะนำ:</strong> สามารถสร้างได้หลายห้องเพื่อแยกตามชั้นเรียนหรือวิชา</p>
                </div>
              </div>
            </section>

            {/* 2. เลือกห้องเรียน */}
            <section className="border-l-4 border-green-500 pl-4">
              <h3 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                เลือกห้องเรียน
              </h3>
              <div className="space-y-2 ml-8">
                <p className="font-medium text-gray-800">วิธีเลือกห้องเรียน:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-700">
                  <li>ดูรายการห้องเรียนที่มีอยู่ด้านล่าง</li>
                  <li>ใช้ช่องค้นหาเพื่อหาห้องที่ต้องการ (พิมพ์ชื่อห้อง เช่น "ม.1")</li>
                  <li>คลิกที่การ์ดห้องเรียนที่ต้องการ</li>
                  <li>กดปุ่ม <strong>"ใช้ห้องนี้"</strong> เพื่อเข้าไปยังเมนูหลักของห้องนั้น</li>
                </ol>
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-green-800"><strong>💡 คำแนะนำ:</strong> ห้องที่เลือกอยู่จะมีกรอบสีน้ำเงิน</p>
                </div>
              </div>
            </section>

            {/* 3. จัดการนักเรียน */}
            <section className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                จัดการนักเรียน
              </h3>
              <div className="space-y-2 ml-8">
                <p className="font-medium text-gray-800">หลังจากเข้าไปยังห้องแล้ว:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-700">
                  <li>ไปที่เมนู <strong>"จัดการนักเรียน"</strong> ในเมนูหลัก</li>
                  <li>กดปุ่ม <strong>"เพิ่มนักเรียน"</strong> เพื่อเพิ่มรายชื่อใหม่</li>
                  <li>กรอกข้อมูล: รหัสนักเรียน, ชื่อ, นามสกุล (ข้อมูลอื่นเป็นตัวเลือก)</li>
                  <li>กด <strong>"บันทึก"</strong> เพื่อเพิ่มนักเรียน</li>
                  <li>สามารถแก้ไขหรือลบข้อมูลนักเรียนได้โดยคลิกที่รายชื่อ</li>
                </ol>
                <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-800"><strong>⚠️ หมายเหตุ:</strong> รหัสนักเรียนต้องไม่ซ้ำกันในห้องเดียวกัน</p>
                </div>
              </div>
            </section>

            {/* 4. ลงทะเบียนใบหน้า */}
            <section className="border-l-4 border-orange-500 pl-4">
              <h3 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">4</span>
                ลงทะเบียนใบหน้า
              </h3>
              <div className="space-y-2 ml-8">
                <p className="font-medium text-gray-800">ขั้นตอนการลงทะเบียนใบหน้า:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-700">
                  <li>ไปที่เมนู <strong>"ลงทะเบียนใบหน้า"</strong></li>
                  <li>เลือกนักเรียนที่ต้องการลงทะเบียนจากรายการ</li>
                  <li>กดปุ่ม <strong>"เปิดกล้อง"</strong> เพื่อเริ่มต้น</li>
                  <li>ให้นักเรียนมองตรงที่กล้องและสแกนใบหน้า <strong>อย่างน้อย 5 ครั้ง</strong></li>
                  <li>ระบบจะแสดงจำนวนที่สแกนแล้ว (เช่น 3/5, 4/5, 5/5)</li>
                  <li>เมื่อครบ 5 ครั้งแล้ว จะสามารถเช็คชื่อได้</li>
                </ol>
                <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-800"><strong>💡 คำแนะนำ:</strong> ให้สแกนในมุมที่แตกต่างกันเพื่อความแม่นยำ (มองตรง, มองซ้าย, มองขวา, มองขึ้น, มองลง)</p>
                </div>
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs text-red-800 font-semibold mb-1"><strong>⚠️ ข้อกำหนดสำคัญ:</strong></p>
                  <p className="text-xs text-red-800"><strong>ต้องลงทะเบียนให้ครบ 5 รูปก่อน ถึงจะสแกนเช็คชื่อได้</strong></p>
                  <p className="text-xs text-red-700 mt-1">หากยังไม่ครบ 5 รูป ระบบจะไม่สามารถเช็คชื่อได้ ต้องกลับมาลงทะเบียนให้ครบก่อน</p>
                </div>
              </div>
            </section>

            {/* 5. เช็คชื่อด้วยใบหน้า */}
            <section className="border-l-4 border-red-500 pl-4">
              <h3 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">5</span>
                เช็คชื่อด้วยใบหน้า
              </h3>
              <div className="space-y-2 ml-8">
                <p className="font-medium text-gray-800">ขั้นตอนการเช็คชื่อ:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-700">
                  <li>ไปที่เมนู <strong>"เช็คชื่อด้วยใบหน้า"</strong></li>
                  <li>กดปุ่ม <strong>"เปิดกล้อง"</strong></li>
                  <li>กดปุ่ม <strong>"เริ่มสแกน"</strong> เพื่อเริ่มต้นการเช็คชื่อ</li>
                  <li>ให้นักเรียนมองตรงที่กล้องและ<strong>กระพริบตาหนึ่งครั้ง</strong></li>
                  <li>ระบบจะจดจำใบหน้าและบันทึกการเช็คชื่ออัตโนมัติ</li>
                  <li>ดูสถานะการเช็คชื่อได้ที่ด้านขวา (มาเรียนแล้ว, มาสาย, ขาดเรียน)</li>
                  <li>กดปุ่ม <strong>"หยุดสแกน"</strong> เมื่อเสร็จสิ้น</li>
                </ol>
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs text-red-800"><strong>⏱️ การบันทึกเวลา:</strong> ระบบจะบันทึกเวลาที่แน่นอน (ชั่วโมง:นาที:วินาที) ของการเช็คชื่อ</p>
                  <p className="text-xs text-red-800 mt-1"><strong>📊 สถานะ:</strong> ภายใน X นาที = เข้าเรียนแล้ว, เกิน X นาที = มาสาย (ค่า X ตั้งได้ในเมนูตั้งค่าห้องเรียน)</p>
                </div>
              </div>
            </section>

            {/* 6. ดูรายงาน */}
            <section className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                <span className="bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">6</span>
                ดูรายงาน
              </h3>
              <div className="space-y-2 ml-8">
                <p className="font-medium text-gray-800">รายงานที่สามารถดูได้:</p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-700">
                  <li><strong>รายงานรายวัน:</strong> สรุปการเช็คชื่อแต่ละวัน แสดงสถานะมา/สาย/ขาด</li>
                  <li><strong>รายงานรายเดือน:</strong> สรุปยอดรวมทั้งเดือน พร้อมสถิติและกราฟ</li>
                  <li><strong>ตารางเช็คชื่อ:</strong> ดูตารางแบบตารางเวลา แสดงรายชื่อนักเรียนและสถานะแต่ละวัน</li>
                </ul>
                <p className="font-medium text-gray-800 mt-3">การดาวน์โหลด:</p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-700">
                  <li>สามารถดาวน์โหลดเป็น <strong>PDF</strong> สำหรับพิมพ์</li>
                  <li>ดาวน์โหลดเป็น <strong>Excel</strong> สำหรับแก้ไขข้อมูล</li>
                  <li>บันทึกเป็น <strong>รูปภาพ</strong> สำหรับแชร์</li>
                </ul>
              </div>
            </section>

            {/* ข้อมูลเพิ่มเติม */}
            <section className="border-l-4 border-gray-400 pl-4">
              <h3 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                <span className="bg-gray-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">!</span>
                ข้อมูลเพิ่มเติม
              </h3>
              <div className="space-y-2 ml-8">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-800 mb-2">🔒 ความเป็นส่วนตัว:</p>
                  <p className="text-xs text-gray-700">ระบบไม่เก็บรูปภาพจริง แต่เก็บเฉพาะข้อมูลลายลักษณ์ใบหน้า (Face Embedding) เพื่อความปลอดภัยและความเป็นส่วนตัว</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mt-2">
                  <p className="font-medium text-gray-800 mb-2">⚙️ ตั้งค่าห้องเรียน:</p>
                  <p className="text-xs text-gray-700">สามารถแก้ไขชื่อห้องและตั้งค่าเวลามาสายได้ที่ปุ่ม "ตั้งค่าห้องเรียน" ในเมนูหลัก</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mt-2">
                  <p className="font-medium text-gray-800 mb-2">🔄 เปลี่ยนห้อง:</p>
                  <p className="text-xs text-gray-700">กดปุ่ม "เปลี่ยนห้อง" หรือปุ่มย้อนกลับ (←) เพื่อกลับไปเลือกห้องเรียนอื่น</p>
                </div>
              </div>
            </section>

            {/* ติดต่อ */}
            <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-blue-600">📞</span>
                ติดต่อปัญหา / สอบถาม
              </h3>
              <p className="text-sm text-gray-700 mb-2">หากพบปัญหาหรือต้องการความช่วยเหลือ ติดต่อได้ที่:</p>
              <div className="flex items-center gap-2">
                <FacebookIcon className="w-5 h-5 text-[#1877F2]" />
                <span className="font-medium text-gray-800">{FACEBOOK_CONTACT_NAME}</span>
              </div>
              <a
                href={FACEBOOK_CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#1877F2] hover:underline font-medium mt-2"
              >
                <FacebookIcon className="w-5 h-5" />
                เปิด Facebook เพื่อติดต่อ
              </a>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowManualDialog(false)} className="w-full sm:w-auto">ปิด</Button>
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
