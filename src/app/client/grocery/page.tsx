'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AddToHomeScreenBanner from '@/components/AddToHomeScreenBanner';
import PullToRefresh from '@/components/PullToRefresh';

interface ClientData {
  id: string;
  name: string;
  gender: string;
  current_phase: number;
  current_week: number;
  current_weight: number;
  goal_weight: number;
  starting_weight: number;
  program_type: string;
  phase5_plan?: string | null;
  phase5_start_date?: string | null;
}

interface GroceryItem {
  id: string;
  item_name: string;
  category: 'protein' | 'veggies' | 'starch' | 'fats';
  checked: boolean;
}

interface PhaseInfo {
  phase: number;
  starchIncluded: boolean;
  starchNote: string;
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  protein: { label: 'Protein', emoji: '🍗', color: 'red' },
  veggies: { label: 'Veggies', emoji: '🥬', color: 'green' },
  starch: { label: 'Starch', emoji: '🍠', color: 'orange' },
  fats: { label: 'Fats', emoji: '🥑', color: 'yellow' },
};

export default function GroceryPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    protein: true,
    veggies: true,
    starch: true,
    fats: true,
  });

  // Determine if starch is allowed for current phase
  function getPhaseInfo(client: ClientData): PhaseInfo {
    const phase = client.current_phase;
    const starchIncluded = isStarchAllowedForPhase(client);
    let starchNote = '';
    if (!starchIncluded) {
      if (phase === 1) starchNote = 'No starch in Phase 1';
      else if (phase === 6) starchNote = 'No starch in Phase 6';
      else starchNote = 'No starch this phase';
    }
    return { phase, starchIncluded, starchNote };
  }

  useEffect(() => {
    const userData = sessionStorage.getItem('client_user');
    const userType = sessionStorage.getItem('client_user_type');
    if (!userData || userType !== 'client') {
      router.push('/');
      return;
    }
    const user = JSON.parse(userData);
    setClient(user);
    fetchGroceryList(user.id);
  }, [router]);

  async function fetchGroceryList(clientId: string) {
    try {
      const res = await fetch('/api/grocery', {
        headers: { 'x-client-id': clientId },
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch grocery list:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(clientId: string) {
    setGenerating(true);
    try {
      const res = await fetch('/api/grocery/generate', {
        method: 'POST',
        headers: { 'x-client-id': clientId },
      });
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to generate grocery list:', err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleClear(clientId: string) {
    if (!confirm('Clear your entire grocery list?')) return;
    setClearing(true);
    try {
      await fetch('/api/grocery', {
        method: 'DELETE',
        headers: { 'x-client-id': clientId },
      });
      setItems([]);
    } catch (err) {
      console.error('Failed to clear grocery list:', err);
    } finally {
      setClearing(false);
    }
  }

  async function handleToggleItem(item: GroceryItem, clientId: string) {
    // Optimistic update
    setItems(prev =>
      prev.map(i =>
        i.id === item.id ? { ...i, checked: !i.checked } : i
      )
    );

    try {
      await fetch(`/api/grocery/${item.id}`, {
        method: 'PATCH',
        headers: {
          'x-client-id': clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ checked: !item.checked }),
      });
    } catch (err) {
      console.error('Failed to toggle item:', err);
      // Revert on error
      setItems(prev =>
        prev.map(i =>
          i.id === item.id ? { ...i, checked: !item.checked } : i
        )
      );
    }
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  const phaseInfo = getPhaseInfo(client);

  // Group items by category
  const groupedItems: Record<string, GroceryItem[]> = {
    protein: items.filter(i => i.category === 'protein'),
    veggies: items.filter(i => i.category === 'veggies'),
    starch: items.filter(i => i.category === 'starch'),
    fats: items.filter(i => i.category === 'fats'),
  };

  const checkedCount = items.filter(i => i.checked).length;

  return (
    <>
      <PullToRefresh onRefresh={() => fetchGroceryList(client.id)}>
        <div className="min-h-screen pb-[96px]">
          <main>
            {/* Header */}
            <header className="bg-brand-charcoal/90 backdrop-blur-sm sticky top-0 z-50 px-6 py-4 pt-[env(safe-area-inset-top)]">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-brand-orange">🛒 Smart Grocery List</h1>
                  <p className="text-sm text-brand-cream/60">Phase {phaseInfo.phase} {phaseInfo.starchIncluded ? '· Starch included' : '· No starch'}</p>
                </div>
                <Link href="/client" className="text-brand-cream/60 hover:text-brand-cream text-sm">
                  ← Back
                </Link>
              </div>
            </header>

            {/* Phase info banner */}
            {!phaseInfo.starchIncluded && (
              <div className="mx-4 mt-4 p-3 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
                <p className="text-sm text-brand-cream/70">
                  <span className="text-yellow-400">ℹ️ {phaseInfo.starchNote}</span> — starch is not included in your grocery list this phase.
                </p>
              </div>
            )}

            {/* Progress bar */}
            {items.length > 0 && (
              <div className="mx-4 mt-4">
                <div className="flex justify-between text-xs text-brand-cream/60 mb-1">
                  <span>{checkedCount} of {items.length} items checked</span>
                  <span>{Math.round((checkedCount / items.length) * 100)}%</span>
                </div>
                <div className="h-2 bg-brand-charcoal/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-orange transition-all duration-300"
                    style={{ width: `${(checkedCount / items.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mx-4 mt-4 flex gap-3">
              <button
                onClick={() => handleGenerate(client.id)}
                disabled={generating}
                className="flex-1 py-3 px-4 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    🔄 Generate New List
                  </>
                )}
              </button>
              <button
                onClick={() => handleClear(client.id)}
                disabled={clearing || items.length === 0}
                className="py-3 px-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream/70 font-semibold hover:text-red-400 hover:border-red-400/50 transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            </div>

            {/* Grocery Buckets */}
            <div className="mx-4 mt-4 space-y-3">
              {(['protein', 'veggies', 'starch', 'fats'] as const).map(category => {
                const catInfo = CATEGORY_LABELS[category];
                const catItems = groupedItems[category];
                const isExpanded = expandedCategories[category];
                const checkedInCat = catItems.filter(i => i.checked).length;
                const showEmptyStarch = category === 'starch' && !phaseInfo.starchIncluded;

                return (
                  <div key={category} className="rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{catInfo.emoji}</span>
                        <span className="font-semibold text-brand-cream">{catInfo.label}</span>
                        {catItems.length > 0 && (
                          <span className="text-xs text-brand-cream/50">
                            ({checkedInCat}/{catItems.length})
                          </span>
                        )}
                      </div>
                      <span className={`text-brand-cream/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {/* Category Items */}
                    {isExpanded && (
                      <div className="px-4 pb-3">
                        {showEmptyStarch ? (
                          <p className="text-sm text-brand-cream/50 italic py-2">
                            No starch in Phase {phaseInfo.phase} — your list reflects your current phase rules.
                          </p>
                        ) : catItems.length === 0 ? (
                          <p className="text-sm text-brand-cream/50 italic py-2">
                            No items yet. Tap "Generate New List" to build your grocery list.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {catItems.map(item => (
                              <label
                                key={item.id}
                                className={`flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors ${
                                  item.checked
                                    ? 'bg-green-500/10 text-brand-cream/50'
                                    : 'hover:bg-brand-cream/5'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={() => handleToggleItem(item, client.id)}
                                  className="w-5 h-5 rounded border-brand-cream/30 text-brand-orange focus:ring-brand-orange focus:ring-offset-0 accent-brand-orange"
                                />
                                <span className={`text-sm ${item.checked ? 'line-through' : ''}`}>
                                  {item.item_name}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tips */}
            <div className="mx-4 mt-6 p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
              <p className="text-xs text-brand-cream/60">
                💡 <strong>Tip:</strong> Check off items as you shop. Your list saves automatically. Generate a new list anytime to refresh your options.
              </p>
            </div>
          </main>
        </div>
      </PullToRefresh>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom z-50">
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
          <Link href="/client/weight" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">⚖️</span>
            <span className="text-xs mt-1">Weight</span>
          </Link>
          <Link href="/client/grocery" className="flex flex-col items-center text-brand-orange">
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

function isStarchAllowedForPhase(client: ClientData): boolean {
  const phase = client.current_phase;
  if (phase === 1) return false;
  if (phase === 6) return false;
  if (phase === 2 || phase === 3 || phase === 4) return true;
  if (phase === 5 && client.phase5_plan && client.phase5_start_date) {
    try {
      const raw = typeof client.phase5_plan === 'string'
        ? JSON.parse(client.phase5_plan)
        : client.phase5_plan;
      const plan = Array.isArray(raw) ? raw : (raw?.days || []);
      const startDate = client.phase5_start_date;
      const [y, m, d] = startDate.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const currentDay = Math.min(14, Math.max(1, diffDays + 1));
      const todayRule = plan.find((d: { day: number }) => d.day === currentDay);
      return todayRule?.type === 'phase2' || todayRule?.type === 'phase4';
    } catch {
      return false;
    }
  }
  return false;
}
