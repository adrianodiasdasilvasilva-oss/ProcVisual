import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function Logo({ size = 'medium', className = '' }: LogoProps) {
  const sizes = {
    small: 'h-[28px]',
    medium: 'h-[40px]',
    large: 'h-[90px]'
  };

  return (
    <img 
      src="https://i.imgur.com/mPPZOMY.png" 
      alt="ProcVisual Logo" 
      className={`${sizes[size]} w-auto object-contain ${className}`}
      referrerPolicy="no-referrer"
      loading="eager"
    />
  );
}
