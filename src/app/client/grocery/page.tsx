'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AddToHomeScreenBanner from '@/components/AddToHomeScreenBanner';
import PullToRefresh from '@/components/PullToRefresh';
import {
  LEAN_PROTEINS,
  FIBROUS_VEGETABLES,
  STARCHY_CARBOHYDRATES,
  HEALTHY_FATS,
  filterFoodsForAllergies,
  get12MealTotals,
  toStandardUnit,
} from '@/lib/nutrition-data';
import type { AdjustedTotals, GroceryItem } from '@/lib/grocery-types';

interface ClientData {
  id: string;
  name: string;
  gender: string;
  current_phase: number;
  allergies?: string[];
  custom_allergy_bans?: string[];
}

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as any;
}

function isStarchAllowedForPhase(phase: number): boolean {
  return ![1, 5].includes(phase);
}

/** Scale AdjustedTotals from 12 meals to a target meal count */
function scaleTotals(totals: AdjustedTotals, mealCount: number): AdjustedTotals {
  const factor = mealCount / 12;
  return {
    protein_lb: Math.round(totals.protein_lb * factor * 10) / 10,
    veggies_cups: Math.round(totals.veggies_cups * factor * 10) / 10,
    starch_cups: Math.round(totals.starch_cups * factor * 10) / 10,
    fats_oz: Math.round(totals.fats_oz * factor * 10) / 10,
    eggs_carton: Math.max(1, Math.ceil(mealCount / 12)),
  };
}

