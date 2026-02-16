/**
 * แสดงเมื่อยังไม่ได้ตั้งค่า Supabase env บน Vercel — แทนที่จะให้หน้าขาว
 */
export function ConfigErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">
          ยังไม่ได้ตั้งค่า Environment
        </h1>
        <p className="text-gray-600 text-sm mb-4">
          กรุณาตั้งค่าใน Vercel → Project → Settings → Environment Variables:
        </p>
        <ul className="text-left text-sm text-gray-700 bg-gray-50 rounded p-4 font-mono space-y-1">
          <li><strong>VITE_SUPABASE_URL</strong> — URL โปรเจกต์ Supabase</li>
          <li><strong>VITE_SUPABASE_ANON_KEY</strong> — anon public key</li>
        </ul>
        <p className="text-gray-500 text-xs mt-4">
          หลังเพิ่มแล้วให้ Redeploy โปรเจกต์บน Vercel
        </p>
      </div>
    </div>
  );
}
