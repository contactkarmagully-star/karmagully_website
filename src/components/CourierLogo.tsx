import React from 'react';
import { getCourierLogo, useCourierLogo } from '../lib/courierLogos';

interface CourierLogoProps {
  partner: string | undefined;
  isSuccessPage?: boolean;
  className?: string;
}

export const CourierLogo = ({ partner, isSuccessPage = false, className = '' }: CourierLogoProps) => {
  const { logoUrl } = useCourierLogo(partner);
  const fallback = partner ? getCourierLogo(partner) : null;
  const finalLogo = logoUrl || fallback;

  if (!finalLogo) return null;

  // New styles for improved visibility and premium feel
  // 10-15% size increase, removed opacity reduction, improved contrast
  const sizeClasses = isSuccessPage ? 
    "h-[22px] sm:h-[30px]" : 
    "h-[20px] sm:h-[25px]";

  return (
    <img 
      src={finalLogo} 
      alt={partner} 
      className={`w-auto object-contain brightness-125 contrast-115 hover:scale-105 transition-all duration-300 ${sizeClasses} ${className}`}
      style={{ imageRendering: 'crisp-edges' } as any}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};
