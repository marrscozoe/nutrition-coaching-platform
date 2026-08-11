'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AddToHomeScreenBanner from '@/components/AddToHomeScreenBanner';
import PullToRefresh from '@/components/PullToRefresh';
import { logout } from '@/lib/auth';

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
}

interface MealLog {
  id: string;
  meal_type: string;
  food_description: string;
  on_phase: boolean;
  messed_up: boolean;
  logged_at: string;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [recentMeals, setRecentMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle returning to the dashboard (e.g., after logging a meal)
  // This catches cases where client-side navigation brings user back without pathname changing
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const userData = localStorage.getItem('client_user');
        if (userData) {
          const user = JSON.parse(userData);
          fetchRecentMeals(user.id);
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    // Check if user is logged in (use separate client keys to avoid overwriting trainer session)
    const userData = localStorage.getItem('client_user');
    const userType = localStorage.getItem('client_user_type');

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
        // Update localStorage with fresh data (use client-specific key)
        localStorage.setItem('client_user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Failed to fetch client data:', err);
    }
  }

  async function handleRefresh() {
    const userData = localStorage.getItem('client_user');
    if (userData) {
      const user = JSON.parse(userData);
      await Promise.all([
        fetchClientData(user.id),
        fetchRecentMeals(user.id)
      ]);
    }
  }

  function getPhaseAdvice(phase: number): string {
    switch (phase) {
      case 1: return 'No starch — protein, fibrous vegetables, and healthy fats only';
      case 2: return 'Add starch Wed/Sat/Sun to first 2 meals';
      case 3: return 'Evaluation checkpoint — are you at goal?';
      case 4: return 'Maintenance — add starch to every meal';
      default: return 'Keep following your plan';
    }
  }

  function getPhaseGuidance(phase: number, gender?: string): {
    canEat: string[];
    cannotEat: string[];
    water: string;
    exampleMeal: string;
  } {
    const isFemale = gender === 'female';
    const proteinOz = isFemale ? '4oz' : '6oz';
    const waterDaily = isFemale ? '80 oz' : '128 oz';
    const waterPerMeal = isFemale ? '20 oz' : '32 oz';

    switch (phase) {
      case 1:
        return {
          canEat: [
            `Lean protein: ${proteinOz} chicken, beef, fish, eggs, turkey`,
            `Fibrous vegetables: ${isFemale ? '1-2 cups' : '2 cups'} broccoli, spinach, salad, peppers`,
            `Healthy fats: ${isFemale ? '1 tbsp' : '2 tbsp'} olive oil or 1/2 avocado`,
          ],
          cannotEat: [
            'NO starch — no bread, rice, pasta, potato, beans, corn, oatmeal, cereal',
          ],
          water: `${waterDaily} water daily (${waterPerMeal} per meal)`,
          exampleMeal: `${proteinOz} grilled chicken breast, ${isFemale ? '1-2 cups' : '2 cups'} broccoli, ${isFemale ? '1 tbsp' : '2 tbsp'} olive oil, ${waterPerMeal} water`,
        };
      case 2:
        return {
          canEat: [
            `Lean protein: ${proteinOz} chicken, beef, fish, eggs, turkey`,
            `Fibrous vegetables: ${isFemale ? '1-2 cups' : '2 cups'} broccoli, spinach, salad, peppers`,
            `Healthy fats: ${isFemale ? '1 tbsp' : '2 tbsp'} olive oil or 1/2 avocado`,
            `Starch (Wed/Sat/Sun only, first 2 meals): oatmeal, rice, potato — ${isFemale ? '1 cup' : '2 cups'}`,
          ],
          cannotEat: [
            'NO starch on Mon, Tue, Thu, Fri',
            'NO starch in dinner or snacks (first 2 meals only)',
          ],
          water: `${waterDaily} water daily (${waterPerMeal} per meal)`,
          exampleMeal: `${isFemale ? '2 eggs' : '3 eggs'} scrambled, ${isFemale ? '1' : '2'} cups oatmeal, 1 cup spinach, no additional fat, ${waterPerMeal} water`,
        };
      case 3:
        return {
          canEat: [
            'Same as Phase 2 rules until decision made',
          ],
          cannotEat: [
            'Check with your coach before adding starch',
          ],
          water: `${waterDaily} water daily (${waterPerMeal} per meal)`,
          exampleMeal: 'Check with your coach about starch and portions',
        };
      case 4:
        return {
          canEat: [
            `Lean protein: ${proteinOz} chicken, beef, fish, eggs, turkey`,
            `Fibrous vegetables: ${isFemale ? '1-2 cups' : '2 cups'} unlimited`,
            `Healthy fats: ${isFemale ? '1 tbsp' : '2 tbsp'} olive oil or 1/2 avocado`,
            `Natural starch: rice, potato, oatmeal — every meal — ${isFemale ? '1 cup' : '2 cups'}`,
          ],
          cannotEat: [
            'Limit processed starches (bread, chips, fries)',
            'If weight goes 5+ lbs over goal: back to Phase 1',
          ],
          water: `${waterDaily} water daily (${waterPerMeal} per meal)`,
          exampleMeal: `${proteinOz} grilled fish, ${isFemale ? '1' : '2'} cups rice, ${isFemale ? '1-2 cups' : '2 cups'} mixed vegetables, ${isFemale ? '1 tbsp' : '2 tbsp'} olive oil, ${waterPerMeal} water`,
        };
      default:
        return {
          canEat: [],
          cannotEat: [],
          water: `${waterDaily} water daily (${waterPerMeal} per meal)`,
          exampleMeal: '',
        };
    }
  }

