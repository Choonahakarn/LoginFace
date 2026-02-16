/**
 * Features Info Component
 * หน้าอธิบายคุณสมบัติและวิธีใช้งานระบบ
 */
import React from 'react';
import { CheckCircle2, Zap, Shield, Clock as ClockIcon, Lock as LockIcon, Calendar, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface FeaturesInfoProps {
  onClose?: () => void;
}

export function FeaturesInfo({ onClose }: FeaturesInfoProps) {
  // ป้องกัน body scroll เมื่อเปิด modal และลบแถบขาว
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalMargin = document.body.style.margin;
    const originalPadding = document.body.style.padding;
    const htmlStyle = document.documentElement.style;
    const originalHtmlMargin = htmlStyle.margin;
    const originalHtmlPadding = htmlStyle.padding;
    
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    htmlStyle.margin = '0';
    htmlStyle.padding = '0';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.margin = originalMargin;
      document.body.style.padding = originalPadding;
      htmlStyle.margin = originalHtmlMargin;
      htmlStyle.padding = originalHtmlPadding;
    };
  }, []);

  return (
    <div 
      className="fixed bg-black/50 flex items-center justify-center z-[9999]" 
      style={{ 
        position: 'fixed',
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: '1rem'
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">เกี่ยวกับระบบ</h2>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* วิธีใช้งาน */}
          <div>
            <h3 className="font-semibold text-gray-900 text-base mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              วิธีใช้งาน
            </h3>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside ml-2">
              <li>ลงทะเบียนใบหน้าของนักเรียน (อย่างน้อย 5 ภาพต่อคน)</li>
              <li>เมื่อเช็คชื่อ ให้สแกนใบหน้าผ่านกล้อง</li>
              <li>ระบบจะจดจำและบันทึกการเช็คชื่ออัตโนมัติ</li>
              <li>ดูรายงานสรุปได้ทันที</li>
            </ol>
          </div>

          {/* ข้อดี */}
          <div className="pt-4 border-t">
            <h3 className="font-semibold text-gray-900 text-base mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              ข้อดี
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">รวดเร็ว ไม่ต้องใช้บัตร</span>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">ปลอดภัย ป้องกันการปลอม</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">แม่นยำสูง</span>
              </div>
              <div className="flex items-start gap-2">
                <ClockIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">บันทึกเวลาอัตโนมัติ</span>
              </div>
            </div>
          </div>

          {/* ความเป็นส่วนตัว */}
          <div className="pt-4 border-t">
            <h3 className="font-semibold text-gray-900 text-base mb-3 flex items-center gap-2">
              <LockIcon className="w-5 h-5 text-blue-600" />
              ความเป็นส่วนตัว
            </h3>
            <div className="flex items-start gap-2 text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
              <LockIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <span>ไม่มีการเก็บรูปภาพ — ระบบเก็บเฉพาะข้อมูลลายลักษณ์ใบหน้า (Face Embedding) เพื่อความปลอดภัยและความเป็นส่วนตัว</span>
            </div>
          </div>

          {/* ระบบรายงาน */}
          <div className="pt-4 border-t">
            <h3 className="font-semibold text-gray-900 text-base mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              ระบบรายงาน
            </h3>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">รายงานรายวัน:</span> ดูสรุปการเช็คชื่อแต่ละวัน แสดงสถานะมา/สาย/ขาด
                </div>
              </div>
              <div className="flex items-start gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">รายงานรายเดือน:</span> สรุปยอดรวมทั้งเดือน พร้อมสถิติและกราฟ
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ClockIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">บันทึกเวลา:</span> บันทึกเวลาที่แน่นอนของการเช็คชื่อ (ชั่วโมง:นาที:วินาที)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">ตารางเช็คชื่อ:</span> ดูตารางแบบตารางเวลา แสดงรายชื่อนักเรียนและสถานะแต่ละวัน
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end">
          {onClose && (
            <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
              ปิด
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
