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
  clientId: string;
  onClose: () => void;
  onSave: (newAllergies: string[]) => void;
}

export default function AllergyEditModal({
  currentAllergies,
  clientId,
  onClose,
  onSave,
}: AllergyEditModalProps) {
  const [selected, setSelected] = useState<string[]>(currentAllergies);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleAllergy = (key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]
    );
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
        body: JSON.stringify({ allergies: selected }),
      });
      if (res.ok) {
        const data = await res.json();
        onSave(data.allergies || selected);
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
      <div className="w-full max-w-md bg-brand-charcoal rounded-2xl border border-brand-cream/20 p-6 max-h-[80vh] overflow-y-auto">
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
        {selected.length > 0 && (
          <div className="mt-4 pt-4 border-t border-brand-cream/10">
            <p className="text-xs text-brand-cream/50">Selected:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {selected.map(a => {
                const opt = ALLERGY_OPTIONS.find(o => o.key === a);
                return (
                  <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs">
                    {opt?.label || a}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
