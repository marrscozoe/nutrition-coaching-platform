'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Toast from '@/components/Toast';
import { logout } from '@/lib/auth';

interface ClientData {
  id: string;
  name: string;
  email: string;
  gender: string;
  program_type: string;
  current_phase: number;
  starting_weight: number;
  current_weight: number;
  goal_weight: number;
  goal_start_date?: string;
  event_date?: string;
  notes?: string;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugMessage, setBugMessage] = useState('');
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [editGoalWeight, setEditGoalWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showEditWeight, setShowEditWeight] = useState(false);
  const [editStartingWeight, setEditStartingWeight] = useState('');
  const [showEditProgram, setShowEditProgram] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState('general_health');
  const [showEventDateModal, setShowEventDateModal] = useState(false);
  const [editEventDate, setEditEventDate] = useState('');
  const [showProgramInfo, setShowProgramInfo] = useState<string | null>(null);

  async function fetchClientData(clientId: string) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-client-id': clientId },
      });
      if (res.ok) {
        const data = await res.json();
        setClient(data.user);
        sessionStorage.setItem('client_user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Failed to fetch client data:', err);
    }
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

    // Fetch fresh data from server to ensure phase and weights are current
    fetchClientData(user.id);
    setLoading(false);
  }, [router]);

  async function handleLogout() {
    await logout();
  }

  const PROGRAMS = [
    { value: 'get_shredded', label: 'Get Shredded' },
    { value: 'muscle_gain', label: 'Gain Muscle' },
    { value: 'event_ready', label: 'Event Ready' },
    { value: 'general_health', label: 'General Health' },
  ];

  const PROGRAM_DESCRIPTIONS: Record<string, string> = {
    get_shredded: 'Intense program for serious fat loss. Structured nutrition reset for those ready to commit. Go from burning fat to peak definition.',
    muscle_gain: 'Structured nutrition for building lean muscle. Increase portions strategically to fuel muscle growth while minimizing fat gain.',
    event_ready: 'Perfect for weddings, reunions, beach trips, or any special event. Short-term fat loss to look your best on your big day.',
    general_health: 'Maintenance-focused program for overall wellness. Learn to balance meals while keeping your weight stable. Great for long-term healthy habits.',
  };

  function getProgramLabel(type: string): string {
    switch (type) {
      case 'event_ready': return 'Event Ready';
      case 'muscle_gain': return 'Gain Muscle';
      case 'general_health': return 'General Health';
      case 'get_shredded': return 'Get Shredded';
      default: return type;
    }
  }

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  // Refresh handler for pull-to-refresh or manual refresh
  async function handleRefresh() {
    if (client) {
      await fetchClientData(client.id);
    }
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
        <h1 className="text-lg font-semibold text-brand-cream">Profile</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 space-y-4">
        {/* Profile Header */}
        <div className="p-6 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
          <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-brand-orange flex items-center justify-center">
            <span className="text-3xl">👤</span>
          </div>
          <h2 className="text-xl font-bold text-brand-cream">{client.name}</h2>
          <p className="text-brand-cream/60 text-sm">{client.email}</p>
        </div>

        {/* Progress Summary */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-3">Your Progress</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-brand-charcoal/60">
              <p className="text-2xl font-bold text-brand-orange">{client.current_phase}</p>
              <p className="text-xs text-brand-cream/50">Phase</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-brand-charcoal/60">
              <p className="text-2xl font-bold text-green-400">{weightLost > 0 ? `-${weightLost}` : '0'}</p>
              <p className="text-xs text-brand-cream/50">lbs Lost/Gain</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-3">Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-brand-cream/60">Gender</span>
              <span className="text-brand-cream capitalize">{client.gender || 'Not set'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-brand-cream/60">Program</span>
              <button
                onClick={() => {
                  // Read fresh client data directly from sessionStorage to ensure we have the latest
                  const storedUser = sessionStorage.getItem('client_user');
                  const freshClient = storedUser ? JSON.parse(storedUser) : null;
                  setSelectedProgram(client.program_type || 'general_health');
                  setEditEventDate(freshClient?.event_date || client.event_date || '');
                  setShowEditProgram(true);
                }}
                className="text-brand-orange text-sm hover:underline"
              >
                {getProgramLabel(client.program_type || '')} ✏️
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-brand-cream/60">Starting Weight</span>
              <button
                onClick={() => {
                  setEditStartingWeight(client.starting_weight?.toString() || '');
                  setShowEditWeight(true);
                }}
                className="text-brand-orange text-sm hover:underline"
              >
                {client.starting_weight || '--'} lbs ✏️
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-cream/60">Current Weight</span>
              <span className="text-brand-cream">{client.current_weight || '--'} lbs</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-brand-cream/60">Goal Weight</span>
              <button
                onClick={() => {
                  setEditGoalWeight(client.goal_weight?.toString() || '');
                  setShowGoalEdit(true);
                }}
                className="text-brand-orange hover:text-brand-orange-dark text-sm"
              >
                {client.goal_weight || '--'} lbs ✏️
              </button>
            </div>
            {client.event_date && client.program_type === 'event_ready' && (
              <div className="flex justify-between items-center">
                <span className="text-brand-cream/60">Event Date</span>
                <button
                  onClick={() => {
                    setSelectedProgram('event_ready');
                    setEditEventDate(client.event_date ? client.event_date.split('T')[0] : '');
                    setShowEditProgram(true);
                  }}
                  className="text-brand-orange text-sm hover:underline"
                >
                  {new Date(client.event_date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} ✏️
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Report Problem */}
        <button
          type="button"
          onClick={() => setShowBugReport(true)}
          className="w-full p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-left hover:bg-brand-charcoal/60 transition-colors"
        >
          <span className="text-brand-cream/80">🐛 Report a Problem</span>
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Log Out
        </button>

        {/* App Version */}
        <p className="text-center text-xs text-brand-cream/30 mt-4">
          AMarsBody Nutrition v0.1.0 (Beta)
        </p>
      </div>

      {/* Goal Edit Modal */}
      {showGoalEdit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-brand-charcoal/95 rounded-2xl border border-brand-cream/20 p-6">
            <h3 className="text-lg font-bold text-brand-cream mb-2">Edit Goal Weight</h3>
            <p className="text-sm text-brand-cream/60 mb-4">
              Changing your goal resets your week counter to 1.
            </p>
            <input
              type="number"
              value={editGoalWeight}
              onChange={(e) => setEditGoalWeight(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
              placeholder="Enter goal weight (lbs)"
              step="0.1"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowGoalEdit(false);
                  setEditGoalWeight('');
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream hover:bg-brand-charcoal/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editGoalWeight) return;
                  try {
                    const user = JSON.parse(sessionStorage.getItem('client_user') || '{}');
                    const res = await fetch('/api/client/update-goal', {
                      method: 'POST',
                      headers: { 'x-client-id': user.id, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ goal_weight: parseFloat(editGoalWeight) }),
                    });
                    if (res.ok) {
                      setShowGoalEdit(false);
                      setEditGoalWeight('');
                      // Refresh client data
                      const fresh = await fetch('/api/auth/me', { headers: { 'x-client-id': user.id } });
                      if (fresh.ok) {
                        const data = await fresh.json();
                        setClient(data.user);
                        sessionStorage.setItem('client_user', JSON.stringify(data.user));
                      }
                      setToast({ message: 'Goal updated! Week counter reset.', type: 'success' });
                    }
                  } catch {
                    setToast({ message: 'Failed to update goal', type: 'error' });
                  }
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-brand-orange text-white hover:bg-brand-orange-dark transition-colors"
              >
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bug Report Modal */}
      {showBugReport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-brand-charcoal/95 rounded-2xl border border-brand-cream/20 p-6">
            <h3 className="text-lg font-bold text-brand-cream mb-2">Report a Problem</h3>
            <p className="text-sm text-brand-cream/60 mb-4">
              Found a bug or have an issue? Let us know!
            </p>
            <textarea
              value={bugMessage}
              onChange={(e) => setBugMessage(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange resize-none"
              placeholder="Describe the problem..."
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setShowBugReport(false); setBugMessage(''); }}
                className="flex-1 py-3 rounded-lg bg-brand-charcoal/80 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!bugMessage.trim()) return;
                  setSubmitting(true);
                  try {
                    const res = await fetch('/api/feedback', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-client-id': client!.id,
                      },
                      body: JSON.stringify({ message: bugMessage }),
                    });
                    if (res.ok) {
                      setToast({ message: 'Thanks for your feedback!', type: 'success' });
                      setShowBugReport(false);
                      setBugMessage('');
                    }
                  } catch (err) {
                    setToast({ message: 'Failed to submit. Please try again.', type: 'error' });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !bugMessage.trim()}
                className="flex-1 py-3 rounded-lg bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Weight Modal */}
      {showEditWeight && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-brand-charcoal/95 rounded-2xl border border-brand-cream/20 p-6">
            <h3 className="text-lg font-bold text-brand-cream mb-2">Edit Starting Weight</h3>
            <p className="text-sm text-brand-cream/60 mb-4">
              Adjust your starting weight if needed. This is the weight you began your journey with.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-brand-cream/80 mb-2">Starting Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editStartingWeight}
                  onChange={(e) => setEditStartingWeight(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                  placeholder="Enter starting weight"
                />
              </div>
              <p className="text-xs text-brand-cream/50">
                Current weight is tracked separately when you log your weigh-ins.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowEditWeight(false)}
                className="flex-1 py-3 rounded-lg bg-brand-charcoal/80 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editStartingWeight) return;
                  setSubmitting(true);
                  try {
                    const res = await fetch('/api/client/update-weight', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-client-id': client!.id,
                      },
                      body: JSON.stringify({ 
                        starting_weight: parseFloat(editStartingWeight)
                      }),
                    });
                    if (res.ok) {
                      // Refresh client data from server
                      const fresh = await fetch('/api/auth/me', { headers: { 'x-client-id': client!.id } });
                      if (fresh.ok) {
                        const data = await fresh.json();
                        setClient(data.user);
                        sessionStorage.setItem('client_user', JSON.stringify(data.user));
                      }
                      setShowEditWeight(false);
                      setToast({ message: 'Starting weight updated!', type: 'success' });
                    } else {
                      setToast({ message: 'Failed to update weight. Please try again.', type: 'error' });
                    }
                  } catch (err) {
                    setToast({ message: 'Failed to update weight. Please try again.', type: 'error' });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !editStartingWeight}
                className="flex-1 py-3 rounded-lg bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Program Modal */}
      {showEditProgram && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-brand-charcoal/95 rounded-2xl border border-brand-cream/20 p-6">
            <h3 className="text-lg font-bold text-brand-cream mb-2">Change Program</h3>
            <p className="text-sm text-brand-cream/60 mb-4">
              Select the program that best fits your goals.
            </p>
            <div className="space-y-3">
              {PROGRAMS.map((program) => (
                <div key={program.value} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedProgram(program.value)}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      selectedProgram === program.value
                        ? 'border-brand-orange bg-brand-orange/10 text-brand-cream'
                        : 'border-brand-cream/20 bg-brand-charcoal/60 text-brand-cream/80 hover:border-brand-cream/40'
                    }`}
                  >
                    <span className="font-medium">{program.label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProgramInfo(showProgramInfo === program.value ? null : program.value);
                      }}
                      className="absolute right-10 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-brand-orange/20 text-brand-orange text-sm font-bold flex items-center justify-center hover:bg-brand-orange/30 active:bg-brand-orange/40 transition-colors cursor-pointer"
                      aria-label={`Info about ${program.label}`}
                    >
                      i
                    </button>
                    {selectedProgram === program.value && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-orange">✓</span>
                    )}
                  </button>
                  {showProgramInfo === program.value && (
                    <div className="mt-2 p-3 rounded-lg bg-brand-charcoal/90 border border-brand-orange/30 text-brand-cream/90 text-sm">
                      {PROGRAM_DESCRIPTIONS[program.value]}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedProgram === 'event_ready' && (
              <div className="mt-4">
                <label className="block text-sm text-brand-cream/80 mb-2">Event Date</label>
                <input
                  type="date"
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                  min={new Date().toISOString().split('T')[0]}
                />
                {!client.event_date && !editEventDate && (
                  <p className="text-xs text-brand-orange/70 mt-2">
                    Set your event date to get the right timeline.
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowEditProgram(false)}
                className="flex-1 py-3 rounded-lg bg-brand-charcoal/80 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  // Require event date when Event Ready is selected
                  if (selectedProgram === 'event_ready' && !editEventDate) {
                    setToast({ message: 'Please set an event date', type: 'error' });
                    return;
                  }
                  setSubmitting(true);
                  try {
                    const res = await fetch('/api/client/update-program', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-client-id': client!.id,
                      },
                      body: JSON.stringify({
                        program_type: selectedProgram,
                        event_date: selectedProgram === 'event_ready' ? (editEventDate || client.event_date) : undefined,
                      }),
                    });
                    if (res.ok) {
                      // Use the client data returned from API (includes correct current_phase)
                      const data = await res.json();
                      if (data.client) {
                        setClient(data.client);
                        sessionStorage.setItem('client_user', JSON.stringify(data.client));
                      }
                      setShowEditProgram(false);
                      setToast({ message: 'Program updated successfully!', type: 'success' });
                    } else {
                      setToast({ message: 'Failed to update program. Please try again.', type: 'error' });
                    }
                  } catch (err) {
                    setToast({ message: 'Failed to update program. Please try again.', type: 'error' });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="flex-1 py-3 rounded-lg bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Date Modal */}
      {showEventDateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-brand-charcoal/95 rounded-2xl border border-brand-cream/20 p-6">
            <h3 className="text-lg font-bold text-brand-cream mb-2">Set Event Date</h3>
            <p className="text-sm text-brand-cream/60 mb-4">
              When is your event? This helps us set the right timeline for your goal.
            </p>
            <div>
              <label className="block text-sm text-brand-cream/80 mb-2">Event Date</label>
              <input
                type="date"
                value={editEventDate}
                onChange={(e) => setEditEventDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowEventDateModal(false);
                  setShowEditProgram(true);
                }}
                className="flex-1 py-3 rounded-lg bg-brand-charcoal/80 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editEventDate) return;
                  setSubmitting(true);
                  try {
                    const res = await fetch('/api/client/update-program', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-client-id': client!.id,
                      },
                      body: JSON.stringify({
                        program_type: 'event_ready',
                        event_date: editEventDate,
                      }),
                    });
                    if (res.ok) {
                      // Use the client data returned from API (includes correct current_phase)
                      const data = await res.json();
                      if (data.client) {
                        setClient(data.client);
                        sessionStorage.setItem('client_user', JSON.stringify(data.client));
                      }
                      setShowEventDateModal(false);
                      setToast({ message: 'Event date set successfully!', type: 'success' });
                    } else {
                      setToast({ message: 'Failed to set event date. Please try again.', type: 'error' });
                    }
                  } catch (err) {
                    setToast({ message: 'Failed to set event date. Please try again.', type: 'error' });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !editEventDate}
                className="flex-1 py-3 rounded-lg bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Date'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

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
          <Link href="/client/weight" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">⚖️</span>
            <span className="text-xs mt-1">Weight</span>
          </Link>
          <Link href="/client/profile" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
