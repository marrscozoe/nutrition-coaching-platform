'use client';

import { useState } from 'react';

const ALLERGY_OPTIONS = [
  { key: 'dairy', label: 'Dairy', description: 'whey, yogurt, cheese, cream, etc.' },
  { key: 'gluten', label: 'Gluten/Wheat', description: 'bread, pasta, crackers, etc.' },
  { key: 'eggs', label: 'Eggs', description: 'eggs, mayo, aioli, etc.' },
  { key: 'soy', label: 'Soy', description: 'tofu, tempeh, soy sauce, etc.' },
  { key: 'shellfish', label: 'Shellfish', description: 'shrimp, crab, lobster, etc.' },
  { key: 'nuts', label: 'Tree Nuts', description: 'almonds, walnuts, cashews, etc.' },
  { key: 'peanuts', label: 'Peanuts', description: 'peanuts, peanut butter' },
  { key: 'fish', label: 'Fish', description: 'salmon, tuna, cod, etc.' },
  { key: 'nightshades', label: 'Nightshades', description: 'tomatoes, peppers, eggplant, potatoes' },
  { key: 'histamine', label: 'Histamine', description: 'spinach, kale, aged cheese, etc.' },
];

interface AllergyEditModalProps {
  currentAllergies: string[];
  customBans: string[];
  clientId: string;
  onClose: () => void;
  onSave: (newAllergies: string[], newCustomBans: string[]) => void;
}

export default function AllergyEditModal({
  currentAllergies,
  customBans = [],
  clientId,
  onClose,
  onSave,
}: AllergyEditModalProps) {
  const [selected, setSelected] = useState<string[]>(currentAllergies);
  const [bans, setBans] = useState<string[]>(customBans);
  const [newBanInput, setNewBanInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleAllergy = (key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]
    );
  };

  const addCustomBan = () => {
    const trimmed = newBanInput.trim();
    if (!trimmed) return;
    if (bans.map(b => b.toLowerCase()).includes(trimmed.toLowerCase())) {
      setNewBanInput('');
      return; // already added
    }
    setBans(prev => [...prev, trimmed]);
    setNewBanInput('');
  };

  const removeCustomBan = (ban: string) => {
    setBans(prev => prev.filter(b => b !== ban));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/client/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
        },
        body: JSON.stringify({
          allergies: selected,
          custom_allergy_bans: bans,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSave(data.allergies || selected, data.custom_allergy_bans || bans);
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to save' }));
        setError(err.error || 'Failed to save allergies');
        setSaving(false);
      }
    } catch (err) {
      setError('Network error — please try again');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-brand-charcoal rounded-2xl border border-brand-cream/20 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-brand-cream">🍽️ Food Allergies</h3>
          <button onClick={onClose} className="text-brand-cream/50 hover:text-brand-cream text-2xl leading-none">
            ×
          </button>
        </div>
        <p className="text-sm text-brand-cream/60 mb-4">
          Select foods you&apos;re allergic to. These will be <strong className="text-red-400">hard-banned</strong> — never suggested in meals.
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Preset allergy toggles */}
        <div className="space-y-2 mb-6">
          {ALLERGY_OPTIONS.map(opt => (
            <label
              key={opt.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected.includes(opt.key)
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-brand-cream/20 bg-brand-charcoal/60 hover:border-brand-cream/40'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.key)}
                onChange={() => toggleAllergy(opt.key)}
                className="mt-1 accent-brand-orange"
              />
              <div>
                <span className={`font-medium ${selected.includes(opt.key) ? 'text-red-400' : 'text-brand-cream'}`}>
                  {opt.label}
                </span>
                <p className="text-xs text-brand-cream/50">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Custom bans section */}
        <div className="border-t border-brand-cream/10 pt-4 mb-6">
          <h4 className="text-sm font-semibold text-brand-cream/80 mb-2">🚫 Custom Bans</h4>
          <p className="text-xs text-brand-cream/50 mb-3">
            Type any food category to hard-ban it. E.g., &quot;meat&quot;, &quot;pork&quot;, &quot;fried food&quot;, &quot;corn&quot;.
          </p>

          {/* Add custom ban input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newBanInput}
              onChange={(e) => setNewBanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomBan();
                }
              }}
              placeholder="e.g. meat, pork, fried food..."
              className="flex-1 px-3 py-2 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
            />
            <button
              type="button"
              onClick={addCustomBan}
              className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-dark transition-colors whitespace-nowrap"
            >
              Add
            </button>
          </div>

          {/* Custom ban chips */}
          {bans.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bans.map(ban => (
                <span
                  key={ban}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                >
                  {ban}
                  <button
                    type="button"
                    onClick={() => removeCustomBan(ban)}
                    className="ml-1 text-red-400 hover:text-red-300 font-bold leading-none"
                    aria-label={`Remove ${ban}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {bans.length === 0 && (
            <p className="text-xs text-brand-cream/40 italic">No custom bans added yet.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Allergies'}
          </button>
        </div>

        {/* Summary of selected */}
        {(selected.length > 0 || bans.length > 0) && (
          <div className="mt-4 pt-4 border-t border-brand-cream/10">
            <p className="text-xs text-brand-cream/50 mb-2">Selected:</p>
            <div className="flex flex-wrap gap-1">
              {selected.map(a => {
                const opt = ALLERGY_OPTIONS.find(o => o.key === a);
                return (
                  <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs">
                    {opt?.label || a}
                  </span>
                );
              })}
              {bans.map(ban => (
                <span key={ban} className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs">
                  {ban}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
