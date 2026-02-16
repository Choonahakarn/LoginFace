/**
 * Face Recognition Illustration Component
 * SVG illustration สำหรับแสดงระบบสแกนใบหน้า
 */
export function FaceIllustration({ className = "w-full h-48" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 200"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background */}
      <rect width="400" height="200" fill="#F9FAFB" />
      
      {/* Face Circle */}
      <circle cx="200" cy="100" r="60" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2" />
      
      {/* Face Outline */}
      <ellipse cx="200" cy="100" rx="50" ry="60" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="2" />
      
      {/* Left Eye */}
      <circle cx="180" cy="90" r="6" fill="#374151" />
      <circle cx="182" cy="88" r="2" fill="#FFFFFF" />
      
      {/* Right Eye */}
      <circle cx="220" cy="90" r="6" fill="#374151" />
      <circle cx="222" cy="88" r="2" fill="#FFFFFF" />
      
      {/* Eyebrows */}
      <path d="M 170 82 Q 180 78 190 82" stroke="#374151" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M 210 82 Q 220 78 230 82" stroke="#374151" strokeWidth="2" strokeLinecap="round" fill="none" />
      
      {/* Nose */}
      <ellipse cx="200" cy="105" rx="4" ry="8" fill="#E5E7EB" />
      
      {/* Mouth */}
      <path d="M 180 120 Q 200 130 220 120" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      
      {/* Scan Grid Lines - แสดงระบบสแกน */}
      <g opacity="0.3" stroke="#2563EB" strokeWidth="1" strokeDasharray="4,4">
        <line x1="120" y1="50" x2="280" y2="50" />
        <line x1="120" y1="100" x2="280" y2="100" />
        <line x1="120" y1="150" x2="280" y2="150" />
        <line x1="120" y1="50" x2="120" y2="150" />
        <line x1="200" y1="50" x2="200" y2="150" />
        <line x1="280" y1="50" x2="280" y2="150" />
      </g>
      
      {/* Scan Indicator */}
      <circle cx="200" cy="100" r="55" fill="none" stroke="#2563EB" strokeWidth="2" opacity="0.5" strokeDasharray="8,4">
        <animate attributeName="r" values="55;65;55" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
      </circle>
      
      {/* Corner Markers */}
      <rect x="130" y="60" width="8" height="8" fill="#2563EB" />
      <rect x="262" y="60" width="8" height="8" fill="#2563EB" />
      <rect x="130" y="132" width="8" height="8" fill="#2563EB" />
      <rect x="262" y="132" width="8" height="8" fill="#2563EB" />
    </svg>
  );
}
