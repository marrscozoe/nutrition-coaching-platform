'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function TrainerClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'trial'>('all');

  useEffect(() => {
    const userData = sessionStorage.getItem('trainer_user');
    const userType = sessionStorage.getItem('trainer_user_type');

    if (!userData || userType !== 'trainer') {
      router.push('/?login=trainer');
      return;
    }

    const user = JSON.parse(userData);
    fetchClients();
  }, [router]);

  async function fetchClients() {
    try {
      // Get session token for authentication
      const sessionToken = sessionStorage.getItem('trainer_session_token');
      if (!sessionToken) {
        console.error('No session token found - please log in again');
        router.push('/?login=trainer');
        return;
      }

      const res = await fetch('/api/trainer/clients', {
        headers: { 
          'x-trainer-token': sessionToken,
        },
      });

      // If unauthorized, redirect to login
      if (res.status === 401) {
        console.error('Session expired - please log in again');
        sessionStorage.clear();
        router.push('/?login=trainer');
        return;
      }

      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'trial': return 'text-yellow-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-brand-cream/60';
    }
  }

  function getWeightChange(starting: number, current: number): string {
    if (!starting || !current) return '--';
    const change = current - starting;
    if (change > 0) return `+${change.toFixed(1)}`;
    if (change < 0) return `${change.toFixed(1)}`;
    return '0';
  }

  function getWeightChangeColor(starting: number, current: number): string {
    if (!starting || !current) return 'text-brand-cream/60';
    const change = current - starting;
    if (change < 0) return 'text-green-400';
    if (change > 0) return 'text-red-400';
    return 'text-brand-cream/60';
  }

  const filteredClients = clients.filter(c => {
    if (filter === 'all') return true;
    return c.subscription_status === filter;
  });

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
        <h1 className="text-lg font-semibold text-brand-cream">Clients</h1>
        <div className="w-12" />
      </header>

      {/* Filters */}
      <div className="px-4 flex gap-2">
        {(['all', 'active', 'trial'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${
              filter === f
                ? 'bg-brand-orange text-white'
                : 'bg-brand-charcoal/80 text-brand-cream/60'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Client List */}
      <div className="px-4 mt-4 space-y-2">
        {filteredClients.length === 0 ? (
          <div className="p-8 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
            <p className="text-brand-cream/50">No clients found</p>
            <p className="text-brand-cream/30 text-sm mt-2">
              Share your link to start adding clients
            </p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <Link
              key={client.id}
              href={`/trainer/clients/${client.id}`}
              className="block p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 hover:border-brand-orange/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-brand-cream">{client.name}</p>
                  <p className="text-xs text-brand-cream/50 mt-1">{client.email}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 rounded text-xs bg-brand-charcoal/60 text-brand-cream/70">
                      Phase {client.current_phase}
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-brand-charcoal/60 text-brand-cream/70">
                      Week {client.current_week}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${getStatusColor(client.subscription_status)}`}>
                    {client.subscription_status}
                  </p>
                  <p className="text-sm text-brand-cream/60 mt-1">
                    {client.current_weight || '--'} lbs
                  </p>
                  <p className={`text-xs ${getWeightChangeColor(client.starting_weight, client.current_weight)}`}>
                    {getWeightChange(client.starting_weight, client.current_weight)} lbs
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom">
        <div className="flex justify-around py-3">
          <Link href="/trainer" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">📊</span>
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link href="/trainer/clients" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">👥</span>
            <span className="text-xs mt-1">Clients</span>
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
