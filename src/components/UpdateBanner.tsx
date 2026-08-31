'use client';

import { useState, useEffect } from 'react';
import { CURRENT_VERSION } from '@/lib/version';

const STORAGE_KEY = 'app_version';
const DISMISS_KEY = 'update_dismissed';

export default function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const storedVersion = localStorage.getItem(STORAGE_KEY);

    // First visit — store version and don't show banner
    if (!storedVersion) {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
      return;
    }

    // Version mismatch — show update banner
    if (storedVersion !== CURRENT_VERSION) {
      // Check if user already dismissed this version
      const dismissed = localStorage.getItem(`${DISMISS_KEY}_${CURRENT_VERSION}`);
      if (!dismissed) {
        setShowBanner(true);
      }
    }
  }, []);

  function handleUpdate() {
    setDismissing(true);

    // Clear all cached data
    localStorage.removeItem(STORAGE_KEY);

    // Clear Supabase session storage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }

    // Force reload to pick up new version
    window.location.reload();
  }

  function handleDismiss() {
    // Remember that user dismissed this specific version
    localStorage.setItem(`${DISMISS_KEY}_${CURRENT_VERSION}`, 'true');
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-50 animate-slide-up ${
        dismissing ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <div className="bg-brand-charcoal/95 backdrop-blur-sm border border-brand-orange/40 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-orange/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🔄</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-brand-cream font-bold text-sm">
              Update Available!
            </p>
            <p className="text-brand-cream/60 text-xs mt-1">
              A new version of AMarsBody Nutrition is ready. Tap to refresh and get the latest features.
            </p>
            <button
              onClick={handleUpdate}
              disabled={dismissing}
              className="mt-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Refresh to Update
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
