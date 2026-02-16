import { useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClassRoom } from '@/hooks/useClassRoom';
import { useStudents } from '@/hooks/useStudents';
import { useAttendance } from '@/hooks/useAttendance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  FileImage,
  FileText,
  TrendingUp,
  GraduationCap,
  UserCircle,
  User,
  LogOut,
} from 'lucide-react';
import { BuddhistCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { APP_VERSION } from '@/lib/constants';

interface ReportsSectionProps {
  onBack: () => void;
}

function statusLabel(s: string) {
  return s === 'present' ? 'มาเรียน' : s === 'late' ? 'มาสาย' : s === 'excused' ? 'ลา' : 'ขาดเรียน';
}

function toDisplayDate(iso: string) {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${parseInt(y, 10) + 543}`;
}
function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDisplayDate(display: string): string | null {
  const m = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  let year = parseInt(m[3], 10);
  if (year > 2500) year -= 543;
  if (year < 1900 || year > 2100) return null;
  const date = new Date(year, parseInt(mo, 10) - 1, parseInt(d, 10));
  if (isNaN(date.getTime())) return null;
  return `${year}-${mo}-${d}`;
}

export function ReportsSection({ onBack }: ReportsSectionProps) {
  const { authUser, signOut } = useAuth();
  const { selectedClassId, selectedClass } = useClassRoom();
  const { students, getStudentsByClass } = useStudents();
  const { attendance } = useAttendance();
  const classId = selectedClassId ?? 'class-1';

  const [endDate, setEndDate] = useState(() => toIsoLocal(new Date()));
  const startDate = endDate.slice(0, 7) + '-01'; // วันแรกของเดือนที่วันที่สิ้นสุด
  type ExportScope = 'daily' | 'monthly';
  const [exportScope, setExportScope] = useState<ExportScope>('daily');
  const [includePersonalDetails, setIncludePersonalDetails] = useState(true);

  // รายละเอียดบุคคลแบบรายเดือน: ใช้เดือน-ปีจากวันที่สิ้นสุด (ไม่ต้องเลือก)
  const matrixMonthYear = endDate.slice(0, 7); // YYYY-MM จาก endDate

  const reportRef = useRef<HTMLDivElement>(null);

  const filteredAttendance = attendance.filter(
    (a) => a.date >= startDate && a.date <= endDate
  );
  const classFiltered = filteredAttendance.filter((a) => a.classId === classId);
  const dailyClassFiltered = classFiltered.filter((a) => a.date === endDate);
  const classStudents = getStudentsByClass(classId);

  // รายละเอียดบุคคล (รายวัน) = ใช้เฉพาะวันที่เลือก
  type DetailRow = { studentId: string; studentName: string; date: string; time: string; status: string; isAbsent: boolean };
  const detailRows: DetailRow[] = [];
  const byDate = dailyClassFiltered.reduce<Record<string, typeof dailyClassFiltered>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = [];
    acc[r.date].push(r);
    return acc;
  }, {});

  dailyClassFiltered.forEach((record) => {
    const student = students.find((s) => s.id === record.studentId);
    const time = record.recordedAt
      ? new Date(record.recordedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '-';
    detailRows.push({
      studentId: student?.studentId ?? record.studentId,
      studentName: record.studentName,
      date: record.date,
      time,
      status: record.status,
      isAbsent: false,
    });
  });
  Object.keys(byDate).forEach((date) => {
    const attendedIds = new Set(byDate[date].map((r) => r.studentId));
    classStudents.forEach((s) => {
      if (!attendedIds.has(s.id)) {
        detailRows.push({
          studentId: s.studentId,
          studentName: `${s.firstName} ${s.lastName}`,
          date,
          time: '-',
          status: 'absent',
          isAbsent: true,
        });
      }
    });
  });
  detailRows.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.studentName.localeCompare(b.studentName);
  });

  const dailyRows = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, recs]) => {
      const classStudents = getStudentsByClass(classId).length;
      const attended = recs.filter((r) => r.status === 'present' || r.status === 'late').length;
      const absent = Math.max(0, classStudents - attended);
      const rate = classStudents > 0 ? (attended / classStudents) * 100 : 0;
      return { date, totalStudents: classStudents, attended, absent, rate };
    });

  const byMonth = classFiltered.reduce<Record<string, typeof classFiltered>>((acc, r) => {
    const month = r.date.slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(r);
    return acc;
  }, {});
  const monthNames: Record<string, string> = {};
  Object.keys(byMonth)
    .sort()
    .forEach((ym) => {
      const [y, m] = ym.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      monthNames[ym] = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    });
  const monthlyRows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, recs]) => {
      const classStudents = getStudentsByClass(classId).length;
      const uniqueDays = new Set(recs.map((r) => r.date)).size;
      const attended = recs.filter((r) => r.status === 'present' || r.status === 'late').length;
      const absent = Math.max(0, classStudents * uniqueDays - attended);
      const totalPossible = classStudents * uniqueDays;
      const rate = totalPossible > 0 ? (attended / totalPossible) * 100 : 0;
      return {
        month,
        monthLabel: monthNames[month] ?? month,
        totalStudents: classStudents,
        attended,
        absent,
        rate,
      };
    });

  // รายละเอียดบุคคลแบบรายเดือน (Matrix)
  const [matrixY, matrixM] = matrixMonthYear.split('-').map(Number);
  const daysInMatrixMonth = new Date(matrixY, matrixM, 0).getDate();
  const matrixStart = `${matrixMonthYear}-01`;
  const matrixEnd = `${matrixMonthYear}-${String(daysInMatrixMonth).padStart(2, '0')}`;
  const matrixAttendance = attendance.filter(
    (a) => a.classId === classId && a.date >= matrixStart && a.date <= matrixEnd
  );
  const attendedByStudentDate = new Map<string, Set<string>>();
  matrixAttendance.forEach((a) => {
    if (a.status === 'present' || a.status === 'late') {
      const key = a.studentId;
      if (!attendedByStudentDate.has(key)) attendedByStudentDate.set(key, new Set());
      attendedByStudentDate.get(key)!.add(a.date);
    }
  });
  const matrixRows = classStudents.map((s) => {
    const attendedDates = attendedByStudentDate.get(s.id) ?? new Set();
    const dayCells: { day: number; attended: boolean }[] = [];
    for (let d = 1; d <= daysInMatrixMonth; d++) {
      const dateStr = `${matrixMonthYear}-${String(d).padStart(2, '0')}`;
      dayCells.push({ day: d, attended: attendedDates.has(dateStr) });
    }
    const total = attendedDates.size;
    const percent = daysInMatrixMonth > 0 ? Math.round((total / daysInMatrixMonth) * 100) : 0;
    return {
      studentId: s.studentId,
      studentName: `${s.firstName} ${s.lastName}`,
      dayCells,
      total,
      percent,
    };
  });

  const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  const escapeCsv = (cell: string) =>
    cell.includes(',') || cell.includes('"') || cell.includes('\n')
      ? `"${String(cell).replace(/"/g, '""')}"`
      : cell;

  const exportExcel = (scope: ExportScope = exportScope) => {
    const roomName = selectedClass?.name ?? classId;

    if (scope === 'monthly') {
      const headers = ['รหัส', 'ชื่อ-นามสกุล', ...Array.from({ length: daysInMatrixMonth }, (_, i) => String(i + 1)), 'รวม', '%'];
      const rows = matrixRows.map((r) => [
        r.studentId,
        r.studentName,
        ...r.dayCells.map((c) => (c.attended ? '✓' : '•')),
        r.total,
        `${r.percent}%`,
      ]);
      const data = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'รายเดือน');
      XLSX.writeFile(wb, getExportFilename('monthly', 'xlsx'));
      return;
    }

    const headers = ['รหัส', 'ชื่อ', 'ห้อง', 'วันที่', 'เวลา', 'สถานะ'];
    const rows = classFiltered.map((a) => {
      const student = students.find((s) => s.id === a.studentId);
      const time = a.recordedAt
        ? new Date(a.recordedAt).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '';
      return [
        student?.studentId ?? '',
        `${student?.firstName ?? ''} ${student?.lastName ?? ''}`.trim(),
        roomName,
        a.date,
        time,
        statusLabel(a.status),
      ];
    });
    const csv = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = getExportFilename('daily', 'csv');
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const applyExportScope = (scope: ExportScope = exportScope) => {
    const el = reportRef.current;
    if (!el) return;
    el.classList.remove('export-daily-only', 'export-monthly-only', 'export-daily-no-details', 'export-hide-matrix', 'report-landscape');
    if (scope === 'daily') {
      el.classList.add('export-daily-only');
      if (!includePersonalDetails) el.classList.add('export-daily-no-details');
      el.classList.add('export-hide-matrix');
    } else {
      el.classList.remove('export-hide-matrix');
      if (scope === 'monthly') el.classList.add('export-monthly-only');
      // มี Matrix — ใช้แนวนอน (A4 landscape) ให้ตารางพอดี ไม่ทับกัน
      el.classList.add('report-landscape');
    }
  };

  const clearExportScope = () => {
    reportRef.current?.classList.remove('export-daily-only', 'export-monthly-only', 'export-daily-no-details', 'export-hide-matrix', 'report-landscape');
  };

  const exportPDF = async (scope: ExportScope = exportScope) => {
    const el = reportRef.current;
    if (!el) return;
    applyExportScope(scope);
    el.classList.add('exporting-image');
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const isLandscape = el.classList.contains('report-landscape');
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;
      let hLeft = imgH;
      let src = 0;
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
      while (hLeft > pageH) {
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -(pageH * (src + 1)), imgW, imgH);
        hLeft -= pageH;
        src += 1;
      }
      pdf.save(getExportFilename(scope, 'pdf'));
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      el.classList.remove('exporting-image');
      clearExportScope();
    }
  };

  const getExportFilename = (scope: ExportScope, ext: string) => {
    const room = selectedClass?.name ?? classId;
    if (scope === 'monthly') {
      return `Report_monthly_${endDate}.${ext}`;
    }
    return `รายงานเข้าเรียน_${room}_${startDate}_${endDate}_รายวัน.${ext}`;
  };

  const exportImage = async (scope: ExportScope = exportScope) => {
    const el = reportRef.current;
    if (!el) return;
    applyExportScope(scope);
    el.classList.add('exporting-image');
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = getExportFilename(scope, 'jpg');
      link.click();
    } catch {
      const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: '#ffffff', logging: false });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = getExportFilename(scope, 'png');
      link.click();
    } finally {
      el.classList.remove('exporting-image');
      clearExportScope();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 min-w-0">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">จัดรายงาน</h1>
                <p className="text-xs text-gray-500 hidden sm:block">สรุปยอดแต่ละวัน / แต่ละเดือน / รายบุคคล (ทีละห้อง)</p>
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

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 py-6 lg:py-8 min-w-0 overflow-x-hidden">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              ช่วงวันที่
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>วันที่</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[160px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDisplayDate(endDate) || 'เลือกวันที่'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <BuddhistCalendar
                      mode="single"
                      selected={endDate ? new Date(endDate + 'T12:00:00') : undefined}
                      onSelect={(d) => d && setEndDate(toIsoLocal(d))}
                      fromYear={new Date().getFullYear() - 10}
                      toYear={new Date().getFullYear() + 10}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">ส่งออกเป็น</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={exportScope}
                      onChange={(e) => setExportScope(e.target.value as ExportScope)}
                      className="flex h-9 w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="daily">สรุปรายวัน</option>
                      <option value="monthly">สรุปรายเดือน</option>
                    </select>
                    {exportScope === 'daily' && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={includePersonalDetails}
                          onCheckedChange={(checked) => setIncludePersonalDetails(checked === true)}
                        />
                        <span className="text-sm text-gray-700">รวมรายละเอียดบุคคล</span>
                      </label>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => exportPDF()} variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button onClick={() => exportImage()} variant="outline" size="sm">
                    <FileImage className="w-4 h-4 mr-2" />
                    รูป (JPG)
                  </Button>
                  <Button onClick={() => exportExcel(exportScope)} variant="outline" size="sm">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div ref={reportRef} className="report-content space-y-8 print:bg-white print:p-4 w-full max-w-full min-w-0 overflow-x-auto">
          {/* หัวรายงานแบบทางการ — แสดงเฉพาะตอนพิมพ์ PDF / ส่งออกรูป */}
          <div className="report-export-only mb-6 border-b border-black pb-3 export-bw">
            <h2 className="report-header-title-daily text-base font-bold text-black mb-3 tracking-tight">รายงานสรุปสารสนเทศการเข้าเรียน</h2>
            <h2 className="report-header-title-monthly hidden text-base font-bold text-black mb-3 tracking-tight">รายงานสรุปสารสนเทศการเข้าเรียน แบบรายเดือน</h2>
            <table className="text-sm text-black w-full max-w-md">
              <tbody>
                <tr>
                  <td className="align-top w-24 py-0.5">วันที่พิมพ์</td>
                  <td className="py-0.5">: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                </tr>
                <tr>
                  <td className="align-top w-24 py-0.5">ช่วงวันที่</td>
                  <td className="py-0.5">
                    <span className="report-header-date-daily">: {toDisplayDate(endDate)}</span>
                    <span className="report-header-date-monthly hidden">: เดือน {THAI_MONTHS[matrixM - 1]} {matrixY + 543} (พ.ศ.)</span>
                  </td>
                </tr>
                <tr>
                  <td className="align-top w-24 py-0.5 font-medium">ห้องเรียน</td>
                  <td className="py-0.5 font-medium">: {selectedClass?.name ?? classId}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 1. สรุปยอดแต่ละวัน */}
          <Card className="print:shadow-none report-section-daily">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                1. สรุปยอดแต่ละวัน {selectedClass ? `(ห้อง ${selectedClass.name})` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto report-summary-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead className="text-green-700 export-th">นักเรียนรวม (คน)</TableHead>
                      <TableHead className="text-green-700 export-th">มาเรียน (คน)</TableHead>
                      <TableHead className="text-red-700 export-th">ขาดเรียน (คน)</TableHead>
                      <TableHead>ร้อยละการมาเรียน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyRows.length > 0 ? (
                      dailyRows.map((r) => (
                        <TableRow key={r.date}>
                          <TableCell className="font-medium">{toDisplayDate(r.date)}</TableCell>
                          <TableCell>{r.totalStudents}</TableCell>
                          <TableCell className="text-green-600 export-td">{r.attended}</TableCell>
                          <TableCell className="text-red-600 export-td">{r.absent}</TableCell>
                          <TableCell>{r.rate.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          ไม่มีข้อมูลสรุป
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 2. สรุปยอดแต่ละเดือน — เมื่อส่งออกรายเดือนแสดงเป็น 1. */}
          <Card className="print:shadow-none report-section-monthly">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <span className="report-monthly-num-2">2. </span>
                <span className="report-monthly-num-1 hidden">1. </span>
                สรุปยอดแต่ละเดือน {selectedClass ? `(ห้อง ${selectedClass.name})` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto report-summary-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เดือน</TableHead>
                      <TableHead className="text-green-700 export-th">นักเรียนรวม (คน)</TableHead>
                      <TableHead className="text-green-700 export-th">มาเรียน (คน)</TableHead>
                      <TableHead className="text-red-700 export-th">ขาดเรียน (คน)</TableHead>
                      <TableHead>ร้อยละการมาเรียน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRows.length > 0 ? (
                      monthlyRows.map((r) => (
                        <TableRow key={r.month}>
                          <TableCell className="font-medium">{r.monthLabel}</TableCell>
                          <TableCell>{r.totalStudents}</TableCell>
                          <TableCell className="text-green-600 export-td">{r.attended}</TableCell>
                          <TableCell className="text-red-600 export-td">{r.absent}</TableCell>
                          <TableCell>{r.rate.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          ไม่มีข้อมูลสรุป
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 2. รายละเอียดบุคคล — ตารางแบบทางการ (หัวดำตัวขาว, ไม่มีเส้นในพื้นที่ข้อมูล) */}
          <Card className="print:shadow-none report-section-individual">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                <span className="report-detail-title-full">3. รายละเอียดบุคคล</span>
                <span className="report-detail-title-daily hidden">2. รายละเอียดบุคคล</span>
                {selectedClass ? `(ห้อง ${selectedClass.name})` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto report-detail-table-wrap">
                <Table className="report-detail-table">
                  <TableHeader>
                    <TableRow className="bg-gray-800 hover:bg-gray-800 report-detail-th">
                      <TableHead className="text-gray-100 report-detail-th-cell">รหัส</TableHead>
                      <TableHead className="text-gray-100 report-detail-th-cell">ชื่อ</TableHead>
                      <TableHead className="text-gray-100 report-detail-th-cell">ห้อง</TableHead>
                      <TableHead className="text-gray-100 report-detail-th-cell">เวลา</TableHead>
                      <TableHead className="text-gray-100 report-detail-th-cell">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailRows.length > 0 ? (
                      detailRows.map((row, idx) => {
                        const roomName = selectedClass?.name ?? classId;
                        return (
                          <TableRow key={`${row.studentId}-${row.date}-${idx}`} className="report-detail-tr">
                            <TableCell className="report-detail-td font-medium">{row.studentId}</TableCell>
                            <TableCell className="report-detail-td">{row.studentName}</TableCell>
                            <TableCell className="report-detail-td text-center">{roomName}</TableCell>
                            <TableCell className="report-detail-td">
                              {(() => {
                                const [y, m, d] = row.date.split('-');
                                const dateStr = `${d}/${m}/${parseInt(y, 10) + 543}`;
                                return `${dateStr} ${row.time}`;
                              })()}
                            </TableCell>
                            <TableCell className={`report-detail-td text-center ${row.isAbsent ? 'text-red-600 font-semibold' : ''}`}>
                              {statusLabel(row.status)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500 report-detail-td">
                          ไม่พบข้อมูล
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 4. รายละเอียดบุคคล (แบบรายเดือน) — เมื่อส่งออกรายเดือนแสดงเป็น 2. */}
          <Card className="print:shadow-none report-section-matrix">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="report-monthly-num-4">4. </span>
                <span className="report-monthly-num-2-matrix hidden">2. </span>
                รายละเอียดบุคคล(แบบรายเดือน) {selectedClass ? `(ห้อง ${selectedClass.name})` : ''}
              </CardTitle>
              <div className="report-matrix-picker flex flex-wrap items-center gap-3 pt-2">
                <span className="text-sm text-gray-700">เดือน {THAI_MONTHS[matrixM - 1]} {matrixY + 543} (พ.ศ.)</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="report-matrix-wrap overflow-x-auto">
                <div className="report-matrix-table">
                <Table className="report-matrix-grid">
                  <colgroup>
                    <col style={{ width: 90 }} />
                    <col style={{ width: 160 }} />
                    {Array.from({ length: daysInMatrixMonth }, (_, i) => <col key={i} style={{ width: 24 }} />)}
                    <col style={{ width: 48 }} />
                    <col style={{ width: 48 }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="report-matrix-th">
                      <TableHead className="report-matrix-cell report-matrix-id">รหัส</TableHead>
                      <TableHead className="report-matrix-cell report-matrix-name">ชื่อ-นามสกุล</TableHead>
                      {Array.from({ length: daysInMatrixMonth }, (_, i) => i + 1).map((d) => (
                        <TableHead key={d} className="report-matrix-cell w-8 text-center p-1">
                          {d}
                        </TableHead>
                      ))}
                      <TableHead className="report-matrix-cell text-center" style={{ minWidth: 40 }}>รวม</TableHead>
                      <TableHead className="report-matrix-cell text-center" style={{ minWidth: 40 }}>%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixRows.length > 0 ? (
                      matrixRows.map((r) => (
                        <TableRow key={r.studentId} className="report-matrix-tr">
                          <TableCell className="report-matrix-cell report-matrix-id font-medium">{r.studentId}</TableCell>
                          <TableCell className="report-matrix-cell report-matrix-name" title={r.studentName}>{r.studentName}</TableCell>
                          {r.dayCells.map((c) => (
                            <TableCell key={c.day} className="report-matrix-cell text-center p-1">
                              {c.attended ? (
                                <span className="text-green-600 font-bold" title="มาเรียน">✓</span>
                              ) : (
                                <span className="text-gray-400" title="ขาด">•</span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="report-matrix-cell text-center font-medium">{r.total}</TableCell>
                          <TableCell className="report-matrix-cell text-center font-medium">{r.percent}%</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={daysInMatrixMonth + 4} className="text-center py-8 text-gray-500">
                          ไม่มีนักเรียนในห้องนี้
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ✓ = มาเรียน &nbsp; • = ขาดเรียน/ไม่มีข้อมูล
              </p>
            </CardContent>
          </Card>

          {/* ฟุตเตอร์ — แสดงเฉพาะตอนพิมพ์ PDF / ส่งออกรูป */}
          <div className="report-export-only mt-8 pt-5 pb-2 border-t border-black text-center text-xs text-black leading-relaxed">
            -ระบบเช็คชื่อ {APP_VERSION}
          </div>
        </div>
      </main>

      <style>{`
        .report-content .report-export-only { display: none; }
        .report-content .report-export-only.border-t { padding-top: 1.25rem !important; padding-bottom: 0.5rem !important; line-height: 1.6 !important; overflow: visible !important; }
        /* รายละเอียดบุคคล — ฟอนต์ไทยและจัดระเบียบ */
        .report-content .report-section-individual { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; }
        .report-content .report-detail-table-wrap { font-size: 14px; font-family: 'Sarabun', 'TH Sarabun New', sans-serif; }
        .report-content .report-detail-table { border-collapse: collapse; width: 100%; table-layout: fixed; }
        .report-content .report-detail-table th:nth-child(1) { width: 10%; }
        .report-content .report-detail-table th:nth-child(2) { width: 24%; }
        .report-content .report-detail-table th:nth-child(3) { width: 12%; }
        .report-content .report-detail-table th:nth-child(4) { width: 32%; }
        .report-content .report-detail-table th:nth-child(5) { width: 12%; }
        .report-content .report-detail-th .report-detail-th-cell { font-weight: 600; padding: 10px 12px; font-size: 14px; text-align: center; }
        .report-content .report-detail-th .report-detail-th-cell:nth-child(2),
        .report-content .report-detail-th .report-detail-th-cell:nth-child(4) { text-align: left; }
        .report-content .report-detail-tr .report-detail-td { padding: 10px 12px; font-size: 14px; line-height: 1.5; }
        .report-content .report-detail-tr .report-detail-td:nth-child(1) { text-align: center; white-space: nowrap; }
        .report-content .report-detail-tr .report-detail-td:nth-child(2) { text-align: left; word-break: break-word; }
        .report-content .report-detail-tr .report-detail-td:nth-child(3) { text-align: center; white-space: nowrap; }
        .report-content .report-detail-tr .report-detail-td:nth-child(4) { text-align: left; white-space: nowrap; }
        .report-content .report-detail-tr .report-detail-td:nth-child(5) { text-align: center; white-space: nowrap; }
        .report-content .report-detail-tr .report-detail-td.text-red-600 { color: #dc2626 !important; font-weight: 600; }
        /* แยกส่งออก: รายวัน = สรุปรายวัน + รายละเอียดบุคคล, รายเดือน = เฉพาะสรุปรายเดือน */
        .report-content.export-daily-only .report-section-monthly { display: none !important; }
        /* เมื่อติ๊กไม่เอารายละเอียดบุคคล: ซ่อนเฉพาะสรุปรายวัน */
        .report-content.export-daily-no-details .report-section-individual { display: none !important; }
        /* เรียงลำดับตัวเลขหัวข้อ: เมื่อเลือกสรุปรายวัน รายละเอียดบุคคลเป็นข้อ 2 ไม่ใช่ 3 */
        .report-content.export-daily-only .report-detail-title-full { display: none !important; }
        .report-content.export-daily-only .report-detail-title-daily { display: inline !important; }
        .report-content.export-monthly-only .report-section-daily,
        .report-content.export-monthly-only .report-section-individual { display: none !important; }
        .report-content.export-hide-matrix .report-section-matrix { display: none !important; }
        /* เรียงลำดับตัวเลขเมื่อส่งออกรายเดือน: 2→1, 4→2 */
        .report-content.export-monthly-only .report-monthly-num-2 { display: none !important; }
        .report-content.export-monthly-only .report-header-title-daily { display: none !important; }
        .report-content.export-monthly-only .report-header-title-monthly.hidden { display: block !important; }
        .report-content.export-monthly-only .report-header-date-daily { display: none !important; }
        .report-content.export-monthly-only .report-header-date-monthly.hidden { display: inline !important; }
        .report-content.export-monthly-only .report-monthly-num-1.hidden { display: inline !important; }
        .report-content.export-monthly-only .report-monthly-num-4 { display: none !important; }
        .report-content.export-monthly-only .report-monthly-num-2-matrix.hidden { display: inline !important; }
        .report-content .report-matrix-table { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; font-size: 13px; }
        .report-content .report-matrix-th .report-matrix-cell { font-weight: 600; padding: 6px 4px; background: #f3f4f6; border: 1px solid #e5e7eb; }
        .report-content .report-matrix-tr .report-matrix-cell { padding: 6px 4px; border: 1px solid #e5e7eb; }
        .report-content .report-section-matrix .report-matrix-id { white-space: nowrap !important; padding: 8px 6px !important; line-height: 1.4 !important; }
        .report-content .report-section-matrix .report-matrix-name { white-space: nowrap !important; padding: 8px 6px !important; line-height: 1.4 !important; max-width: 160px !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        .report-content .report-section-matrix .report-matrix-grid { table-layout: fixed !important; width: 100% !important; }
        @media print {
          @page { margin: 6mm; size: A4; }
          @page landscape { margin: 6mm; size: A4 landscape; }
          .report-content.report-landscape { page: landscape; }
          body * { visibility: hidden; }
          .report-content, .report-content * { visibility: visible; }
          .report-content { position: absolute; left: 0; top: 0; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; background: white !important; padding: 1rem; color: #000 !important; }
          .report-content .report-export-only { display: block !important; }
          .report-content.export-daily-only .report-section-monthly { display: none !important; }
          .report-content.export-daily-no-details .report-section-individual { display: none !important; }
          .report-content.export-daily-only .report-detail-title-full { display: none !important; }
          .report-content.export-daily-only .report-detail-title-daily { display: inline !important; }
          .report-content.export-monthly-only .report-section-daily,
          .report-content.export-monthly-only .report-section-individual { display: none !important; }
          .report-content.export-hide-matrix .report-section-matrix { display: none !important; }
          .report-content.export-monthly-only .report-monthly-num-2 { display: none !important; }
          .report-content.export-monthly-only .report-monthly-num-1.hidden { display: inline !important; }
          .report-content.export-monthly-only .report-monthly-num-4 { display: none !important; }
          .report-content.export-monthly-only .report-monthly-num-2-matrix.hidden { display: inline !important; }
          .report-content.export-monthly-only .report-header-title-daily { display: none !important; }
          .report-content.export-monthly-only .report-header-title-monthly.hidden { display: block !important; }
          .report-content.export-monthly-only .report-header-date-daily { display: none !important; }
          .report-content.export-monthly-only .report-header-date-monthly.hidden { display: inline !important; }
          .report-content .report-section-individual { font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important; }
          .report-content .report-detail-table-wrap { font-size: 14px; font-family: 'Sarabun', 'TH Sarabun New', sans-serif; }
          .report-content .report-detail-table { border-collapse: collapse; width: 100%; table-layout: fixed; }
          .report-content .report-detail-table th:nth-child(1) { width: 10%; }
          .report-content .report-detail-table th:nth-child(2) { width: 24%; }
          .report-content .report-detail-table th:nth-child(3) { width: 12%; }
          .report-content .report-detail-table th:nth-child(4) { width: 32%; }
          .report-content .report-detail-table th:nth-child(5) { width: 12%; }
          .report-content .report-detail-th .report-detail-th-cell { background: #374151 !important; color: #fff !important; font-weight: 600; padding: 10px 12px; border: none !important; text-align: center; font-size: 14px; }
          .report-content .report-detail-th .report-detail-th-cell:nth-child(2),
          .report-content .report-detail-th .report-detail-th-cell:nth-child(4) { text-align: left !important; }
          .report-content .report-detail-tr .report-detail-td { border: none !important; padding: 10px 12px; background: #fff !important; color: #000 !important; font-size: 14px; line-height: 1.5; }
          .report-content .report-detail-tr .report-detail-td:nth-child(1) { text-align: center; white-space: nowrap; }
          .report-content .report-detail-tr .report-detail-td:nth-child(2) { text-align: left; word-break: break-word; }
          .report-content .report-detail-tr .report-detail-td:nth-child(3) { text-align: center; white-space: nowrap; }
          .report-content .report-detail-tr .report-detail-td:nth-child(4) { text-align: left; white-space: nowrap; }
          .report-content .report-detail-tr .report-detail-td:nth-child(5) { text-align: center; white-space: nowrap; }
          .report-content .report-summary-table th,
          .report-content .report-summary-table td { border: 1px solid #000 !important; color: #000 !important; background: #fff !important; }
          .report-content .report-summary-table thead th { font-weight: 700; }
          .report-content .report-section-matrix { border: none !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; margin-left: -1rem !important; margin-right: -1rem !important; width: calc(100% + 2rem) !important; max-width: none !important; }
          .report-content .report-section-matrix [data-slot="card-header"] { padding-left: 1rem !important; padding-right: 1rem !important; }
          .report-content .report-section-matrix [data-slot="card-content"] { padding-left: 0 !important; padding-right: 0 !important; }
          .report-content .report-section-matrix .report-matrix-picker select { border: none !important; background: transparent !important; background-image: none !important; appearance: none !important; -webkit-appearance: none !important; -moz-appearance: none !important; }
          .report-content .report-section-matrix .report-matrix-table { font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important; }
          .report-content .report-matrix-th .report-matrix-cell,
          .report-content .report-matrix-tr .report-matrix-cell { border: 1px solid #000 !important; color: #000 !important; background: #fff !important; }
          .report-content .report-matrix-th .report-matrix-cell { font-weight: 700; }
          /* ตาราง Matrix: ไม่มี scrollbar พอดีกับ PDF */
          .report-content .report-matrix-wrap { overflow: visible !important; }
          .report-content .report-section-matrix [data-slot="table-container"] { overflow: visible !important; }
          .report-content .report-section-matrix table { width: 100% !important; table-layout: fixed !important; }
          .report-content .report-section-matrix .report-matrix-table { font-size: 12px !important; }
          .report-content .report-section-matrix .report-matrix-tr .report-matrix-cell,
          .report-content .report-section-matrix .report-matrix-th .report-matrix-cell {
            padding: 8px 4px !important; line-height: 1.5 !important; vertical-align: middle !important;
          }
          .report-content .report-section-matrix .report-matrix-id,
          .report-content .report-section-matrix .report-matrix-name {
            white-space: nowrap !important; line-height: 1.4 !important; padding: 8px 6px !important; overflow: hidden !important; text-overflow: ellipsis !important;
          }
        }
        .report-content.exporting-image .report-export-only { display: block !important; }
        .report-content.exporting-image.export-daily-only .report-section-monthly { display: none !important; }
        .report-content.exporting-image.export-daily-no-details .report-section-individual { display: none !important; }
        .report-content.exporting-image.export-daily-only .report-detail-title-full { display: none !important; }
        .report-content.exporting-image.export-daily-only .report-detail-title-daily { display: inline !important; }
        .report-content.exporting-image.export-monthly-only .report-section-daily,
        .report-content.exporting-image.export-monthly-only .report-section-individual { display: none !important; }
        .report-content.exporting-image.export-hide-matrix .report-section-matrix { display: none !important; }
        .report-content.exporting-image.export-monthly-only .report-monthly-num-2 { display: none !important; }
        .report-content.exporting-image.export-monthly-only .report-monthly-num-1.hidden { display: inline !important; }
        .report-content.exporting-image.export-monthly-only .report-monthly-num-4 { display: none !important; }
        .report-content.exporting-image.export-monthly-only .report-monthly-num-2-matrix.hidden { display: inline !important; }
        .report-content.exporting-image.export-monthly-only .report-header-title-daily { display: none !important; }
        .report-content.exporting-image.export-monthly-only .report-header-title-monthly.hidden { display: block !important; }
        .report-content.exporting-image.export-monthly-only .report-header-date-daily { display: none !important; }
        .report-content.exporting-image.export-monthly-only .report-header-date-monthly.hidden { display: inline !important; }
        .report-content.exporting-image .report-section-individual { font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important; }
        .report-content.exporting-image .report-detail-table-wrap { font-size: 14px; font-family: 'Sarabun', 'TH Sarabun New', sans-serif; }
        .report-content.exporting-image .report-detail-table { border-collapse: collapse; width: 100%; table-layout: fixed; }
        .report-content.exporting-image .report-detail-table th:nth-child(1) { width: 10%; }
        .report-content.exporting-image .report-detail-table th:nth-child(2) { width: 24%; }
        .report-content.exporting-image .report-detail-table th:nth-child(3) { width: 12%; }
        .report-content.exporting-image .report-detail-table th:nth-child(4) { width: 32%; }
        .report-content.exporting-image .report-detail-table th:nth-child(5) { width: 12%; }
        .report-content.exporting-image .report-detail-th .report-detail-th-cell { background: #374151 !important; color: #fff !important; font-weight: 600; padding: 10px 12px; border: none !important; text-align: center; font-size: 14px; }
        .report-content.exporting-image .report-detail-th .report-detail-th-cell:nth-child(2),
        .report-content.exporting-image .report-detail-th .report-detail-th-cell:nth-child(4) { text-align: left !important; }
        .report-content.exporting-image .report-detail-tr .report-detail-td { border: none !important; padding: 10px 12px; background: #fff !important; color: #000 !important; font-size: 14px; line-height: 1.5; }
        .report-content.exporting-image .report-detail-tr .report-detail-td:nth-child(1) { text-align: center; white-space: nowrap; }
        .report-content.exporting-image .report-detail-tr .report-detail-td:nth-child(2) { text-align: left; word-break: break-word; }
        .report-content.exporting-image .report-detail-tr .report-detail-td:nth-child(3) { text-align: center; white-space: nowrap; }
        .report-content.exporting-image .report-detail-tr .report-detail-td:nth-child(4) { text-align: left; white-space: nowrap; }
        .report-content.exporting-image .report-detail-tr .report-detail-td:nth-child(5) { text-align: center; white-space: nowrap; }
        .report-content.exporting-image .report-summary-table th,
        .report-content.exporting-image .report-summary-table td { border: 1px solid #000 !important; color: #000 !important; background: #fff !important; }
        .report-content.exporting-image .report-summary-table thead th { font-weight: 700; }
        .report-content.exporting-image .report-section-matrix { border: none !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; }
        /* Matrix: ไม่มี scrollbar ตารางพอดีกับรูป — ขยายความกว้างเมื่อส่งออกรูป */
        .report-content.exporting-image.report-landscape { width: 1200px !important; min-width: 1200px !important; max-width: 1200px !important; }
        .report-content.exporting-image .report-matrix-wrap { overflow: visible !important; }
        .report-content.exporting-image .report-section-matrix [data-slot="table-container"] { overflow: visible !important; }
        .report-content.exporting-image .report-section-matrix table { width: 100% !important; table-layout: fixed !important; }
        .report-content.exporting-image .report-section-matrix .report-matrix-table { font-size: 12px !important; }
        .report-content.exporting-image .report-section-matrix .report-matrix-cell { padding: 8px 4px !important; line-height: 1.5 !important; }
        .report-content.exporting-image .report-section-matrix .report-matrix-id,
        .report-content.exporting-image .report-section-matrix .report-matrix-name { white-space: nowrap !important; line-height: 1.4 !important; padding: 8px 6px !important; overflow: hidden !important; text-overflow: ellipsis !important; }
      `}</style>
    </div>
  );
}
