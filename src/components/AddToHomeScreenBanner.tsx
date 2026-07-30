'use client';

import { useState, useEffect } from 'react';

export default function AddToHomeScreenBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed or if already installed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (dismissed || isStandalone) return;
    
    // Show banner after a short delay
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-brand-charcoal/95 backdrop-blur-sm border border-brand-orange/30 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-orange/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">📱</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-brand-cream font-semibold text-sm">
              Add to Home Screen
            </p>
            <p className="text-brand-cream/60 text-xs mt-1">
              Tap the share button → "Add to Home Screen" for the best experience!
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-brand-cream/40 hover:text-brand-cream/80 flex-shrink-0 p-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
