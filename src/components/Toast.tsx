'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-green-500/90',
    error: 'bg-red-500/90',
    info: 'bg-brand-charcoal/95',
  }[type];

  const borderColor = {
    success: 'border-green-400/30',
    error: 'border-red-400/30',
    info: 'border-brand-cream/20',
  }[type];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2">
      <div className={`px-4 py-3 rounded-xl ${bgColor} border ${borderColor} backdrop-blur-sm shadow-lg max-w-sm`}>
        <p className="text-white text-sm text-center">{message}</p>
      </div>
    </div>
  );
}
