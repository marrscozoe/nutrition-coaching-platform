'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TrainerSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/trainer/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, businessName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed');
        setLoading(false);
        return;
      }

      // Clear any existing sessionStorage (e.g., old client session) and redirect to login
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('userType');
      setSuccessMessage('Account created! Please sign in.');
      setTimeout(() => window.location.href = '/', 1500);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pb-8">
      {/* Header */}
      <header className="px-6 py-4">
        <Link href="/" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-brand-orange mt-4">Trainer Sign Up</h1>
        <p className="text-sm text-brand-cream/60 mt-1">Create your coaching account</p>
      </header>

      <div className="px-6 mt-6">
        {successMessage ? (
          <div className="p-6 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 text-center">
            <p className="text-lg font-semibold">✓ {successMessage}</p>
            <p className="text-sm text-brand-cream/70 mt-2">Redirecting to login...</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-brand-cream/80 mb-1" htmlFor="name">
              Your Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
              placeholder="Allen Smith"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-brand-cream/80 mb-1" htmlFor="businessName">
              Business Name
            </label>
            <input
              id="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
              placeholder="AMarsBody Fitness"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-cream/80 mb-1" htmlFor="email">
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
              placeholder="trainer@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-brand-cream/80 mb-1" htmlFor="password">
              Password *
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Trainer Account'}
          </button>
        </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="text-brand-orange text-sm hover:underline">
            Already have an account? Sign in
          </Link>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-brand-charcoal/60 border border-brand-cream/10">
          <p className="text-xs text-brand-cream/50 text-center">
            Beta mode: All accounts have free access during testing.
          </p>
        </div>
      </div>
    </main>
  );
}
