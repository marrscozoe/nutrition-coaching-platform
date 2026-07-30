'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-brand-orange text-xl">Loading...</div>
    </div>
  );
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const nameParam = searchParams.get('name') || '';
  const token = searchParams.get('token') || '';
  const trainerId = searchParams.get('trainer') || '';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form data
  const [name, setName] = useState(nameParam);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [programType, setProgramType] = useState<'event_ready' | 'muscle_gain' | 'general_health' | 'first_responder'>('event_ready');
  const [goalWeight, setGoalWeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  async function handleSignup() {
    if (!token) {
      setError('Signup session expired. Please sign up again.');
      return;
    }

    if (!waiverAccepted) {
      setError('You must accept the liability waiver to continue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create account
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          gender,
          programType,
          currentWeight: currentWeight ? parseFloat(currentWeight) : null,
          goalWeight: goalWeight ? parseFloat(goalWeight) : null,
          eventDate: eventDate || null,
          leadSource: leadSource || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed');
        setLoading(false);
        return;
      }

      setSuccessMessage('Account created! Redirecting to your dashboard...');
      setTimeout(() => window.location.href = '/client', 2000);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pb-8">
      {/* Header */}
      <header className="px-6 py-4">
        <h1 className="text-2xl font-bold text-brand-orange">AMarsBody</h1>
        <p className="text-sm text-brand-cream/60">Start your transformation</p>
      </header>

      {/* Progress */}
      <div className="px-6 mb-6">
        <div className="flex gap-2">
          <div className={`h-2 flex-1 rounded ${step >= 1 ? 'bg-brand-orange' : 'bg-brand-cream/20'}`} />
          <div className={`h-2 flex-1 rounded ${step >= 2 ? 'bg-brand-orange' : 'bg-brand-cream/20'}`} />
          <div className={`h-2 flex-1 rounded ${step >= 3 ? 'bg-brand-orange' : 'bg-brand-cream/20'}`} />
        </div>
        <p className="text-xs text-brand-cream/50 mt-2">Step {step} of 3</p>
      </div>

      <div className="px-4 space-y-6">
        {successMessage ? (
          <div className="p-6 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 text-center">
            <p className="text-lg font-semibold">✓ {successMessage}</p>
            <p className="text-sm text-brand-cream/70 mt-2">Redirecting to login...</p>
          </div>
        ) : (
        <>
        {/* Step 1: Liability Waiver */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-xl font-bold text-brand-cream mb-2">Liability Waiver</h2>
              <p className="text-sm text-brand-cream/60 mb-4">
                Before we begin, please read and accept our liability waiver.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20 max-h-64 overflow-y-auto">
              <h3 className="font-semibold text-brand-cream mb-2">ASSUMPTION OF RISK AND WAIVER OF LIABILITY</h3>
              <p className="text-xs text-brand-cream/70 leading-relaxed">
                I acknowledge that participation in any fitness or nutrition program involves inherent risks, including but not limited to physical injury, muscle strain, sprain, or other bodily injury. I understand that these risks exist even with proper supervision and guidance.

                <br /><br />
                By signing this waiver, I:
                <br />
                1. Acknowledge that I am physically capable of participating in a nutrition and fitness program.
                <br />
                2. Assume all risks associated with my participation.
                <br />
                3. Release AMarsBody and its trainers from any liability for injuries or damages.
                <br />
                4. Understand this is not medical advice and should consult a physician before starting any program.
                <br />
                5. Am responsible for my own health and wellness decisions.
                <br />
                6. Understand that results vary based on individual effort and circumstances.

                <br /><br />
                This program provides nutritional guidance and support. I remain fully responsible for my own health outcomes.
              </p>
            </div>

            <label className="flex items-start gap-3 p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20 cursor-pointer">
              <input
                type="checkbox"
                checked={waiverAccepted}
                onChange={(e) => setWaiverAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-brand-cream/40 text-brand-orange focus:ring-brand-orange"
              />
              <div>
                <p className="text-sm text-brand-cream font-medium">I have read and accept the liability waiver</p>
                <p className="text-xs text-brand-cream/50 mt-1">I understand this is required to use the program</p>
              </div>
            </label>

            <button
              onClick={() => waiverAccepted && setStep(2)}
              disabled={!waiverAccepted}
              className="w-full py-4 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </>
        )}

        {/* Step 2: Basic Info */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-xl font-bold text-brand-cream mb-2">Tell Us About You</h2>
              <p className="text-sm text-brand-cream/60">We'll personalize your plan based on this info</p>
            </div>

            <div>
              <label className="block text-sm text-brand-cream/80 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm text-brand-cream/80 mb-2">Gender (for portion sizing)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-3 rounded-lg font-medium transition-colors ${
                    gender === 'male'
                      ? 'bg-brand-orange text-white'
                      : 'bg-brand-charcoal/80 text-brand-cream/60'
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-3 rounded-lg font-medium transition-colors ${
                    gender === 'female'
                      ? 'bg-brand-orange text-white'
                      : 'bg-brand-charcoal/80 text-brand-cream/60'
                  }`}
                >
                  Female
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-brand-cream/80 mb-2">Program Type</label>
              <select
                value={programType}
                onChange={(e) => setProgramType(e.target.value as 'event_ready' | 'muscle_gain' | 'general_health' | 'first_responder')}
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
              >
                <option value="event_ready">🎯 Event Ready (Wedding, Beach, etc.)</option>
                <option value="muscle_gain">💪 Muscle Gain</option>
                <option value="general_health">🏥 General Health</option>
                <option value="first_responder">🚒 First Responder</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-brand-cream/80 mb-2">Current Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm text-brand-cream/80 mb-2">Goal Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                  placeholder="0"
                />
              </div>
            </div>

            {programType === 'event_ready' && (
              <div>
                <label className="block text-sm text-brand-cream/80 mb-2">Event Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-4 rounded-xl bg-brand-charcoal/80 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!name || !currentWeight}
                className="flex-1 py-4 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-xl font-bold text-brand-cream mb-2">Review Your Info</h2>
              <p className="text-sm text-brand-cream/60">Make sure everything looks correct</p>
            </div>

            <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-brand-cream/60">Name</span>
                  <span className="text-brand-cream font-medium">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-cream/60">Gender</span>
                  <span className="text-brand-cream font-medium capitalize">{gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-cream/60">Program</span>
                  <span className="text-brand-cream font-medium capitalize">{programType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-cream/60">Current Weight</span>
                  <span className="text-brand-cream font-medium">{currentWeight} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-cream/60">Goal Weight</span>
                  <span className="text-brand-cream font-medium">{goalWeight || '--'} lbs</span>
                </div>
                {eventDate && (
                  <div className="flex justify-between">
                    <span className="text-brand-cream/60">Event Date</span>
                    <span className="text-brand-cream font-medium">
                      {new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-brand-cream/80 mb-2">How did you hear about us?</label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
              >
                <option value="">Select one...</option>
                <option value="bnl">BNI Referral</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="google">Google Search</option>
                <option value="friend">Friend/Family</option>
                <option value="other">Other</option>
              </select>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-4 rounded-xl bg-brand-charcoal/80 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSignup}
                disabled={loading}
                className="flex-1 py-4 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Start My Transformation'}
              </button>
            </div>

            <p className="text-xs text-brand-cream/40 text-center">
              Beta mode: No payment required. Free access for testing.
            </p>
          </>
        )}
      </>
      )
      }
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OnboardingContent />
    </Suspense>
  );
}
