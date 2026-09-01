'use client';

import { useState, useEffect, useRef } from 'react';
import { CURRENT_VERSION } from '@/lib/version';

const STORAGE_KEY = '***';
const DISMISS_KEY = '***';

export default function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(false);
  const updateTriggered = useRef(false);
  const serverVersionRef = useRef<string>(CURRENT_VERSION);

  useEffect(() => {
    // Check for updates on every page load — this effect runs client-side only
    // so it's never server-rendered and always fresh
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      // Get the server's current version
      let serverVersion: string;
      try {
        const res = await fetch('/api/version?t=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          serverVersion = data.version;
        } else {
          // Fallback to local version if API fails
          serverVersion = CURRENT_VERSION;
        }
      } catch {
        // Fallback to local version if fetch fails
        serverVersion = CURRENT_VERSION;
      }
      
      // Store server version for use in dismiss
      serverVersionRef.current = serverVersion;

      // Get stored version
      let storedVersion: string | null = null;
      try {
        storedVersion = localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        // localStorage not available, skip banner
        console.warn('[UpdateBanner] localStorage not available:', e);
        return;
      }

      // First visit — store version and don't show banner
      if (!storedVersion) {
        try {
          localStorage.setItem(STORAGE_KEY, serverVersion);
        } catch (e) {
          console.warn('[UpdateBanner] Failed to save version:', e);
        }
        return;
      }

      // Version mismatch — show update banner (user clicks to update)
      if (storedVersion !== serverVersion) {
        // Check if user already dismissed this version
        let dismissed = false;
        try {
          dismissed = localStorage.getItem(`${DISMISS_KEY}_${serverVersion}`) === 'true';
        } catch (e) {
          // Ignore storage errors
        }
        if (!dismissed) {
          setShowBanner(true);
        }
      }
    } catch (e) {
      console.error('[UpdateBanner] Version check failed:', e);
    }
  }

  async function unregisterServiceWorkers(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister())
        );
      } catch (e) {
        console.warn('[UpdateBanner] Failed to unregister service workers:', e);
      }
    }
  }

  async function clearAllCaches(): Promise<void> {
    // Clear Workbox caches (used by next-pwa)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (e) {
        console.warn('[UpdateBanner] Failed to clear caches:', e);
      }
    }
  }

  async function handleUpdate() {
    // Prevent double-triggering
    if (updateTriggered.current) return;
    updateTriggered.current = true;

    setDismissing(true);
    setUpdateProgress(true);

    try {
      // Step 1: Unregister all service workers (clears SW cache control)
      await unregisterServiceWorkers();

      // Step 2: Clear ALL browser caches (HTTP cache, Workbox caches, etc.)
      await clearAllCaches();

      // Step 3: Store the new version in localStorage so after reload, version check finds a match
      try {
        localStorage.setItem(STORAGE_KEY, serverVersionRef.current);
      } catch (e) {
        console.warn('[UpdateBanner] Failed to save version:', e);
      }

      // Step 4: Clear sessionStorage (but NOT localStorage - we want to preserve user session)
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn('[UpdateBanner] Failed to clear sessionStorage:', e);
      }

      // Step 5: Force hard reload bypassing all caches
      // Use a cache-busting approach: reload with replacement
      // First replace current entry so back-button doesn't re-trigger
      window.location.replace(
        window.location.href.split('?')[0] +
          '?__update=' +
          Date.now() +
          '#__updating'
      );

      // Small delay to let replace take effect, then hard reload
      setTimeout(() => {
        // Hard reload: forces re-fetch of all resources
        window.location.reload();
      }, 100);
    } catch (err) {
      console.error('[UpdateBanner] Update failed:', err);
      updateTriggered.current = false;
      setDismissing(false);
      setUpdateProgress(false);
    }
  }

  function handleDismiss() {
    // Remember that user dismissed this specific version (use server version)
    try {
      localStorage.setItem(`${DISMISS_KEY}_${serverVersionRef.current}`, 'true');
    } catch (e) {
      console.warn('[UpdateBanner] Failed to save dismiss:', e);
    }
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-50 animate-slide-up ${
        dismissing ? 'pointer-events-none' : ''
      }`}
    >
      <div className="bg-brand-charcoal/95 backdrop-blur-sm border border-brand-orange/40 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-orange/20 flex items-center justify-center flex-shrink-0">
            {updateProgress ? (
              <span className="text-xl animate-spin">⚡</span>
            ) : (
              <span className="text-xl">🔄</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-brand-cream font-bold text-sm">
              {updateProgress ? 'Updating...' : 'Update Available!'}
            </p>
            <p className="text-brand-cream/60 text-xs mt-1">
              {updateProgress
                ? 'Clearing caches and loading new version...'
                : 'A new version of AMarsBody Nutrition is ready. Tap to refresh and get the latest features.'}
            </p>
            {!updateProgress && (
              <button
                onClick={handleUpdate}
                className="mt-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Refresh to Update
              </button>
            )}
          </div>
          {!updateProgress && (
            <button
              onClick={handleDismiss}
              className="text-brand-cream/40 hover:text-brand-cream/80 flex-shrink-0 p-1"
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
