'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { logout } from '@/lib/auth';

interface TrainerData {
  id: string;
  name: string;
  email: string;
  business_name?: string;
}

interface ClientData {
  id: string;
  name: string;
  email: string;
  gender: string;
  current_phase: number;
  current_week: number;
  starting_weight: number;
  current_weight: number;
  goal_weight: number;
  program_type: string;
  subscription_status: string;
  created_at: string;
}

export default function TrainerDashboard() {
  const router = useRouter();
  const [trainer, setTrainer] = useState<TrainerData | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('trainer_user');
    const userType = localStorage.getItem('trainer_user_type');

    if (!userData || userType !== 'trainer') {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    setTrainer(user);
    fetchClients();
  }, [router]);

  async function fetchClients() {
    try {
      const res = await fetch('/api/trainer/clients', {
        headers: { 'x-trainer-id': trainer!.id },
      });
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'trial': return 'text-yellow-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-brand-cream/60';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  const activeClients = clients.filter(c => c.subscription_status === 'active' || c.subscription_status === 'trial');

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-brand-charcoal/90 backdrop-blur-sm sticky top-0 z-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-brand-orange">Trainer Dashboard</h1>
            <p className="text-sm text-brand-cream/60">{trainer?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-brand-cream/60 hover:text-brand-cream"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
            <p className="text-brand-cream/60 text-xs uppercase tracking-wider">Active Clients</p>
            <p className="text-3xl font-bold text-brand-orange mt-1">{activeClients.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
            <p className="text-brand-cream/60 text-xs uppercase tracking-wider">At Risk</p>
            <p className="text-3xl font-bold text-red-400 mt-1">0</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/trainer/clients"
            className="p-4 rounded-xl bg-brand-orange text-white text-center font-semibold hover:bg-brand-orange-dark transition-colors"
          >
            View Clients
          </Link>
          <Link
            href="/trainer/settings"
            className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-center font-semibold hover:bg-brand-charcoal/60 transition-colors"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Client List Preview */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider">Recent Clients</h2>
          <Link href="/trainer/clients" className="text-brand-orange text-sm hover:underline">
            See All →
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="p-8 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
            <p className="text-brand-cream/50 mb-2">No clients yet</p>
            <p className="text-brand-cream/30 text-sm">
              Share your signup link to start adding clients.
              <br />
              Your link: <span className="text-brand-orange">amarsbody.com/nutrition</span>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.slice(0, 5).map((client) => (
              <Link
                key={client.id}
                href={`/trainer/clients/${client.id}`}
                className="block p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 hover:border-brand-orange/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-brand-cream">{client.name}</p>
                    <p className="text-xs text-brand-cream/50 mt-1">
                      Phase {client.current_phase} • Week {client.current_week}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${getStatusColor(client.subscription_status)}`}>
                      {client.subscription_status}
                    </p>
                    <p className="text-xs text-brand-cream/50 mt-1">
                      {client.current_weight || '--'} lbs
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Demo Mode Notice */}
      <div className="mx-4 mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
        <p className="text-yellow-400 text-sm font-medium">⚠️ Beta Mode</p>
        <p className="text-brand-cream/60 text-xs mt-1">
          Stripe billing is disabled. All accounts have free trial access.
        </p>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom">
        <div className="flex justify-around py-3">
          <Link href="/trainer" className="flex flex-col items-center text-brand-orange">
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
          <Link href="/trainer/settings" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">⚙️</span>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
