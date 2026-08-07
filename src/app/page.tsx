'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [isTrainer, setIsTrainer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if already logged in and redirect (only run once on mount)
  useEffect(() => {
    try {
      // Check if redirected from trainer route (e.g. /trainer without session → /?login=trainer)
      // If so, auto-select the trainer login tab and don't redirect to /client
      const urlParams = new URLSearchParams(window.location.search);
      const loginType = urlParams.get('login');
      if (loginType === 'trainer') {
        setIsTrainer(true);
        // Don't redirect - show trainer login page
        return;
      }
      
      // Check trainer session first, then client session
      const trainerUser = localStorage.getItem('trainer_user');
      const trainerType = localStorage.getItem('trainer_user_type');
      if (trainerUser && trainerType === 'trainer') {
        router.push('/trainer');
        return;
      }
      
      const clientUser = localStorage.getItem('client_user');
      const clientType = localStorage.getItem('client_user_type');
      if (clientUser && clientType === 'client') {
        router.push('/client');
      }
    } catch (e) {
      // If localStorage fails, just show login page
      console.error('localStorage error:', e);
    }
  }, []); // Empty dependency - only run once on mount

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, type: isTrainer ? 'trainer' : 'client' }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Login failed');
          setLoading(false);
          return;
        }

        // Store user data in localStorage (use separate keys for each user type to prevent overwriting)
        if (data.userType === 'trainer') {
          localStorage.setItem('trainer_user', JSON.stringify(data.user));
          localStorage.setItem('trainer_user_type', 'trainer');
        } else {
          localStorage.setItem('client_user', JSON.stringify(data.user));
          localStorage.setItem('client_user_type', 'client');
        }

        // Redirect based on user type
        if (data.userType === 'trainer') {
          router.push('/trainer');
        } else {
          router.push('/client');
        }
      } else {
        // Signup - call pre-signup API to get a secure token, then redirect to onboarding
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

          // Redirect to onboarding with secure token (no password in URL)
          router.push(`/onboarding?token=${encodeURIComponent(data.token)}&email=${encodeURIComponent(data.email)}&name=${encodeURIComponent(data.name)}`);
        } catch (err) {
          setError('Something went wrong. Please try again.');
          setLoading(false);
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-6 text-center">
        <h1 className="text-3xl font-bold text-brand-orange">AMarsBody</h1>
        <p className="text-sm text-brand-cream/70 mt-1">Nutrition Coaching</p>
      </header>

      {/* Hero */}
      <div className="px-6 py-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-brand-orange/20 flex items-center justify-center">
          <span className="text-4xl">💪</span>
        </div>
        <h2 className="text-xl font-semibold text-brand-cream mb-2">
          Your Nutrition Pocket Coach
        </h2>
        <p className="text-brand-cream/60 text-sm">
          Snap a photo. Get instant coaching.<br />
          No calorie counting. Just portions.
        </p>
      </div>

      {/* User Type Toggle */}
      <div className="px-6 mb-4">
        <div className="flex bg-brand-charcoal/80 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setIsTrainer(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !isTrainer ? 'bg-brand-orange text-white' : 'text-brand-cream/60'
            }`}
          >
            Client Login
          </button>
          <button
            type="button"
            onClick={() => setIsTrainer(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isTrainer ? 'bg-brand-orange text-white' : 'text-brand-cream/60'
            }`}
          >
            Trainer Login
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 flex-1">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm text-brand-cream/80 mb-1" htmlFor="name">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
                placeholder="Allen Smith"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-brand-cream/80 mb-1" htmlFor="email">
              Email
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
              Password
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
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Continue'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-brand-orange text-sm hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          {isLogin && isTrainer && (
            <Link href="/trainer/signup" className="block mt-2 text-brand-orange text-sm hover:underline">
              New trainer? Sign up here
            </Link>
          )}
        </div>

      </div>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-xs text-brand-cream/40">
          By continuing, you agree to our Terms and Privacy Policy
        </p>
      </footer>
    </main>
  );
}
