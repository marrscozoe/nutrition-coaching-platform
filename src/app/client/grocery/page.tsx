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
    <div className="flex items-center gap-2 mb-2">
      <span>{emoji}</span>
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      {editing ? (
        <input
          type="number"
          value={val}
          onChange={e => setVal(parseFloat(e.target.value) || 0)}
          onBlur={() => { onChange(val); setEditing(false); }}
          className="w-16 px-2 py-1 rounded text-right text-sm border border-blue-300"
          autoFocus min="0" step="0.5"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-16 text-right text-sm font-mono bg-blue-100 rounded px-1 hover:bg-blue-200"
        >
          {total} {unit}
        </button>
      )}
      <span className="text-xs text-gray-500 w-28 text-right">→ {remaining.toFixed(1)} {unit} left</span>
      <div className="w-20 h-2 bg-blue-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
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
    <div className="flex items-center gap-2 mb-2">
      <span>🥚</span>
      <span className="text-sm text-gray-700 flex-1">Eggs</span>
      <div className="flex gap-1">
        {cartonSizes.map(size => (
          <span key={size} className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">{size}</span>
        ))}
      </div>
      {editing ? (
        <input
          type="number"
          value={val}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          onBlur={() => setEditing(false)}
          className="w-16 px-2 py-1 rounded text-right text-sm border border-purple-300"
          min="1"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-20 text-right text-sm font-mono bg-purple-100 rounded px-1 hover:bg-purple-200"
        >
          {cartons} carton{cartons !== 1 ? 's' : ''}
        </button>
      )}
      <span className="text-xs text-gray-500 w-20 text-right">→ {remaining.toFixed(1)} left</span>
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
  const foodLists: Record<TabKey, string[]> = {
    protein: filterFoodsForAllergies(LEAN_PROTEINS, allergies),
    veggies: filterFoodsForAllergies(FIBROUS_VEGETABLES, allergies),
    starch: client && isStarchAllowedForPhase(client.current_phase)
      ? filterFoodsForAllergies(STARCHY_CARBOHYDRATES, allergies)
      : [],
    fats: filterFoodsForAllergies(HEALTHY_FATS, allergies),
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
        <div className="min-h-screen pb-[96px] bg-brand-charcoal">
          {/* Header */}
          <header className="bg-brand-charcoal border-b border-brand-cream/10 px-4 py-3 flex items-center gap-3">
            <Link href="/client/dashboard" className="text-brand-cream/60 hover:text-brand-cream text-sm">←</Link>
            <h1 className="text-lg font-bold text-brand-cream">Grocery List</h1>
          </header>

          <AddToHomeScreenBanner />

          {/* TOP: Editable Totals with Countdown */}
          <div className="mx-4 mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <h3 className="text-base font-bold text-blue-800 mb-1">
              📊 Shopping Totals (~12 meals)
            </h3>
            <p className="text-xs text-blue-600 mb-3">
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
              <div className="flex items-center gap-2 mb-2 opacity-50">
                <span>🍠</span>
                <span className="text-sm text-gray-500 flex-1">Starch</span>
                <span className="text-xs text-gray-400 italic">
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
          </div>

          {/* MIDDLE: Add Foods */}
          <div className="mx-4 mt-4">
            <h3 className="text-base font-bold text-brand-cream mb-2">Add Foods</h3>
            {/* Tab bar */}
            <div className="flex gap-1 overflow-x-auto pb-2">
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
                    className="w-full text-left px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/10 hover:border-brand-orange/50 text-brand-cream text-sm transition-colors"
                  >
                    + {food}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* BOTTOM: Checklist */}
          <div className="mx-4 mt-6 mb-4">
            <h3 className="text-base font-bold text-brand-cream mb-2">
              ✅ Your List {items.length > 0 && (
                <span className="text-brand-orange font-normal text-sm ml-1">
                  ({items.filter(i => i.checked).length}/{items.length})
                </span>
              )}
            </h3>
            {items.length === 0 ? (
              <p className="text-sm text-brand-cream/40 italic">Tap foods above to add them to your list.</p>
            ) : (
              <div className="space-y-3">
                {(Object.keys(CATEGORY_LABELS) as TabKey[]).map(cat => {
                  const catItems = items.filter(i => i.category === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} className="rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 p-3">
                      <div className="text-xs text-brand-cream/40 uppercase mb-2">
                        {CATEGORY_LABELS[cat].emoji} {CATEGORY_LABELS[cat].label}
                      </div>
                      {catItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleItem(item)}
                            className="accent-brand-orange w-4 h-4"
                          />
                          <span className={`flex-1 text-sm ${
                            item.checked ? 'line-through text-brand-cream/40' : 'text-brand-cream'
                          }`}>
                            {item.item_name}
                            {item.shop_amount ? ` — ${item.shop_amount} ${item.unit}` : ''}
                          </span>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="text-red-400/60 hover:text-red-400 text-xs px-1"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {/* Notes */}
                <div className="mt-3">
                  <label className="text-xs text-brand-cream/40 uppercase">Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => {
                      setNotes(e.target.value);
                      if (client) saveNotesDebounced(client.id, e.target.value);
                    }}
                    placeholder="Any notes for your shopping trip..."
                    rows={2}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/10 text-brand-cream text-sm placeholder:text-brand-cream/30 resize-none"
                  />
                </div>
                <button
                  onClick={handleClearAll}
                  className="w-full py-2 text-sm text-red-400/60 border border-red-400/20 rounded-lg hover:bg-red-400/5"
                >
                  Clear All
                </button>
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
                  className="flex-1 px-3 py-2 rounded-lg bg-brand-cream/10 border border-brand-cream/20 text-brand-cream"
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