  function getWeeksUntilEvent(eventDate?: string): number | null {
    if (!eventDate) return null;
    const weeks = Math.ceil((new Date(eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000));
    return weeks > 0 ? weeks : null;
  }

  function getCurrentWeek(startDate?: string): number {
    // Defensive: if startDate is missing/invalid, try current_week from API first
    if (!startDate || startDate === 'undefined' || startDate === 'null' || startDate === 'Invalid Date') {
      // Fall back to current_week from client data if available, else default to 1
      return (client as any)?.current_week || 1;
    }
    const start = new Date(startDate + 'T12:00:00');
    // If date is still invalid, use current_week fallback
    if (isNaN(start.getTime())) {
      return (client as any)?.current_week || 1;
    }
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, diffDays + 1);
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

  const weightLost = client.starting_weight && client.current_weight
    ? Math.round((client.starting_weight - client.current_weight) * 10) / 10
    : 0;

  const weeksUntilEvent = getWeeksUntilEvent(client.event_date);
  const currentWeek = getCurrentWeek(client.goal_start_date);
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
      {weeksUntilEvent !== null && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r from-brand-orange to-brand-orange-dark">
          <p className="text-white/80 text-sm font-medium">🎯 {weeksUntilEvent} weeks until your event!</p>
          <p className="text-white text-xs mt-1">Keep pushing — you've got this!</p>
        </div>
      )}

      {/* Progress Card */}
      <div className="mx-4 mt-4 p-5 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-brand-cream/60 text-xs uppercase tracking-wider">Current Phase</p>
            <p className="text-2xl font-bold text-brand-orange">Phase {client.current_phase}</p>
          </div>
          <div className="text-right">
            <p className="text-brand-cream/60 text-xs uppercase tracking-wider">Week</p>
            <p className="text-2xl font-bold text-brand-cream">{currentWeek}</p>
          </div>
        </div>
        <p className="text-sm text-brand-cream/70">{getPhaseAdvice(client.current_phase)}</p>

        {/* Phase Guidance - Can Eat / Cannot Eat */}
        {(() => {
          // Ensure phase is valid (default to phase 1 if invalid)
          const phase = client.current_phase && client.current_phase >= 1 && client.current_phase <= 4 
            ? client.current_phase 
            : 1;
          const guidance = getPhaseGuidance(phase, client.gender);
          return (
            <div className="mt-4 pt-4 border-t border-brand-cream/10">
              {/* Can Eat */}
              <div className="mb-3">
                <p className="text-xs text-green-400 font-semibold mb-1">✓ CAN EAT:</p>
                {guidance.canEat.map((item, i) => (
                  <p key={i} className="text-xs text-brand-cream/70 pl-3">
                    • {item}
                  </p>
                ))}
              </div>
              {/* Cannot Eat */}
              <div className="mb-3">
                <p className="text-xs text-red-400 font-semibold mb-1">✗ CANNOT EAT:</p>
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
          <p className="text-brand-cream/60 text-xs mb-1">Lost</p>
          <p className="text-lg font-bold text-green-400">{weightLost > 0 ? `-${weightLost}` : '0'}</p>
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
