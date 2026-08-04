'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface ClientData {
  id: string;
  name: string;
  email: string;
  gender: string;
  program_type: string;
  starting_weight: number;
  current_weight: number;
  goal_weight: number;
  event_date?: string;
  current_phase: number;
  current_week: number;
  subscription_status: string;
  notes?: string;
  created_at: string;
}

interface MealLog {
  id: string;
  meal_type: string;
  food_description: string;
  on_phase: boolean;
  messed_up: boolean;
  logged_at: string;
}

interface WeighIn {
  id: string;
  weight: number;
  body_fat_percent?: number;
  pant_size?: string;
  waist_size?: string;
  weigh_day?: string;
  created_at: string;
}

interface Milestone {
  id: string;
  milestone_type: string;
  achieved_at: string;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [trainer, setTrainer] = useState<any>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  // Edit form state
  const [notes, setNotes] = useState('');
  const [currentPhase, setCurrentPhase] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const userType = localStorage.getItem('userType');

    if (!userData || userType !== 'trainer') {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    setTrainer(user);
    fetchClientData(clientId, user.id);
  }, [router, clientId]);

  async function fetchClientData(clientId: string, trainerId: string) {
    try {
      const res = await fetch(`/api/trainer/clients/${clientId}`, {
        headers: { 'x-trainer-id': trainerId },
      });
      const data = await res.json();

      if (data.error === 'Client not found') {
        router.push('/trainer/clients');
        return;
      }

      setClient(data.client);
      setMealLogs(data.mealLogs || []);
      setWeighIns(data.weighIns || []);
      setMilestones(data.milestones || []);
      setNotes(data.client?.notes || '');
      setCurrentPhase(data.client?.current_phase || 1);
      setCurrentWeek(data.client?.current_week || 1);
    } catch (err) {
      console.error('Failed to fetch client:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveChanges() {
    setSaving(true);
    try {
      const res = await fetch(`/api/trainer/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-trainer-id': trainer!.id,
        },
        body: JSON.stringify({
          notes,
          current_phase: currentPhase,
          current_week: currentWeek,
        }),
      });

      if (res.ok) {
        setSavedMessage('Changes saved!');
        setTimeout(() => setSavedMessage(''), 3000);
        fetchClientData(clientId, trainer!.id);
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }

  function getProgramLabel(type: string): string {
    switch (type) {
      case 'event_ready': return 'Event Ready';
      case 'muscle_gain': return 'Muscle Gain';
      case 'general_health': return 'General Health';
      case 'first_responder': return 'First Responder';
      default: return type;
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-cream/60">Client not found</div>
      </div>
    );
  }

  const weightLost = client.starting_weight && client.current_weight
    ? Math.round((client.starting_weight - client.current_weight) * 10) / 10
    : 0;

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/trainer/clients" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-brand-cream">{client.name}</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 space-y-4">
        {/* Client Summary Card */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-brand-cream/50 text-sm">{client.email}</p>
              <p className="text-sm text-brand-cream/70 mt-1">
                {getProgramLabel(client.program_type || '')} • {client.gender || 'Not set'}
              </p>
              {client.event_date && (
                <p className="text-sm text-brand-orange mt-1">
                  Event: {new Date(client.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${getStatusColor(client.subscription_status)}`}>
                {client.subscription_status}
              </p>
            </div>
          </div>
        </div>

        {/* Weight Progress */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-3">Weight Progress</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-brand-cream/50 text-xs">Start</p>
              <p className="text-lg font-bold text-brand-cream">{client.starting_weight || '--'}</p>
            </div>
            <div>
              <p className="text-brand-cream/50 text-xs">Current</p>
              <p className="text-lg font-bold text-brand-orange">{client.current_weight || '--'}</p>
            </div>
            <div>
              <p className="text-brand-cream/50 text-xs">Goal</p>
              <p className="text-lg font-bold text-brand-cream">{client.goal_weight || '--'}</p>
            </div>
            <div>
              <p className="text-brand-cream/50 text-xs">Lost</p>
              <p className="text-lg font-bold text-green-400">
                {weightLost > 0 ? `-${weightLost}` : '0'}
              </p>
            </div>
          </div>
        </div>

        {/* Phase & Week Controls */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-3">Program Controls</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-brand-cream/50 mb-1">Phase</label>
              <select
                value={currentPhase}
                onChange={(e) => setCurrentPhase(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
              >
                {[1, 2, 3, 4].map((p) => (
                  <option key={p} value={p}>Phase {p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-brand-cream/50 mb-1">Week</label>
              <select
                value={currentWeek}
                onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-brand-cream/50 mb-1">Trainer Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange resize-none"
              placeholder="Add notes for this client..."
              rows={3}
            />
          </div>

          {savedMessage && (
            <div className="mb-2 p-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 text-sm text-center">
              ✓ {savedMessage}
            </div>
          )}

          <button
            onClick={handleSaveChanges}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
            <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-3">🏆 Milestones</h3>
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-brand-cream">
                    {m.milestone_type === 'goal' && '🎯 Final Goal!'}
                    {m.milestone_type === '10lb' && '10 lbs lost'}
                    {m.milestone_type === '20lb' && '20 lbs lost'}
                    {m.milestone_type === '30lb' && '30 lbs lost'}
                    {m.milestone_type === 'best_week' && 'Best Week Ever!'}
                  </span>
                  <span className="text-brand-cream/50 text-xs">
                    {new Date(m.achieved_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Weigh-ins */}
        {weighIns.length > 0 && (
          <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
            <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-3">Recent Weigh-ins</h3>
            <div className="space-y-2">
              {weighIns.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center justify-between text-sm">
                  <span className="text-brand-cream font-medium">{w.weight} lbs</span>
                  <span className="text-brand-cream/50 text-xs">
                    {new Date(w.created_at).toLocaleDateString()}
                    {w.weigh_day && ` • ${w.weigh_day}`}
                  </span>
                  {w.pant_size && (
                    <span className="text-brand-cream/50 text-xs">Pant: {w.pant_size}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Meals */}
        {mealLogs.length > 0 && (
          <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
            <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-3">Recent Meals</h3>
            <div className="space-y-2">
              {mealLogs.slice(0, 10).map((meal) => (
                <div
                  key={meal.id}
                  className={`p-3 rounded-lg text-sm ${
                    meal.messed_up
                      ? 'bg-red-500/10 border border-red-500/20'
                      : meal.on_phase
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'bg-brand-charcoal/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-brand-cream/50 text-xs uppercase">{meal.meal_type}</span>
                      <p className="text-brand-cream mt-1">{meal.food_description || 'Photo logged'}</p>
                    </div>
                    <span className={`text-xl ${
                      meal.messed_up ? '❌' : meal.on_phase ? '✅' : '⚠️'
                    }`} />
                  </div>
                  <p className="text-brand-cream/40 text-xs mt-1">
                    {new Date(meal.logged_at).toLocaleDateString()} {new Date(meal.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
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
