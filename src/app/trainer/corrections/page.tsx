'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Correction {
  id: string;
  food_name: string;
  correct_category: string;
  submitted_by: string;
  submitted_by_name?: string;
  submitted_at: string;
  approved: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  protein: { label: 'Protein', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  vegetable: { label: 'Vegetable', color: 'text-green-400', bg: 'bg-green-500/20' },
  fat: { label: 'Fat', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  starch: { label: 'Starch (Phase 1 violation)', color: 'text-red-400', bg: 'bg-red-500/20' },
  dairy: { label: 'Dairy (Phase 1 violation)', color: 'text-red-400', bg: 'bg-red-500/20' },
  sugar: { label: 'Sugar (Phase 1 violation)', color: 'text-red-400', bg: 'bg-red-500/20' },
  other: { label: 'Other', color: 'text-gray-400', bg: 'bg-gray-500/20' },
};

export default function TrainerCorrectionsPage() {
  const router = useRouter();
  const [trainer, setTrainer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loadingCorrections, setLoadingCorrections] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'approved' | 'all'>('pending');

  useEffect(() => {
    const userData = sessionStorage.getItem('trainer_user');
    const userType = sessionStorage.getItem('trainer_user_type');

    if (!userData || userType !== 'trainer') {
      router.push('/?login=trainer');
      return;
    }

    const user = JSON.parse(userData);
    setTrainer(user);
    fetchCorrections(user.id);
  }, [router]);

  async function fetchCorrections(trainerId: string) {
    setLoadingCorrections(true);
    try {
      const res = await fetch('/api/corrections', {
        headers: { 'x-trainer-id': trainerId },
      });
      const data = await res.json();
      setCorrections(data.corrections || []);
    } catch (err) {
      console.error('Failed to fetch corrections:', err);
    } finally {
      setLoadingCorrections(false);
      setLoading(false);
    }
  }

  async function handleApprove(correctionId: string) {
    if (!trainer) return;
    setProcessing(correctionId);
    try {
      const res = await fetch('/api/corrections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-trainer-id': trainer.id,
        },
        body: JSON.stringify({ id: correctionId, approved: true }),
      });
      const data = await res.json();
      if (data.success || data.correction) {
        // Update local state
        setCorrections(prev =>
          prev.map(c =>
            c.id === correctionId
              ? { ...c, approved: true, reviewed_at: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to approve correction:', err);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(correctionId: string) {
    if (!trainer) return;
    if (!confirm('Reject this correction? It will be deleted.')) return;
    setProcessing(correctionId);
    try {
      const res = await fetch('/api/corrections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-trainer-id': trainer.id,
        },
        body: JSON.stringify({ id: correctionId, approved: false }),
      });
      const data = await res.json();
      if (data.success) {
        // Remove from local state
        setCorrections(prev => prev.filter(c => c.id !== correctionId));
      }
    } catch (err) {
      console.error('Failed to reject correction:', err);
    } finally {
      setProcessing(null);
    }
  }

  const pendingCorrections = corrections.filter(c => !c.approved);
  const approvedCorrections = corrections.filter(c => c.approved);
  const displayedCorrections = tab === 'pending' ? pendingCorrections
    : tab === 'approved' ? approvedCorrections
    : corrections;

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

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
        <h1 className="text-lg font-semibold text-brand-cream">AI Corrections</h1>
        <div className="w-12" />
      </header>

      {/* Prominent Pending Count Banner */}
      {pendingCorrections.length > 0 && (
        <div className="mx-4 mb-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-red-400 font-semibold text-sm">
                {pendingCorrections.length} correction{pendingCorrections.length !== 1 ? 's' : ''} waiting for review
              </p>
              <p className="text-red-400/60 text-xs">
                AI improvements are paused until you approve them
              </p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-red-400 font-bold text-lg">{pendingCorrections.length}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-4 mt-2">
        <button
          onClick={() => setTab('pending')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'pending'
              ? 'bg-brand-orange text-white'
              : 'bg-brand-charcoal/80 text-brand-cream/60'
          }`}
        >
          Pending ({pendingCorrections.length})
        </button>
        <button
          onClick={() => setTab('approved')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'approved'
              ? 'bg-brand-orange text-white'
              : 'bg-brand-charcoal/80 text-brand-cream/60'
          }`}
        >
          Approved ({approvedCorrections.length})
        </button>
        <button
          onClick={() => setTab('all')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'all'
              ? 'bg-brand-orange text-white'
              : 'bg-brand-charcoal/80 text-brand-cream/60'
          }`}
        >
          All ({corrections.length})
        </button>
      </div>

      {/* Info Banner */}
      {tab === 'pending' && pendingCorrections.length > 0 && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/10">
          <p className="text-sm text-brand-cream/70">
            👆 Approve corrections the AI should learn from. Reject ones that are incorrect.
            Approved corrections take effect immediately.
          </p>
        </div>
      )}

      {/* Corrections List */}
      {loadingCorrections ? (
        <div className="px-4 py-8 text-center">
          <div className="text-brand-orange">Loading corrections...</div>
        </div>
      ) : displayedCorrections.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-4xl mb-4">✅</p>
          <p className="text-brand-cream/50">
            {tab === 'pending'
              ? 'No pending corrections — all caught up!'
              : tab === 'approved'
              ? 'No approved corrections yet.'
              : 'No corrections submitted yet.'}
          </p>
          {tab === 'pending' && (
            <p className="text-brand-cream/30 text-sm mt-2">
              When clients report AI mistakes, they'll appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {displayedCorrections.map((correction) => {
            const category = CATEGORY_LABELS[correction.correct_category] || CATEGORY_LABELS.other;
            return (
              <div
                key={correction.id}
                className={`p-4 rounded-xl border ${
                  correction.approved
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-brand-charcoal/80 border-brand-cream/10'
                }`}
              >
                {/* Food Name */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-brand-cream font-semibold text-lg">{correction.food_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${category.bg} ${category.color}`}>
                        → {category.label}
                      </span>
                    </div>
                    <p className="text-xs text-brand-cream/40 mt-2">
                      Submitted: {formatDate(correction.submitted_at)}
                    </p>
                    {correction.reviewed_at && (
                      <p className="text-xs text-green-400/60 mt-1">
                        {correction.approved ? '✓ Approved' : '✗ Rejected'}: {formatDate(correction.reviewed_at)}
                      </p>
                    )}
                  </div>

                  {/* Actions - only for pending */}
                  {!correction.approved && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(correction.id)}
                        disabled={processing === correction.id}
                        className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        {processing === correction.id ? '...' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(correction.id)}
                        disabled={processing === correction.id}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Approved badge */}
                  {correction.approved && (
                    <span className="flex-shrink-0 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                      ✓ Active
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* How it works */}
      <div className="mx-4 mt-6 p-4 rounded-xl bg-brand-charcoal/60 border border-brand-cream/10">
        <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-3">How Corrections Work</h3>
        <div className="space-y-2 text-sm text-brand-cream/60">
          <div className="flex gap-2">
            <span className="text-brand-orange font-bold">1.</span>
            <p>Client taps "Report AI Mistake" after meal analysis</p>
          </div>
          <div className="flex gap-2">
            <span className="text-brand-orange font-bold">2.</span>
            <p>Correction appears here as "Pending"</p>
          </div>
          <div className="flex gap-2">
            <span className="text-brand-orange font-bold">3.</span>
            <p>You review and Approve or Reject</p>
          </div>
          <div className="flex gap-2">
            <span className="text-brand-orange font-bold">4.</span>
            <p>Approved corrections are added to the AI's corrections cache and used immediately for future meal analysis</p>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom">
        <div className="flex justify-around py-3">
          <Link href="/trainer" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">📊</span>
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link href="/trainer/clients" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">👥</span>
            <span className="text-xs mt-1">Clients</span>
          </Link>
          <Link href="/trainer/corrections" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">🤖</span>
            <span className="text-xs mt-1">Corrections</span>
            {pendingCorrections.length > 0 && (
              <span className="absolute top-0 right-1/2 translate-x-4 -translate-y-0.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                {pendingCorrections.length}
              </span>
            )}
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
