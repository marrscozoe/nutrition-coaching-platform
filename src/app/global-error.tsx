'use client';

import { useEffect, useState } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log to console for debugging
    console.error('[GlobalError]', error);
  }, [error]);

  function handleHardReload() {
    // Capture window ref to prevent TypeScript narrowing it to `never` inside closures
    const win = window;
    // Clear SW and hard-reload, same strategy as UpdateBanner
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        Promise.all(registrations.map((r) => r.unregister()));
      }).then(() => {
        if ('caches' in win) {
          caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).then(() => {
            // Navigate to fresh URL — forces network fetch, no SW intercept
            win.location.href = win.location.pathname + '?__err_reload=' + Date.now();
          });
        } else {
          win.location.href = win.location.pathname + '?__err_reload=' + Date.now();
        }
      });
    } else {
      win.location.href = win.location.pathname + '?__err_reload=' + Date.now();
    }
  }

  return (
    <html lang="en">
      <body className="bg-brand-charcoal text-brand-cream antialiased min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠️</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-brand-cream mb-2">Something went wrong</h1>
          <p className="text-brand-cream/60 text-sm mb-6">
            The app encountered an unexpected error. Your data is safe — try refreshing to get back on track.
          </p>

          {/* Error ID (digest) */}
          {error.digest && (
            <p className="text-brand-cream/30 text-xs mb-4 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleHardReload}
              className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Refresh App
            </button>
            <button
              onClick={reset}
              className="w-full bg-brand-cream/10 hover:bg-brand-cream/20 text-brand-cream font-semibold py-3 px-6 rounded-xl border border-brand-cream/20 transition-colors"
            >
              Try Again
            </button>
          </div>

          {/* Collapsible details */}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="mt-6 text-brand-cream/40 hover:text-brand-cream/60 text-xs underline"
          >
            {showDetails ? 'Hide details' : 'Show technical details'}
          </button>
          {showDetails && (
            <pre className="mt-3 text-left text-brand-cream/40 text-xs bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          )}
        </div>
      </body>
    </html>
  );
}
