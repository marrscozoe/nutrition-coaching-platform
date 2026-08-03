'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface TrainerData {
  id: string;
  name: string;
  email: string;
  business_name?: string;
  brand_color: string;
  created_at?: string;
}

export default function TrainerProfilePage() {
  const router = useRouter();
  const [trainer, setTrainer] = useState<TrainerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const userType = localStorage.getItem('userType');

    if (!userData || userType !== 'trainer') {
      router.push('/');
      return;
    }

    try {
      const user = JSON.parse(userData);
      setTrainer(user);
    } catch (e) {
      router.push('/');
      return;
    } finally {
      setLoading(false);
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    window.location.href = '/';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-cream/60">Profile not found</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/trainer" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-brand-cream">Profile</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 space-y-4">
        {/* Profile Card */}
        <div className="p-6 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-brand-orange/20 flex items-center justify-center mb-4">
            <span className="text-3xl">👨‍🏫</span>
          </div>
          <h2 className="text-xl font-bold text-brand-cream">{trainer.name}</h2>
          {trainer.business_name && (
            <p className="text-brand-cream/60 mt-1">{trainer.business_name}</p>
          )}
          <p className="text-brand-cream/50 text-sm mt-2">{trainer.email}</p>
        </div>

        {/* Account Info */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">Account Information</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-brand-cream/10">
              <span className="text-brand-cream/60 text-sm">Name</span>
              <span className="text-brand-cream text-sm">{trainer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-brand-cream/10">
              <span className="text-brand-cream/60 text-sm">Email</span>
              <span className="text-brand-cream text-sm">{trainer.email}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-brand-cream/10">
              <span className="text-brand-cream/60 text-sm">Business</span>
              <span className="text-brand-cream text-sm">{trainer.business_name || 'Not set'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-brand-cream/60 text-sm">Account Type</span>
              <span className="text-brand-orange text-sm font-medium">Trainer</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              href="/trainer/clients"
              className="flex items-center justify-between p-3 rounded-lg bg-brand-charcoal/60 hover:bg-brand-charcoal/40 transition-colors"
            >
              <span className="text-brand-cream">View Clients</span>
              <span className="text-brand-cream/40">→</span>
            </Link>
            <Link
              href="/trainer/settings"
              className="flex items-center justify-between p-3 rounded-lg bg-brand-charcoal/60 hover:bg-brand-charcoal/40 transition-colors"
            >
              <span className="text-brand-cream">Settings</span>
              <span className="text-brand-cream/40">→</span>
            </Link>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-colors"
        >
          Log Out
        </button>

        {/* Beta Notice */}
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-yellow-400 text-sm font-medium">⚠️ Beta Mode</p>
          <p className="text-brand-cream/60 text-xs mt-1">
            Stripe billing is disabled. All accounts have free access during testing.
          </p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom">
        <div className="flex justify-around py-3">
          <Link href="/trainer" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">📊</span>
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link href="/trainer/clients" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">👥</span>
            <span className="text-xs mt-1">Clients</span>
          </Link>
          <Link href="/trainer/profile" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
          <Link href="/trainer/settings" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">⚙️</span>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
