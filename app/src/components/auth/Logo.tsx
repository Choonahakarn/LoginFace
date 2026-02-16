/**
 * Logo Component สำหรับระบบเช็คชื่อด้วยใบหน้า
 * รองรับทั้ง SVG และรูปภาพ
 */
export function Logo({ className = "w-12 h-12", useImage = false }: { className?: string; useImage?: boolean }) {
  // ถ้ามีไฟล์รูปภาพใน public folder ให้ใช้รูปภาพแทน
  if (useImage) {
    return (
      <img 
        src="/logo.png" 
        alt="FaceIn Logo" 
        className={className}
        onError={(e) => {
          // ถ้าไม่มีไฟล์รูป ให้ fallback ไปใช้ SVG
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // SVG Logo - ออกแบบตามโลโก้ FaceIn ที่มี L-brackets frame
  return (
    <svg
      viewBox="0 0 200 60"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Icon Section - Face with L-brackets frame */}
      <g>
        {/* L-bracket Top Left */}
        <path
          d="M 8 8 L 8 20 L 20 20"
          stroke="url(#blueGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="8" cy="8" r="2" fill="url(#blueGradient)" />
        <circle cx="20" cy="20" r="2" fill="url(#blueGradient)" />
        
        {/* L-bracket Bottom Right */}
        <path
          d="M 52 40 L 52 28 L 40 28"
          stroke="url(#blueGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="52" cy="40" r="2" fill="url(#blueGradient)" />
        <circle cx="40" cy="28" r="2" fill="url(#blueGradient)" />
        
        {/* Face */}
        <ellipse cx="30" cy="24" rx="10" ry="12" fill="url(#blueGradient)" opacity="0.9" />
        
        {/* Eyes */}
        <circle cx="26" cy="22" r="1.5" fill="white" />
        <circle cx="34" cy="22" r="1.5" fill="white" />
        
        {/* Smile */}
        <path
          d="M 24 28 Q 30 32 36 28"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Hair wave */}
        <path
          d="M 22 16 Q 30 12 38 16"
          stroke="url(#blueGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      
      {/* Text "FaceIn" */}
      <g>
        <text
          x="70"
          y="38"
          fontSize="24"
          fontWeight="bold"
          fill="url(#blueGradient)"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          FaceIn
        </text>
      </g>
      
      {/* Gradient Definition */}
      <defs>
        <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LogoWithText({ showText = true, useImage = false }: { showText?: boolean; useImage?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo className="w-10 h-10" useImage={useImage} />
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            FaceIn
          </span>
          <span className="text-xs text-gray-500 -mt-1">Attendance System</span>
        </div>
      )}
    </div>
  );
}
