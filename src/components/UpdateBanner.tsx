'use client';

import { useState, useEffect, useRef } from 'react';
import { CURRENT_VERSION } from '@/lib/version';

const VERSION_KEY = '***';
const DISMISS_KEY = '***';

export default function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateTriggered = useRef(false);
  const serverVersionRef = useRef<string>(CURRENT_VERSION);

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    let serverVersion: string = CURRENT_VERSION;

    try {
      const res = await fetch('/api/version?t=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        serverVersion = data.version;
      }
    } catch {
      // network error — stick with CURRENT_VERSION
    }

    serverVersionRef.current = serverVersion;

    let storedVersion: string | null = null;
    try {
      storedVersion = localStorage.getItem(VERSION_KEY);
    } catch {
      return; // localStorage unavailable
    }

    // First visit — stamp version, no banner
    if (!storedVersion) {
      try {
        localStorage.setItem(VERSION_KEY, serverVersion);
      } catch {
        // ignore
      }
      return;
    }

    // Same version — nothing to do
    if (storedVersion === serverVersion) {
      return;
    }

    // Different version — check dismiss state
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(`${DISMISS_KEY}_${serverVersion}`) === 'true';
    } catch {
      // ignore
    }

    if (!dismissed) {
      setShowBanner(true);
    }
  }

  /**
   * Unregister every service worker registration.
   * After this the browser will not route requests through any SW,
   * ensuring the subsequent reload hits the network directly.
   */
  async function unregisterServiceWorkers(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    } catch (e) {
      console.warn('[UpdateBanner] SW unregister failed:', e);
    }
  }

  /**
   * Delete every named cache in the Cache Storage API.
   * Covers Workbox-managed precache and runtime caches.
   */
  async function clearAllCaches(): Promise<void> {
    if (!('caches' in window)) return;
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (e) {
      console.warn('[UpdateBanner] Cache clear failed:', e);
    }
  }

  /**
   * Hard reload strategy:
   * 1. Unregister all SWs  → no SW intercepts the reload request
   * 2. Clear all caches     → no stale responses in any cache layer
   * 3. Stamp new version    → version check passes on next mount
   * 4. Clear sessionStorage → reset ephemeral UI state
   * 5. Navigate to fresh URL (window.location.href = …) → forces network
   *
   * Using window.location.href assignment (not reload()) ensures the
   * browser treats the navigation as a brand-new top-level load with no
   * back-button history pollution, and it bypasses the HTTP disk cache.
   */
  async function handleUpdate() {
    if (updateTriggered.current) return;
    updateTriggered.current = true;
    setIsUpdating(true);

    try {
      await unregisterServiceWorkers();
      await clearAllCaches();

      try {
        localStorage.setItem(VERSION_KEY, serverVersionRef.current);
      } catch {
        // ignore — version check will fall back on next mount
      }

      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }

      // Cache-bust the URL: same path, fresh query + fragment so the
      // HTTP cache cannot serve a stale response for this exact URL.
      const url =
        window.location.pathname +
        '?__app_update=' +
        Date.now() +
        '#__updating';

      // Assign forces a top-level navigation with a brand-new URL
      window.location.href = url;
    } catch (err) {
      console.error('[UpdateBanner] Update failed:', err);
      updateTriggered.current = false;
      setIsUpdating(false);
    }
  }

  // NO dismiss — the banner must stay on screen until the user explicitly
  // taps \"Refresh to Update\". Removing the X button prevents accidental dismissal
  // and ensures Allen always has a path to the new version.

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-24 left-4 right-4 z-50 animate-slide-up ${
        isUpdating ? 'pointer-events-none' : ''
      }`}
    >
      <div className="bg-brand-charcoal/95 backdrop-blur-sm border border-brand-orange/40 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-orange/20 flex items-center justify-center flex-shrink-0">
            {isUpdating ? (
              <span className="text-xl animate-spin">⚡</span>
            ) : (
              <span className="text-xl">🔄</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-brand-cream font-bold text-sm">
              {isUpdating ? 'Updating…' : 'Update Available!'}
            </p>
            <p className="text-brand-cream/60 text-xs mt-1">
              {isUpdating
                ? 'Clearing caches and loading the new version…'
                : 'A new version of AMarsBody Nutrition is ready. You must update to continue.'}
            </p>
            {!isUpdating && (
              <button
                onClick={handleUpdate}
                className="mt-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Refresh to Update
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
