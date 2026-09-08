'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorPage]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-charcoal flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-brand-cream mb-2">Something went wrong</h2>
        <p className="text-brand-cream/60 text-sm mb-5">
          An unexpected error occurred. Your data is safe — try refreshing to continue.
        </p>
        {error.digest && (
          <p className="text-brand-cream/30 text-xs mb-4 font-mono">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors mb-3"
        >
          Try Again
        </button>
        <button
          onClick={() => {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then((regs) =>
                Promise.all(regs.map((r) => r.unregister()))
              ).then(() => {
                window.location.href = window.location.pathname + '?__reload=' + Date.now();
              });
            } else {
              window.location.href = window.location.pathname + '?__reload=' + Date.now();
            }
          }}
          className="w-full bg-brand-cream/10 hover:bg-brand-cream/20 text-brand-cream font-semibold py-3 px-6 rounded-xl border border-brand-cream/20 transition-colors"
        >
          Hard Refresh
        </button>
      </div>
    </div>
  );
}
