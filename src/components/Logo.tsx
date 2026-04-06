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
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%2364748b'/%3E%3Ctext x='50' y='68' font-family='Arial, sans-serif' font-size='55' font-weight='bold' fill='white' text-anchor='middle'%3EV%3C/text%3E%3C/svg%3E" 
      alt="ProcVisual Logo" 
      className={`${sizes[size]} w-auto object-contain ${className}`}
      referrerPolicy="no-referrer"
      loading="eager"
    />
  );
}
