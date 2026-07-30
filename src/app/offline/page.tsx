'use client';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-brand-orange/20 flex items-center justify-center">
        <span className="text-4xl">📡</span>
      </div>
      <h1 className="text-2xl font-bold text-brand-cream mb-2">You're Offline</h1>
      <p className="text-brand-cream/60 mb-6 max-w-xs">
        No internet connection. Your meal and weight data is saved locally and will sync when you're back online.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors"
      >
        Try Again
      </button>
      <p className="text-brand-cream/30 text-xs mt-8">
        AMarsBody Nutrition v0.1.0
      </p>
    </main>
  );
}
