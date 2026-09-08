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
    console.error('[GlobalError]', error);
  }, [error]);

  async function handleHardReload() {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      if (typeof caches !== 'undefined') {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch (e) {
      console.warn('[GlobalError] cleanup failed', e);
    }
    const path = globalThis.location.pathname;
    globalThis.location.href = path + '?__err_reload=' + Date.now();
  }

  return (
    <html lang="en">
      <body className="bg-brand-charcoal text-brand-cream antialiased min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-cream mb-2">Something went wrong</h1>
          <p className="text-brand-cream/60 text-sm mb-6">
            The app encountered an unexpected error. Your data is safe — try refreshing to get back on track.
          </p>
          {error.digest && (
            <p className="text-brand-cream/30 text-xs mb-4 font-mono">
              Error ID: {error.digest}
            </p>
          )}
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
