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
  showGlow = true,
}: ConsortiumLogoProps) {
  const sizeClasses = {
    xs: 'w-10 h-10',
    sm: 'w-14 h-14',
    md: 'w-16 h-16 sm:w-20 sm:h-20',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-36 h-36 sm:w-44 sm:h-44',
    hero: 'w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72',
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size] || sizeClasses.md} ${className}`}>
      {showGlow && (
        <div className="absolute inset-0 rounded-full bg-cyan-500/25 blur-2xl -z-10 animate-pulse pointer-events-none" />
      )}
      <img
        src="/logo.png"
        alt="Logo Consorcio Federal Antifraude"
        className="w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_0_20px_rgba(6,182,212,0.45)] hover:drop-shadow-[0_0_30px_rgba(59,130,246,0.65)] transition-all duration-300"
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
