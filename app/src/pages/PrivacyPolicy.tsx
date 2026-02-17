/**
 * นโยบายความเป็นส่วนตัว (Privacy Policy) — ตาม PDPA
 */
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-6 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          กลับ
        </Button>

        <div className="bg-white rounded-xl shadow-sm border p-6 sm:p-8 space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">นโยบายความเป็นส่วนตัว</h1>
          <p className="text-sm text-gray-500">อัปเดตล่าสุด: ตาม PDPA (พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)</p>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">1. ข้อมูลที่เราเก็บ</h2>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>ข้อมูลบัญชี (อีเมล, ชื่อ) สำหรับครู/ผู้ใช้งาน</li>
              <li>ข้อมูลห้องเรียน และรายชื่อนักเรียนที่คุณสร้าง</li>
              <li>ข้อมูลการเข้าเรียน (เช็คชื่อ) วันที่และสถานะ</li>
              <li>
                <strong>ข้อมูลใบหน้า</strong> — เราเก็บเฉพาะ <strong> Face Embedding</strong> (เวกเตอร์ตัวเลข)
                ไม่เก็บรูปภาพหรือวิดีโอของใบหน้า Embedding ใช้เทียบความเหมือนเท่านั้น แปลงย้อนกลับเป็นใบหน้าไม่ได้
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">2. วัตถุประสงค์การเก็บ</h2>
            <p className="text-gray-700">
              ใช้เพื่อจัดการห้องเรียน เช็คชื่อเข้าเรียนด้วยใบหน้า และรายงานสถิติการเข้าเรียน
              ข้อมูลใบหน้าใช้เฉพาะสำหรับการยืนยันตัวตนในการเช็คชื่อเท่านั้น
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">3. การเก็บรักษาและความปลอดภัย</h2>
            <p className="text-gray-700">
              ข้อมูลเก็บบนเซิร์ฟเวอร์ที่ใช้บริการ Supabase (ฐานข้อมูล) และ backend ของระบบ
              เราไม่เก็บรูปใบหน้าหรือวิดีโอ เก็บเฉพาะ embedding และ metadata ตามหลัก minimization
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">4. ระยะเวลาการเก็บ (Retention)</h2>
            <p className="text-gray-700">
              ข้อมูลจะถูกเก็บตามความจำเป็นในการให้บริการ เมื่อคุณลบบัญชีหรือลบการลงทะเบียนใบหน้า
              ระบบจะลบหรือหยุดใช้ข้อมูลส่วนนั้นตามที่ระบบออกแบบ
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">5. สิทธิ์ของคุณ (ตาม PDPA)</h2>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>สิทธิ์ขอเข้าถึงข้อมูล (access)</li>
              <li>สิทธิ์ขอแก้ไขข้อมูล (rectification)</li>
              <li>สิทธิ์ขอลบข้อมูล (erasure) — สามารถลบการลงทะเบียนใบหน้าของนักเรียนได้ในระบบ</li>
              <li>สิทธิ์ถอนความยินยอม (withdraw consent)</li>
            </ul>
            <p className="text-gray-700 mt-2">
              การถอนความยินยอมหรือขอลบข้อมูลสามารถดำเนินการผ่านฟังก์ชันในระบบ (เช่น ลบการลงทะเบียนใบหน้า)
              หรือติดต่อผู้ควบคุมข้อมูล
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">6. การใช้คุกกี้และเทคโนโลยี</h2>
            <p className="text-gray-700">
              ระบบใช้ session / authentication เพื่อให้คุณเข้าสู่ระบบได้
              การใช้กล้องเพื่อลงทะเบียนใบหน้าและเช็คชื่อจะทำงานบนอุปกรณ์ของคุณ
              และส่งเฉพาะข้อมูลที่จำเป็น (เช่น embedding) ไปยังเซิร์ฟเวอร์
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">7. การติดต่อ</h2>
            <p className="text-gray-700">
              หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวหรือต้องการใช้สิทธิ์ตาม PDPA
              กรุณาติดต่อผู้ควบคุมข้อมูลผ่านช่องทางที่แจ้งไว้ในระบบหรือเว็บไซต์
            </p>
          </section>

          <div className="pt-6 border-t">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
