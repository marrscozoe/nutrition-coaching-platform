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

interface ClientData {
  id: string;
  name: string;
  email: string;
  is_tester?: boolean;
  created_at: string;
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
  
  // Correction feature state
  const [correctionFeatureEnabled, setCorrectionFeatureEnabled] = useState(false);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('trainer_user');
    const userType = localStorage.getItem('trainer_user_type');

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
    
    // Load correction feature settings and clients
    loadCorrectionSettings(user.id);
    loadClients(user.id);
  }, [router]);
  
  async function loadCorrectionSettings(trainerId: string) {
    try {
      // Get correction_feature_enabled from kv_store
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.settings?.correction_feature_enabled) {
        setCorrectionFeatureEnabled(true);
      }
    } catch (e) {
      console.error('Error loading correction settings:', e);
    }
  }
  
  async function loadClients(trainerId: string) {
    setLoadingClients(true);
    try {
      const res = await fetch(`/api/admin/testers?trainer_id=${trainerId}`);
      const data = await res.json();
      if (Array.isArray(data.clients)) {
        setClients(data.clients);
      }
    } catch (e) {
      console.error('Error loading clients:', e);
    } finally {
      setLoadingClients(false);
    }
  }

  async function handleToggleCorrectionFeature(enabled: boolean) {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { correction_feature_enabled: enabled },
          
        }),
      });
      if (res.ok) {
        setCorrectionFeatureEnabled(enabled);
      }
    } catch (e) {
      console.error('Error toggling correction feature:', e);
    }
  }

  async function handleToggleTesterStatus(clientId: string, isTester: boolean) {
    try {
      const res = await fetch('/api/admin/testers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          isTester,
        }),
      });
      if (res.ok) {
        // Update the client in the local state
        setClients(clients.map(c => 
          c.id === clientId ? { ...c, is_tester: isTester } : c
        ));
      }
    } catch (e) {
      console.error('Error toggling tester status:', e);
    }
  }

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
    localStorage.setItem('trainer_user', JSON.stringify(updated));

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function copyReferralLink() {
    const link = `${window.location.origin}/signup?trainer=${trainer?.id}`;
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

        {/* AI Correction Feature Section */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h2 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">🤖 AI Corrections</h2>
          
          {/* Feature Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-brand-cream font-medium">Enable Correction Feature</p>
              <p className="text-xs text-brand-cream/50">Let testers report AI food classification mistakes</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleCorrectionFeature(!correctionFeatureEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                correctionFeatureEnabled ? 'bg-brand-orange' : 'bg-brand-cream/20'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  correctionFeatureEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
          
          {/* Tester Management */}
          <div className="mt-4 pt-4 border-t border-brand-cream/10">
            <h3 className="text-sm font-medium text-brand-cream mb-3">Testers</h3>
            <p className="text-xs text-brand-cream/50 mb-3">
              Testers can report when the AI misclassifies foods. You review and approve their corrections.
            </p>
            
            {loadingClients ? (
              <p className="text-sm text-brand-cream/50">Loading clients...</p>
            ) : clients.length === 0 ? (
              <p className="text-sm text-brand-cream/50">No clients found.</p>
            ) : (
              <div className="space-y-2">
                {clients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-brand-cream text-sm">{client.name}</p>
                      <p className="text-xs text-brand-cream/40">{client.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleTesterStatus(client.id, !client.is_tester)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        client.is_tester ? 'bg-brand-orange' : 'bg-brand-cream/20'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          client.is_tester ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/signup?trainer=${trainer?.id}`}
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
              localStorage.removeItem('trainer_user');
              localStorage.removeItem('trainer_user_type');
              localStorage.removeItem('user'); // Legacy cleanup
              localStorage.removeItem('userType'); // Legacy cleanup
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
          <Link href="/trainer/corrections" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">🤖</span>
            <span className="text-xs mt-1">Corrections</span>
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
