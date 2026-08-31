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

    return () => {
      clearTimeout(timer);
    };
  }, []);

  function handleDismiss() {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  }

  function handleAddToHomeScreen() {
    // iOS Safari
    if (typeof navigator !== 'undefined' && 'standalone' in navigator) {
      // @ts-ignore - iOS Safari
      if (navigator.standalone) {
        // Already installed
        handleDismiss();
        return;
      }
    }

    // Show instructions based on device
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      alert(
        'To add this app to your Home Screen:\n\n' +
        '1. Hold down on the address bar\n' +
        '2. Tap "Share" from the popup menu\n' +
        '3. Scroll down and tap "Add to Home Screen"\n' +
        '4. Tap "Add" in the top right corner'
      );
    } else if (isAndroid) {
      alert(
        'To add this app to your Home Screen:\n\n' +
        '1. Tap the three dots menu (top right)\n' +
        '2. Tap "Add to Home Screen"\n' +
        '3. Tap "Add" or "Install" to confirm'
      );
    } else {
      alert(
        'To add this app to your Home Screen:\n\n' +
        'Desktop: Use your browser\'s "Add to Home Screen" or "Install" feature in the menu.\n\n' +
        'Mobile: Follow the instructions for iOS or Android above.'
      );
    }
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 animate-slide-up">
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
              Get the app for easy access anytime!
            </p>
            <button
              onClick={handleAddToHomeScreen}
              className="mt-2 bg-brand-orange hover:bg-brand-orange/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              How to Add
            </button>
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
