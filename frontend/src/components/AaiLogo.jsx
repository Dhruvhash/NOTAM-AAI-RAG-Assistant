import React from 'react';

export default function AaiLogo({ className = 'w-8 h-8 text-sky-400', showText = false }) {
  if (showText) {
    return (
      <div className="flex flex-col items-center text-center">
        <svg
          viewBox="0 0 260 170"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="currentColor">
            <circle cx="130" cy="22" r="16" />
            <path d="M 124 44 L 24 154 H 50 A 25 32 0 0 1 104 154 H 124 V 44 Z" />
            <path d="M 136 44 V 154 H 156 A 25 32 0 0 1 210 154 H 236 L 136 44 Z" />
            <path
              d="M 18 96 C 60 116 130 144 235 142 L 214 133 L 220 142 L 214 151 Z"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
        <span className="font-extrabold text-xs text-sky-400 tracking-tight mt-1">
          भारतीय विमानपतन प्राधिकरण
        </span>
        <span className="font-bold text-[10px] text-slate-300 tracking-wider uppercase">
          AIRPORTS AUTHORITY OF INDIA
        </span>
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 260 170"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="currentColor">
        {/* Top Dot */}
        <circle cx="130" cy="22" r="16" />

        {/* Left Pillar with Arch */}
        <path d="M 124 44 L 24 154 H 50 A 25 32 0 0 1 104 154 H 124 V 44 Z" />

        {/* Right Pillar with Arch */}
        <path d="M 136 44 V 154 H 156 A 25 32 0 0 1 210 154 H 236 L 136 44 Z" />

        {/* Flight Trail Swoosh Arrow */}
        <path
          d="M 18 96 C 60 116 130 144 235 142 L 214 133 L 220 142 L 214 151 Z"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