function TotalRow({
  emoji, label, unit, total, remaining, onChange
}: {
  emoji: string; label: string; unit: string;
  total: number; remaining: number; onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(total);
  const pct = total > 0 ? Math.round((1 - remaining / total) * 100) : 0;

  useEffect(() => { setVal(total); }, [total]);

  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{emoji}</span>
      <span className="text-sm font-semibold text-gray-800 flex-1">{label}</span>
      {editing ? (
        <input
          type="number"
          value={val}
          onChange={e => setVal(parseFloat(e.target.value) || 0)}
          onBlur={() => { onChange(val); setEditing(false); }}
          className="w-20 px-3 py-2 rounded-lg text-base font-mono text-center border-2 border-blue-400 bg-white focus:border-blue-600 focus:outline-none shadow-sm"
          autoFocus min="0" step="0.5"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-20 text-center text-base font-mono font-bold bg-white border-2 border-blue-300 rounded-lg px-2 py-1.5 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-900 shadow-sm"
        >
          {total} {unit}
        </button>
      )}
      <span className="text-xs text-gray-600 w-28 text-right font-medium">→ {remaining.toFixed(1)} {unit} left</span>
      <div className="w-20 h-2.5 bg-blue-200 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full bg-blue-600 transition-all rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EggsRow({
  cartons, remaining, onChange
}: {
  cartons: number; remaining: number; onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(cartons);
  const cartonSizes = [12, 18, 24];

  useEffect(() => { setVal(cartons); }, [cartons]);

  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">🥚</span>
      <span className="text-sm font-semibold text-gray-800 flex-1">Eggs</span>
      <div className="flex gap-1">
        {cartonSizes.map(size => (
          <span key={size} className="px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800">{size}</span>
        ))}
      </div>
      {editing ? (
        <input
          type="number"
          value={val}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          onBlur={() => setEditing(false)}
          className="w-20 px-3 py-2 rounded-lg text-base font-mono text-center border-2 border-purple-400 bg-white focus:border-purple-600 focus:outline-none shadow-sm"
          min="1"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-20 text-center text-base font-mono font-bold bg-white border-2 border-purple-300 rounded-lg px-2 py-1.5 hover:border-purple-500 hover:bg-purple-50 transition-colors text-gray-900 shadow-sm"
        >
          {cartons} carton{cartons !== 1 ? 's' : ''}
        </button>
      )}
      <span className="text-xs text-gray-600 w-20 text-right font-medium">→ {remaining.toFixed(1)} left</span>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  protein: { label: 'Protein', emoji: '🍗' },
  veggies: { label: 'Veggies', emoji: '🥬' },
  starch: { label: 'Starch', emoji: '🍠' },
  fats: { label: 'Fats', emoji: '🥑' },
  eggs: { label: 'Eggs', emoji: '🥚' },
};

type TabKey = 'protein' | 'veggies' | 'starch' | 'fats' | 'eggs';

export default function GroceryPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [notes, setNotes] = useState('');
  const [adjustedTotals, setAdjustedTotals] = useState<AdjustedTotals>({
    protein_lb: 3, veggies_cups: 24, starch_cups: 0, fats_oz: 12, eggs_carton: 1
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('protein');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState('');
  const [addAmount, setAddAmount] = useState(0);
  const [addUnit, setAddUnit] = useState<'lb' | 'cups' | 'oz' | 'carton'>('lb');
  const [mealCount, setMealCount] = useState(12);
  const [mealCountEditing, setMealCountEditing] = useState(false);
  const [mealCountVal, setMealCountVal] = useState(12);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    const userData = sessionStorage.getItem('client_user');
    const userType = sessionStorage.getItem('client_user_type');
    if (!userData || userType !== 'client') { router.push('/'); return; }
    const user: ClientData = JSON.parse(userData);
    setClient(user);
    const defaults = get12MealTotals(
      user.gender === 'female' ? 'female' : 'male',
      user.current_phase
    );
    setAdjustedTotals(defaults);
    fetchGroceryList(user.id);
  }, [router]);

  async function fetchGroceryList(clientId: string) {
    try {
      const res = await fetch('/api/grocery/list', {
        headers: { 'x-client-id': clientId },
      });
      const data = await res.json();
      setItems(data.items || []);
      setNotes(data.list?.notes || '');
      if (data.list?.adjustedTotals && Object.keys(data.list.adjustedTotals).length > 0) {
        setAdjustedTotals(data.list.adjustedTotals);
      }
    } catch (err) {
      console.error('fetchGroceryList error:', err);
    } finally {
      setLoading(false);
    }
  }

  function computeRemaining() {
    const remaining = { ...adjustedTotals };
    for (const item of items) {
      if (!item.shop_amount || !item.unit) continue;
      const std = toStandardUnit(item.shop_amount, item.unit);
      switch (item.category) {
        case 'protein': remaining.protein_lb = Math.max(0, remaining.protein_lb - std); break;
        case 'veggies': remaining.veggies_cups = Math.max(0, remaining.veggies_cups - std); break;
        case 'starch': remaining.starch_cups = Math.max(0, remaining.starch_cups - std); break;
        case 'fats': remaining.fats_oz = Math.max(0, remaining.fats_oz - std); break;
        case 'eggs': remaining.eggs_carton = Math.max(0, remaining.eggs_carton - std); break;
      }
    }
    return remaining;
  }

  const remaining = computeRemaining();

  async function handleMealCountChange(newCount: number) {
    if (!client) return;
    setMealCount(newCount);
    const base = get12MealTotals(
      client.gender === 'female' ? 'female' : 'male',
      client.current_phase
    );
    const scaled = scaleTotals(base, newCount);
    setAdjustedTotals(scaled);
    await fetch('/api/grocery/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-client-id': client.id },
      body: JSON.stringify({ adjustedTotals: scaled }),
    });
  }

  async function handleRegenerateList() {
    if (!client) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/grocery/generate', {
        method: 'POST',
        headers: { 'x-client-id': client.id },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Regenerate error:', err);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleAddItem() {
    if (!client || !selectedFood || addAmount <= 0) return;
    const res = await fetch('/api/grocery/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-id': client.id },
      body: JSON.stringify({ item_name: selectedFood, category: activeTab, shop_amount: addAmount, unit: addUnit }),
    });
    if (res.ok) {
      const newItem = await res.json();
      setItems(prev => [...prev, newItem]);
    }
    setAddModalOpen(false);
    setSelectedFood('');
    setAddAmount(0);
  }

  async function handleToggleItem(item: GroceryItem) {
    const updated = { ...item, checked: !item.checked };
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    await fetch(`/api/grocery/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-client-id': client!.id },
      body: JSON.stringify({ checked: updated.checked }),
    });
  }

  async function handleDeleteItem(item: GroceryItem) {
    setItems(prev => prev.filter(i => i.id !== item.id));
    await fetch(`/api/grocery/items/${item.id}`, {
      method: 'DELETE',
      headers: { 'x-client-id': client!.id },
    });
  }

  async function handleClearAll() {
    if (!client) return;
    if (!confirm('Clear all items from your list?')) return;
    const ids = items.map(i => i.id);
    await Promise.all(ids.map(id =>
      fetch(`/api/grocery/items/${id}`, { method: 'DELETE', headers: { 'x-client-id': client.id } })
    ));
    setItems([]);
  }

  const saveNotesDebounced = useCallback(
    debounce(async (clientId: string, n: string) => {
      await fetch('/api/grocery/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-client-id': clientId },
        body: JSON.stringify({ notes: n }),
      });
    }, 2000),
    []
  );

  async function handleTotalChange(field: keyof AdjustedTotals, value: number) {
    const updated = { ...adjustedTotals, [field]: value };
    setAdjustedTotals(updated);
    await fetch('/api/grocery/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-client-id': client!.id },
      body: JSON.stringify({ adjustedTotals: updated }),
    });
  }

  function openAddModal(food: string) {
    setSelectedFood(food);
    setAddAmount(0);
    setAddUnit(activeTab === 'eggs' ? 'carton' : 'lb');
    setAddModalOpen(true);
  }

  const allergies = client?.allergies || [];
  const customBans = client?.custom_allergy_bans || [];
  const foodLists: Record<TabKey, string[]> = {
    protein: filterFoodsForAllergies(LEAN_PROTEINS, allergies, customBans),
    veggies: filterFoodsForAllergies(FIBROUS_VEGETABLES, allergies, customBans),
    starch: client && isStarchAllowedForPhase(client.current_phase)
      ? filterFoodsForAllergies(STARCHY_CARBOHYDRATES, allergies, customBans)
      : [],
    fats: filterFoodsForAllergies(HEALTHY_FATS, allergies, customBans),
    eggs: ['Eggs (12)', 'Eggs (18)', 'Eggs (24)'],
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-charcoal flex items-center justify-center">
        <p className="text-brand-cream/60">Loading...</p>
      </div>
    );
  }

  const starchAllowed = client ? isStarchAllowedForPhase(client.current_phase) : false;

  return (
    <>
      <PullToRefresh onRefresh={() => client ? fetchGroceryList(client.id) : Promise.resolve()}>
        <div className="min-h-screen pb-[120px] bg-brand-charcoal">
          {/* Header */}
          <header className="bg-brand-charcoal border-b border-brand-cream/10 px-4 py-3 flex items-center gap-3">
            <Link href="/client/dashboard" className="text-brand-cream/60 hover:text-brand-cream text-sm">←</Link>
            <h1 className="text-lg font-bold text-brand-cream">Grocery List</h1>
          </header>

          <AddToHomeScreenBanner />

          {/* TOP: Editable Totals with Countdown */}
          <div className="mx-4 mt-4 p-4 rounded-xl bg-blue-50 border-2 border-blue-200 overflow-hidden">
            {/* Header row with meal count */}
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-blue-900">
                📊 Shopping Totals
              </h3>
              {/* Meal count editor */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-700">Meals:</span>
                {mealCountEditing ? (
                  <input
                    type="number"
                    value={mealCountVal}
                    onChange={e => setMealCountVal(parseInt(e.target.value) || 12)}
                    onBlur={() => {
                      setMealCountEditing(false);
                      if (mealCountVal > 0 && mealCountVal !== mealCount) {
                        handleMealCountChange(mealCountVal);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setMealCountEditing(false);
                        if (mealCountVal > 0 && mealCountVal !== mealCount) {
                          handleMealCountChange(mealCountVal);
                        }
                      }
                      if (e.key === 'Escape') {
                        setMealCountVal(mealCount);
                        setMealCountEditing(false);
                      }
                    }}
                    className="w-16 px-2 py-1 rounded-lg text-base font-bold text-center border-2 border-blue-400 bg-white focus:border-blue-600 focus:outline-none shadow-sm text-gray-900"
                    autoFocus min="1" max="60"
                  />
                ) : (
                  <button
                    onClick={() => { setMealCountVal(mealCount); setMealCountEditing(true); }}
                    className="px-3 py-1 rounded-lg text-base font-bold bg-white border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-colors text-blue-800 shadow-sm"
                  >
                    {mealCount}
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-blue-600 mb-4">
              Tap a number to adjust. Counts down as you add items.
            </p>

            <TotalRow
              emoji="🍗" label="Protein" unit="lb"
              total={adjustedTotals.protein_lb} remaining={remaining.protein_lb}
              onChange={v => handleTotalChange('protein_lb', v)}
            />
            <TotalRow
              emoji="🥬" label="Veggies" unit="cups"
              total={adjustedTotals.veggies_cups} remaining={remaining.veggies_cups}
              onChange={v => handleTotalChange('veggies_cups', v)}
            />
            {starchAllowed && adjustedTotals.starch_cups > 0 && (
              <TotalRow
                emoji="🍠" label="Starch" unit="cups"
                total={adjustedTotals.starch_cups} remaining={remaining.starch_cups}
                onChange={v => handleTotalChange('starch_cups', v)}
              />
            )}
            {(!starchAllowed || adjustedTotals.starch_cups === 0) && (
              <div className="flex items-center gap-2 mb-3 opacity-60">
                <span className="text-base">🍠</span>
                <span className="text-sm font-semibold text-gray-600 flex-1">Starch</span>
                <span className="text-xs text-gray-500 font-medium italic">
                  {!starchAllowed ? 'Not available in your phase' : '0 cups'}
                </span>
              </div>
            )}
            <TotalRow
              emoji="🥑" label="Fats" unit="oz"
              total={adjustedTotals.fats_oz} remaining={remaining.fats_oz}
              onChange={v => handleTotalChange('fats_oz', v)}
            />
            <EggsRow
              cartons={adjustedTotals.eggs_carton} remaining={remaining.eggs_carton}
              onChange={v => handleTotalChange('eggs_carton', v)}
            />

            {/* Regenerate button */}
            <div className="mt-4 pt-3 border-t border-blue-200">
              <button
                onClick={handleRegenerateList}
                disabled={regenerating}
                className="w-full py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                {regenerating ? 'Regenerating...' : '🔄 Regenerate Suggested Items'}
              </button>
            </div>
          </div>

          {/* MIDDLE: Add Foods */}
          <div className="mx-4 mt-4">
            <h3 className="text-base font-bold text-brand-cream mb-2">Add Foods</h3>
            {/* Tab bar */}
            <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
              {(Object.keys(CATEGORY_LABELS) as TabKey[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'bg-brand-orange text-white'
                      : 'bg-brand-charcoal/80 text-brand-cream/60 border border-brand-cream/10'
                  }`}
                >
                  {CATEGORY_LABELS[tab].emoji} {CATEGORY_LABELS[tab].label}
                </button>
              ))}
            </div>
            {/* Food list */}
            <div className="mt-2 space-y-1">
              {foodLists[activeTab].length === 0 ? (
                <p className="text-sm text-brand-cream/40 italic py-4 text-center">
                  {activeTab === 'starch' && !starchAllowed
                    ? 'Starch is not available in your phase.'
                    : 'No foods available.'}
                </p>
              ) : (
                foodLists[activeTab].map(food => (
                  <button
                    key={food}
                    onClick={() => openAddModal(food)}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-brand-charcoal/80 border border-brand-cream/10 hover:border-brand-orange/50 text-brand-cream text-sm transition-colors"
                  >
                    + {food}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* BOTTOM: Shopping List — VISIBLE PROMINENT SECTION */}
          <div className="mx-4 mt-6 mb-4">
            {/* Prominent section header */}
            <div className="rounded-xl bg-brand-orange/10 border-2 border-brand-orange/30 p-4 mb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-brand-cream">
                  🛒 Your Shopping List
                  {items.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-brand-orange">
                      ({items.filter(i => i.checked).length}/{items.length} checked)
                    </span>
                  )}
                </h3>
                {items.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-red-400/80 hover:text-red-400 font-medium px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 p-6 text-center">
                <p className="text-base text-brand-cream/50 mb-2">No items on your list yet.</p>
                <p className="text-sm text-brand-cream/30">Tap foods above to add them to your list.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(Object.keys(CATEGORY_LABELS) as TabKey[]).map(cat => {
                  const catItems = items.filter(i => i.category === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} className="rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 p-3">
                      <div className="text-xs text-brand-cream/40 uppercase font-semibold mb-2 tracking-wide">
                        {CATEGORY_LABELS[cat].emoji} {CATEGORY_LABELS[cat].label}
                      </div>
                      {catItems.map(item => (
                        <div key={item.id} className="flex items-center gap-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleItem(item)}
                            className="accent-brand-orange w-5 h-5 flex-shrink-0 rounded"
                          />
                          <span className={`flex-1 text-base ${
                            item.checked ? 'line-through text-brand-cream/40' : 'text-brand-cream'
                          }`}>
                            {item.item_name}
                            {item.shop_amount ? ` — ${item.shop_amount} ${item.unit}` : ''}
                          </span>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="text-red-400/60 hover:text-red-400 text-sm px-2 py-0.5 rounded hover:bg-red-400/10 transition-colors flex-shrink-0"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {/* Notes */}
                <div className="mt-3">
                  <label className="text-sm text-brand-cream/60 uppercase font-semibold tracking-wide">Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => {
                      setNotes(e.target.value);
                      if (client) saveNotesDebounced(client.id, e.target.value);
                    }}
                    placeholder="Add any notes for your shopping trip..."
                    rows={3}
                    className="w-full mt-2 px-4 py-3 rounded-xl bg-brand-charcoal/80 border-2 border-brand-cream/20 text-brand-cream text-base placeholder:text-brand-cream/40 resize-none focus:border-brand-orange/60 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}
          </div>
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


      {/* Add Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-charcoal rounded-2xl p-6 w-full max-w-sm border border-brand-cream/20">
            <h3 className="text-lg font-bold text-brand-cream mb-4">Add: {selectedFood}</h3>
            <div className="mb-4">
              <label className="text-sm text-brand-cream/60 block mb-1">Amount</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={addAmount || ''}
                  onChange={e => setAddAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 rounded-lg bg-brand-cream/10 border border-brand-cream/20 text-brand-cream text-base focus:border-brand-orange/60 focus:outline-none"
                  min="0" step="0.5" placeholder="0"
                  autoFocus
                />
                <select
                  value={addUnit}
                  onChange={e => setAddUnit(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-brand-cream/10 border border-brand-cream/20 text-brand-cream text-sm"
                >
                  {activeTab === 'eggs' ? (
                    <option value="carton">carton</option>
                  ) : (
                    <>
                      <option value="lb">lb</option>
                      <option value="oz">oz</option>
                      <option value="cups">cups</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setAddModalOpen(false)}
                className="flex-1 py-2 rounded-lg border border-brand-cream/20 text-brand-cream/60"
              >Cancel</button>
              <button
                onClick={handleAddItem}
                disabled={addAmount <= 0}
                className="flex-1 py-2 rounded-lg bg-brand-orange text-white font-semibold disabled:opacity-50"
              >Add</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
