'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/pre-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed');
        setLoading(false);
        return;
      }

      // Redirect to onboarding with token (use string concat to avoid template literal issues)
      const signupToken = data.token;
      const redirectUrl = '/onboarding?token=' + encodeURIComponent(signupToken) + '&email=' + encodeURIComponent(email) + '&name=' + encodeURIComponent(name);
      router.push(redirectUrl);
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
          Back
        </Link>
        <h1 className="text-2xl font-bold text-brand-orange mt-4">Create Account</h1>
        <p className="text-sm text-brand-cream/60 mt-1">Start your nutrition journey</p>
      </header>

      <div className="px-6 mt-6">
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
              placeholder="Your name"
              required
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
              placeholder="you@example.com"
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
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm text-brand-cream/80 mb-1" htmlFor="confirmPassword">
              Confirm Password *
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
              placeholder="Min 6 characters"
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
            {loading ? 'Creating Account...' : 'Continue'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-brand-orange text-sm hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
