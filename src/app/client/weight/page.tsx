'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getClientUser, setClientUser } from '@/lib/auth';

interface ClientData {
  id: string;
  name: string;
  gender: string;
  current_phase: number;
  goal_weight: number;
  current_weight: number;
  starting_weight: number;
  program_type: string;
  event_date?: string;
  current_week: number;
  notes?: string;
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

export default function WeightPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recentWeights, setRecentWeights] = useState<WeighIn[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeighIn[]>([]);

  // Form state
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [pantSize, setPantSize] = useState('');
  const [waistSize, setWaistSize] = useState('');
  const [weighDay, setWeighDay] = useState<'monday' | 'friday'>('friday');

  // Check if client has weighed in on a specific day this week
  function hasWeighInOn(dayName: 'monday' | 'friday'): boolean {
    if (weightHistory.length === 0) return false;
    const today = new Date();
    // Find Monday of current week
    const mondayThisWeek = new Date(today);
    const dayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    mondayThisWeek.setDate(today.getDate() - dayIndex);
    mondayThisWeek.setHours(0, 0, 0, 0);

    // Friday is Monday + 4 days
    const fridayThisWeek = new Date(mondayThisWeek);
    fridayThisWeek.setDate(mondayThisWeek.getDate() + 4);

    const targetDate = dayName === 'monday' ? mondayThisWeek : fridayThisWeek;
    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    return weightHistory.some((w: WeighIn) => {
      const weighDate = new Date(w.created_at);
      return weighDate >= targetDate && weighDate < nextDay;
    });
  }

  // Get the next upcoming Monday or Friday date — respects weigh-in history
  function getWeighDayDate(day: 'monday' | 'friday'): string {
    const today = new Date();
    const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;

    // Find Monday of current week
    const mondayThisWeek = new Date(today);
    mondayThisWeek.setDate(today.getDate() - todayIndex);
    mondayThisWeek.setHours(0, 0, 0, 0);

    const fridayThisWeek = new Date(mondayThisWeek);
    fridayThisWeek.setDate(mondayThisWeek.getDate() + 4);

    const mondayDone = hasWeighInOn('monday');
    const fridayDone = hasWeighInOn('friday');

    if (day === 'monday') {
      // Show Monday (this week) if not done yet
      if (!mondayDone) {
        return mondayThisWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      // If Monday done but Friday not done — show Friday
      if (!fridayDone) {
        return fridayThisWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      // Both done — show next Monday
      const nextMonday = new Date(mondayThisWeek);
      nextMonday.setDate(mondayThisWeek.getDate() + 7);
      return nextMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      // Friday
      if (!fridayDone) {
        return fridayThisWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      // Friday done — show next Monday
      const nextMonday = new Date(mondayThisWeek);
      nextMonday.setDate(mondayThisWeek.getDate() + 7);
      return nextMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  // Response (no longer used - redirects to chat now)

  useEffect(() => {
    const user = getClientUser();
    if (!user) {
      router.push('/');
      return;
    }

    setClient(user);
    // Fetch fresh client data from server to ensure current_weight is accurate
    fetchClientData(user.id);
    fetchWeightHistory(user.id);
    setLoading(false);
  }, [router]);

  async function fetchWeightHistory(clientId: string) {
    try {
      const res = await fetch('/api/weight', {
        headers: { 'x-client-id': clientId },
      });
      const data = await res.json();
      setWeightHistory(data.weighIns || []);
      setRecentWeights((data.weighIns || []).slice(0, 4));
    } catch (err) {
      console.error('Failed to fetch weight history:', err);
    }
  }

  async function fetchClientData(clientId: string) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-client-id': clientId },
      });
      if (res.ok) {
        const data = await res.json();
        setClient(data.user);
        setClientUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.error('Failed to fetch client data:', err);
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weight || !client) return;

    setSubmitting(true);

    // Fetch fresh client data to ensure prevWeight is accurate (not stale from localStorage)
    const freshClient = await fetchClientData(client.id);
    const currentWeightForCalc = freshClient?.current_weight || client.current_weight || client.starting_weight;

    // Capture the previous weight BEFORE the API call updates the database
    // This is critical for the chat AI to correctly interpret the weight change
    const prevWeight = currentWeightForCalc;

    try {
      const res = await fetch('/api/weight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client.id,
        },
        body: JSON.stringify({
          weight: parseFloat(weight),
          bodyFatPercent: bodyFat ? parseFloat(bodyFat) : null,
          pantSize: pantSize || null,
          waistSize: waistSize || null,
          weighDay,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Use the captured prevWeight (from before the API call)
        const change = prevWeight - parseFloat(weight);
        const goalDiff = parseFloat(weight) - client.goal_weight;

        let response = '';
        if (change > 0) {
          response = `LEEEETS GOOOO! 🎉 You're down ${change.toFixed(1)} lbs! That's ${(goalDiff > 0 ? goalDiff.toFixed(1) + ' lbs to goal!' : 'AT GOAL!')} Keep crushing it!`;
        } else if (change < 0) {
          response = `No worries! Let's get back on track this week. Plan those foods! You've got this! 💪`;
        } else {
          response = `Same weight - totally fine! Plan those foods and eat perfect this week. Don't let your brain prevent your body from reaching your goal!`;
        }

        // Clear form
        // Prepare weight data to send to chat for AI analysis
        const weightPayload = {
          id: data.weighIn?.id || `weight_${Date.now()}`,
          weight: parseFloat(weight),
          bodyFatPercent: bodyFat ? parseFloat(bodyFat) : null,
          pantSize: pantSize || null,
          waistSize: waistSize || null,
          weighDay,
          previousWeight: prevWeight,
          change: change,
        };

        // Store pending weight data in localStorage for chat page to pick up
        localStorage.setItem('pending_weight_data', JSON.stringify(weightPayload));

        // Clear form
        setWeight('');
        setBodyFat('');
        setPantSize('');
        setWaistSize('');

        // Refresh history
        fetchWeightHistory(client.id);

        // Update local client state and localStorage (namespaced by client_id)
        const updatedClient = { ...client, current_weight: parseFloat(weight) };
        setClient(updatedClient);
        setClientUser(updatedClient);

        // Redirect to chat for AI weight commentary
        router.push('/client/chat');
      }
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // Determine which day to recommend
  const today = new Date().getDay();
  const isMonday = today === 1;
  const isFriday = today === 5;

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  const weightLost = client.starting_weight && client.current_weight
    ? Math.round((client.starting_weight - client.current_weight) * 10) / 10
    : 0;

  return (
    <main className="min-h-screen pb-24 pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <header className="px-6 py-4 pt-[env(safe-area-inset-top)] flex items-center justify-between">
        <Link href="/client" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-brand-cream">Log Weight</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 space-y-4">
        {/* Current Status */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-brand-cream/50 text-xs">Starting</p>
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
          </div>
          {weightLost > 0 && (
            <p className="text-center text-sm text-green-400 mt-3">
              🎉 {weightLost} lbs lost so far!
            </p>
          )}
        </div>

        {/* Weigh Day Reminder */}
        {(isMonday || isFriday) && (
          <div className={`p-4 rounded-xl ${isFriday ? 'bg-green-500/20' : 'bg-brand-orange/20'} border ${isFriday ? 'border-green-500/30' : 'border-brand-orange/30'}`}>
            <p className="text-center text-brand-cream font-medium">
              {isFriday ? "⚖️ It's FRIDAY! Weigh-in day! Track your Friday weight." : "⚖️ It's MONDAY! Weigh-in day!"}
            </p>
          </div>
        )}

        {/* Weight Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-brand-cream/60 mb-2">
              Weight (lbs) *
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-4 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-2xl text-center font-bold focus:outline-none focus:border-brand-orange"
              placeholder="0.0"
              required
            />
          </div>

          {/* Weigh Day */}
          <div>
            <label className="block text-sm text-brand-cream/60 mb-2">Weigh Day</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWeighDay('monday')}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  weighDay === 'monday'
                    ? 'bg-brand-orange text-white'
                    : 'bg-brand-charcoal/80 text-brand-cream/60'
                }`}
              >
                <span>Monday</span>
                <span className="block text-xs opacity-70">{getWeighDayDate('monday')}</span>
              </button>
              <button
                type="button"
                onClick={() => setWeighDay('friday')}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  weighDay === 'friday'
                    ? 'bg-brand-orange text-white'
                    : 'bg-brand-charcoal/80 text-brand-cream/60'
                }`}
              >
                <span>Friday</span>
                <span className="block text-xs opacity-70">{getWeighDayDate('friday')}</span>
              </button>
            </div>
          </div>

          {/* Optional Fields */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-brand-cream/60 hover:text-brand-cream">
              + Optional: Body fat %, pant/waist size
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-brand-cream/50 mb-1">Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange"
                    placeholder="--"
                  />
                </div>
                <div>
                  <label className="block text-xs text-brand-cream/50 mb-1">Pant Size</label>
                  <input
                    type="text"
                    value={pantSize}
                    onChange={(e) => setPantSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange"
                    placeholder="32"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-brand-cream/50 mb-1">Waist Size (inches)</label>
                <input
                  type="number"
                  step="0.5"
                  value={waistSize}
                  onChange={(e) => setWaistSize(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange"
                  placeholder="32"
                />
              </div>
            </div>
          </details>

          <button
            type="submit"
            disabled={submitting || !weight}
            className="w-full py-4 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Logging...' : '✓ Log Weight'}
          </button>
        </form>

        {/* Recent History */}
        {recentWeights.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-2">Recent Weigh-ins</h3>
            <div className="space-y-2">
              {recentWeights.map((w) => {
                const date = new Date(w.created_at);
                return (
                  <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-brand-charcoal/60 border border-brand-cream/10">
                    <div>
                      <p className="text-brand-cream font-semibold">{w.weight} lbs</p>
                      <p className="text-xs text-brand-cream/50">
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {w.pant_size && (
                      <div className="text-right">
                        <p className="text-xs text-brand-cream/50">Pant</p>
                        <p className="text-sm text-brand-cream">{w.pant_size}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom">
        <div className="flex justify-around py-3">
          <Link href="/client" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">🏠</span>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/client/log" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">📸</span>
            <span className="text-xs mt-1">Log</span>
          </Link>
          <Link href="/client/chat" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">💬</span>
            <span className="text-xs mt-1">Chat</span>
          </Link>
          <Link href="/client/weight" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">⚖️</span>
            <span className="text-xs mt-1">Weight</span>
          </Link>
          <Link href="/client/profile" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
