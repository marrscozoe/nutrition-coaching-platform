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
}

export default function TrainerSettingsPage() {
  const router = useRouter();
  const [trainer, setTrainer] = useState<TrainerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [brandColor, setBrandColor] = useState('#f97316');
  const [email, setEmail] = useState('');
  const [copiedMessage, setCopiedMessage] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const userType = localStorage.getItem('userType');

    if (!userData || userType !== 'trainer') {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    setTrainer(user);
    setName(user.name || '');
    setBusinessName(user.business_name || '');
    setBrandColor(user.brand_color || '#f97316');
    setEmail(user.email || '');
    setLoading(false);
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    // In a real app, this would call an API to update the trainer's settings
    // For now, we just update localStorage
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

    const updated = {
      ...trainer,
      name,
      business_name: businessName,
      brand_color: brandColor,
    };
    setTrainer(updated as any);
    localStorage.setItem('user', JSON.stringify(updated));

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function copyReferralLink() {
    const link = `${window.location.origin}/onboarding?trainer=${trainer?.id}`;
    navigator.clipboard.writeText(link);
    setCopiedMessage('Link copied!');
    setTimeout(() => setCopiedMessage(''), 3000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
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
        <h1 className="text-lg font-semibold text-brand-cream">Settings</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 space-y-4">
        {/* Profile Section */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h2 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">Profile</h2>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-brand-cream/80 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                placeholder="Allen Smith"
              />
            </div>

            <div>
              <label className="block text-sm text-brand-cream/80 mb-1">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/40 border border-brand-cream/20 text-brand-cream/50 cursor-not-allowed"
              />
              <p className="text-xs text-brand-cream/40 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm text-brand-cream/80 mb-1">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                placeholder="AMarsBody Fitness"
              />
            </div>

            <div>
              <label className="block text-sm text-brand-cream/80 mb-2">Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border border-brand-cream/20 cursor-pointer"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange font-mono"
                  placeholder="#f97316"
                />
              </div>
              <p className="text-xs text-brand-cream/40 mt-1">Used for buttons and accents</p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Referral Link Section */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h2 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">Client Signup Link</h2>
          <p className="text-sm text-brand-cream/60 mb-4">
            Share this link with potential clients. They'll be automatically linked to your account when they sign up.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/onboarding?trainer=${trainer?.id}`}
              readOnly
              className="flex-1 px-4 py-3 rounded-lg bg-brand-charcoal/40 border border-brand-cream/20 text-brand-cream/70 text-sm"
            />
            <button
              onClick={copyReferralLink}
              className="px-4 py-3 rounded-lg bg-brand-orange text-white font-medium hover:bg-brand-orange-dark transition-colors"
            >
              Copy
            </button>
          </div>
          {copiedMessage && (
            <p className="mt-2 text-sm text-green-400">✓ {copiedMessage}</p>
          )}
        </div>

        {/* White Label Info */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h2 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">White Label</h2>
          <p className="text-sm text-brand-cream/60 mb-3">
            Want your own branded subdomain? Setup your custom domain:
          </p>
          <div className="p-3 rounded-lg bg-brand-charcoal/60 border border-brand-cream/10">
            <code className="text-brand-orange text-sm">yourname.nutrition.amarsbody.com</code>
          </div>
          <p className="text-xs text-brand-cream/40 mt-2">
            Coming soon! Contact amarsbody@gmail.com to set up your white-label subdomain.
          </p>
        </div>

        {/* Account */}
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4">Account</h2>
          <button
            onClick={() => {
              localStorage.removeItem('user');
              localStorage.removeItem('userType');
              router.push('/');
            }}
            className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-colors"
          >
            Log Out
          </button>
        </div>

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
          <Link href="/trainer/settings" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">⚙️</span>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
