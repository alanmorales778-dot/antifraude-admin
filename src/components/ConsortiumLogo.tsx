'use client';

import React from 'react';

interface ConsortiumLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showGlow?: boolean;
}

export default function ConsortiumLogo({
  className = '',
  size = 'md',
  showGlow = false,
}: ConsortiumLogoProps) {
  const sizeClasses = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    hero: 'w-32 h-32 sm:w-40 sm:h-40',
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size] || ''} ${className}`}>
      {showGlow && (
        <div className="absolute inset-0 rounded-2xl bg-cyan-500/30 blur-lg -z-10 animate-pulse" />
      )}
      <img
        src="/logo.png"
        alt="Logo Consorcio Federal Antifraude"
        className="w-full h-full object-contain rounded-xl select-none pointer-events-none drop-shadow-[0_4px_12px_rgba(30,144,255,0.35)]"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.endsWith('slide_1.png')) {
            target.src = './logo.png';
          }
        }}
      />
    </div>
  );
}
