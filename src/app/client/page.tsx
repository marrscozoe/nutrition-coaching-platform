'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AddToHomeScreenBanner from '@/components/AddToHomeScreenBanner';
import PullToRefresh from '@/components/PullToRefresh';
import { logout } from '@/lib/auth';
import { getPhaseGuidance, getPortions, LEAN_PROTEINS, FIBROUS_VEGETABLES, HEALTHY_FATS, STARCHY_CARBOHYDRATES } from '@/lib/nutrition-data';

interface ClientData {
  id: string;
  name: string;
  current_phase: number;
  current_week: number;
  current_weight: number;
  goal_weight: number;
  starting_weight: number;
  goal_start_date?: string;
  event_date?: string;
  program_type: string;
  gender: string;
  phase5_plan?: string;
  phase5_start_date?: string;
}

interface MealLog {
  id: string;
  meal_type: string;
  food_description: string;
  on_phase: boolean;
  messed_up: boolean;
  logged_at: string;
  meal_date?: string;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [recentMeals, setRecentMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle returning to the dashboard (e.g., after logging a meal or switching programs)
  // This catches cases where client-side navigation brings user back without pathname changing
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const userData = sessionStorage.getItem('client_user');
        if (userData) {
          const user = JSON.parse(userData);
          // Fetch BOTH fresh client data and meals to ensure we have latest program/event info
          fetchClientData(user.id);
          fetchRecentMeals(user.id);
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    // Check if user is logged in (use separate client keys to avoid overwriting trainer session)
    const userData = sessionStorage.getItem('client_user');
    const userType = sessionStorage.getItem('client_user_type');

    if (!userData || userType !== 'client') {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    setClient(user);

    // Fetch fresh client data from server on mount
    fetchClientData(user.id);
    // Fetch recent meals
    fetchRecentMeals(user.id);
  }, [router]);

  async function fetchRecentMeals(clientId: string) {
    try {
      const res = await fetch('/api/meals?limit=5', {
        headers: { 'x-client-id': clientId },
      });
      const data = await res.json();
      setRecentMeals(data.meals || []);
    } catch (err) {
      console.error('Failed to fetch meals:', err);
    } finally {
      setLoading(false);
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
        // Update sessionStorage with fresh data (use client-specific key)
        sessionStorage.setItem('client_user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Failed to fetch client data:', err);
    }
  }

  async function handleRefresh() {
    const userData = sessionStorage.getItem('client_user');
    if (userData) {
      const user = JSON.parse(userData);
      await Promise.all([
        fetchClientData(user.id),
        fetchRecentMeals(user.id)
      ]);
    }
  }



  function getWeeksUntilEvent(eventDate?: string): number | null {
    if (!eventDate) return null;
    const days = Math.ceil((new Date(eventDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return days > 0 ? days : null;
  }

  async function handleLogout() {
    await logout();
  }

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  // weightLost = Starting - Current: positive = lost weight, negative = gained weight
  const weightLost = client.starting_weight && client.current_weight
    ? Math.round((client.starting_weight - client.current_weight) * 10) / 10
    : 0;

  const weeksUntilEvent = getWeeksUntilEvent(client.event_date);
  const today = new Date().getDay();
  const isMonday = today === 1;
  const isFriday = today === 5;

  return (
    <>
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen pb-[96px]">
    <main>
      {/* Header */}
      <header className="bg-brand-charcoal/90 backdrop-blur-sm sticky top-0 z-50 px-6 py-4 pt-[env(safe-area-inset-top)] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-orange">AMarsBody</h1>
          <p className="text-sm text-brand-cream/60">Welcome, {client.name}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-brand-cream/60 hover:text-brand-cream"
        >
          Logout
        </button>
      </header>

      {/* Event Countdown Banner */}
      {weeksUntilEvent !== null && client.program_type === 'event_ready' && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r from-brand-orange to-brand-orange-dark">
          <p className="text-white/80 text-sm font-medium">🎯 {weeksUntilEvent} days until your event!</p>
          <p className="text-white text-xs mt-1">Keep pushing — you've got this!</p>
        </div>
      )}

      {/* Food Categories - 4 Main Groups */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-brand-cream/80 uppercase tracking-wider mb-3">Your 4 Food Groups</h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Lean Protein */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🍗</span>
              <h3 className="text-sm font-bold text-red-400">Lean Protein</h3>
            </div>
            <p className="text-xs text-brand-cream/70 mb-2">{client.gender === 'male' ? '6 oz' : '4 oz'} per meal</p>
            <p className="text-xs text-brand-cream/50 leading-relaxed">
              {LEAN_PROTEINS.slice(0, 5).join(', ')}...
            </p>
          </div>

          {/* Fibrous Vegetables */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🥬</span>
              <h3 className="text-sm font-bold text-green-400">Fibrous Veggies</h3>
            </div>
            <p className="text-xs text-brand-cream/70 mb-2">{client.gender === 'male' ? '2 cups' : '1-2 cups'} per meal</p>
            <p className="text-xs text-brand-cream/50 leading-relaxed">
              {FIBROUS_VEGETABLES.slice(0, 5).join(', ')}...
            </p>
          </div>

          {/* Healthy Fats */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🥑</span>
              <h3 className="text-sm font-bold text-yellow-400">Healthy Fats</h3>
            </div>
            <p className="text-xs text-brand-cream/70 mb-2">{getPortions(client.gender as 'male' | 'female', client.current_phase).fat} per meal</p>
            <p className="text-xs text-brand-cream/50 leading-relaxed">
              {HEALTHY_FATS.slice(0, 4).join(', ')}...
            </p>
          </div>

          {/* Starchy Carbohydrates */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🍠</span>
              <h3 className="text-sm font-bold text-orange-400">Starchy Carbs</h3>
            </div>
            <p className="text-xs text-brand-cream/70 mb-2">{getPortions(client.gender as 'male' | 'female', client.current_phase).starch} per meal</p>
            <p className="text-xs text-brand-cream/50 leading-relaxed">
              {STARCHY_CARBOHYDRATES.slice(0, 4).join(', ')}...
            </p>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div className="mx-4 mt-4 p-5 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
        <p className="text-sm text-brand-cream/70">{getPhaseGuidance(client.current_phase, client.gender as 'male' | 'female').advice}</p>

        {/* Phase Guidance - Can Eat / Cannot Eat */}
        {(() => {
          // Ensure phase is valid (default to phase 1 if invalid)
          const phase = client.current_phase && client.current_phase >= 1 && client.current_phase <= 6 
            ? client.current_phase 
            : 1;
          // Parse Phase 5 plan if available
          let phase5Plan;
          if (client.phase5_plan) {
            try {
              phase5Plan = JSON.parse(client.phase5_plan);
            } catch {
              phase5Plan = undefined;
            }
          }
          const guidance = getPhaseGuidance(
            phase,
            client.gender as 'male' | 'female',
            phase5Plan,
            client.phase5_start_date
          );
          return (
            <div className="mt-4 pt-4 border-t border-brand-cream/10">
              {/* Cannot Eat - Important Warnings */}
              <div className="mb-3">
                <p className="text-xs text-red-400 font-semibold mb-1">✗ AVOID:</p>
                {guidance.cannotEat.map((item, i) => (
                  <p key={i} className="text-xs text-brand-cream/70 pl-3">
                    • {item}
                  </p>
                ))}
              </div>
              {/* Water */}
              <div className="mb-3">
                <p className="text-xs text-blue-400 font-semibold mb-1">💧 WATER:</p>
                <p className="text-xs text-brand-cream/70 pl-3">
                  • {guidance.water}
                </p>
              </div>
              {/* Example Meal */}
              <div className="p-3 rounded-lg bg-brand-orange/10 border border-brand-orange/20">
                <p className="text-xs text-brand-orange font-semibold mb-1">🍽️ EXAMPLE MEAL:</p>
                <p className="text-xs text-brand-cream/70">
                  {guidance.exampleMeal}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Weight Stats */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
          <p className="text-brand-cream/60 text-xs mb-1">Starting</p>
          <p className="text-lg font-bold text-brand-cream">{client.starting_weight || '--'}</p>
          <p className="text-brand-cream/40 text-xs">lbs</p>
        </div>
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
          <p className="text-brand-cream/60 text-xs mb-1">Current</p>
          <p className="text-lg font-bold text-brand-orange">{client.current_weight || '--'}</p>
          <p className="text-brand-cream/40 text-xs">lbs</p>
        </div>
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
          <p className="text-brand-cream/60 text-xs mb-1">Lost/Gain</p>
          <p className={`text-lg font-bold ${weightLost > 0 ? 'text-green-400' : weightLost < 0 ? 'text-red-400' : 'text-brand-cream/60'}`}>
            {weightLost > 0 ? `-${weightLost}` : weightLost < 0 ? `+${Math.abs(weightLost)}` : '0'}
          </p>
          <p className="text-brand-cream/40 text-xs">lbs</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mx-4 mt-6">
        <h2 className="text-sm font-semibold text-brand-cream/80 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/client/log"
            className="p-4 rounded-xl bg-brand-orange text-white text-center font-semibold hover:bg-brand-orange-dark transition-colors"
          >
            <span className="text-2xl mb-1 block">📸</span>
            Log Meal
          </Link>
          <Link
            href="/client/weight"
            className={`p-4 rounded-xl text-white text-center font-semibold transition-colors ${
              isMonday || isFriday
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-brand-orange hover:bg-brand-orange-dark'
            }`}
          >
            <span className="text-2xl mb-1 block">⚖️</span>
            Log Weight
          </Link>
        </div>
        {(isMonday || isFriday) && (
          <p className="text-center text-xs text-brand-cream/50 mt-2">
            {isMonday ? "It's Monday! Time to weigh in!" : "It's Friday! Weigh-in day!"}
          </p>
        )}
      </div>

      {/* Recent Meals */}
      <div className="mx-4 mt-6">
        <h2 className="text-sm font-semibold text-brand-cream/80 uppercase tracking-wider mb-3">Recent Meals</h2>
        {recentMeals.length === 0 ? (
          <div className="p-6 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
            <p className="text-brand-cream/50 text-sm">No meals logged yet today.</p>
            <Link href="/client/log" className="text-brand-orange text-sm hover:underline mt-2 inline-block">
              Log your first meal →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentMeals.map((meal) => (
              <div
                key={meal.id}
                className={`p-4 rounded-xl border ${
                  meal.messed_up
                    ? 'bg-red-500/10 border-red-500/30'
                    : meal.on_phase
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-brand-charcoal/80 border-brand-cream/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-brand-cream/50 uppercase">{meal.meal_type}</span>
                    <p className="text-sm text-brand-cream mt-1">{meal.food_description || 'Photo logged'}</p>
                  </div>
                  <span className={`text-xl ${
                    meal.messed_up ? '❌' : meal.on_phase ? '✅' : '⚠️'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </main>
    </div>
    </PullToRefresh>

    {/* Bottom Navigation - OUTSIDE PullToRefresh so it stays fixed */}
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom z-50">
        <div className="flex justify-around py-3">
          <Link href="/client" className="flex flex-col items-center text-brand-orange">
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
          <Link href="/client/weight" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">⚖️</span>
            <span className="text-xs mt-1">Weight</span>
          </Link>
          <Link href="/client/grocery" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">🛒</span>
            <span className="text-xs mt-1">Grocery</span>
          </Link>
          <Link href="/client/profile" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>

      <AddToHomeScreenBanner />
    </>
  );
}
