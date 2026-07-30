'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PLANS } from '@/lib/stripe';

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');

  return (
    <main className="min-h-screen pb-8">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-brand-cream">Pricing</h1>
        <div className="w-12" />
      </header>

      {/* Beta Banner */}
      <div className="mx-4 mb-6 p-4 rounded-xl bg-green-500/20 border border-green-500/30">
        <p className="text-center text-green-400 font-semibold">
          🎉 Beta Mode - Free Access!
        </p>
        <p className="text-center text-brand-cream/60 text-sm mt-1">
          All features are free during beta testing. Pricing will activate when we launch!
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="mx-4 mb-6 flex justify-center">
        <div className="inline-flex bg-brand-charcoal/80 rounded-lg p-1">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-brand-orange text-white'
                : 'text-brand-cream/60'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-brand-orange text-white'
                : 'text-brand-cream/60'
            }`}
          >
            Annual
            <span className="ml-1 text-xs text-green-400">Save 33%</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="px-4 space-y-4">
        {PLANS.map((plan, index) => {
          const isPopular = plan.id === 'quarterly';
          const displayPrice = billingPeriod === 'annual' && plan.id === 'monthly'
            ? Math.round(plan.price * 12 * 0.67) // 33% off for annual
            : plan.id === 'monthly' && billingPeriod === 'annual'
            ? Math.round(plan.price * 12 * 0.67)
            : plan.price;

          return (
            <div
              key={plan.id}
              className={`p-6 rounded-2xl border-2 ${
                isPopular
                  ? 'bg-brand-orange/10 border-brand-orange'
                  : 'bg-brand-charcoal/80 border-brand-cream/10'
              }`}
            >
              {isPopular && (
                <div className="text-center mb-4">
                  <span className="px-3 py-1 rounded-full bg-brand-orange text-white text-xs font-semibold">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-brand-cream">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-4xl font-bold text-brand-orange">
                    ${billingPeriod === 'annual' && plan.id === 'monthly'
                      ? Math.round(plan.price * 12 * 0.67 / 12)
                      : billingPeriod === 'annual' && plan.id === 'annual'
                      ? Math.round(plan.price / 12)
                      : displayPrice}
                  </span>
                  <span className="text-brand-cream/60">/month</span>
                </div>
                {billingPeriod === 'annual' && plan.savings && (
                  <p className="text-green-400 text-sm font-medium mt-1">
                    Save {plan.savings}!
                  </p>
                )}
                {billingPeriod === 'annual' && plan.id !== 'monthly' && (
                  <p className="text-brand-cream/40 text-xs mt-1">
                    Billed ${plan.price}/{plan.interval}
                  </p>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-brand-cream/80">
                    <span className="text-green-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/onboarding"
                className={`block w-full py-3 rounded-xl text-center font-semibold transition-colors ${
                  isPopular
                    ? 'bg-brand-orange text-white hover:bg-brand-orange-dark'
                    : 'bg-brand-charcoal/60 text-brand-cream hover:bg-brand-charcoal/40 border border-brand-cream/20'
                }`}
              >
                {isPopular ? 'Get Started' : 'Choose Plan'}
              </Link>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="mx-4 mt-8">
        <h2 className="text-lg font-bold text-brand-cream mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {[
            {
              q: 'Can I cancel anytime?',
              a: 'Yes! Cancel anytime with no penalties.',
            },
            {
              q: 'Is there a free trial?',
              a: 'Beta users get FREE access. Launch pricing TBD.',
            },
            {
              q: 'What if I want to change plans?',
              a: 'You can upgrade or downgrade anytime.',
            },
          ].map((faq, i) => (
            <div key={i} className="p-4 rounded-xl bg-brand-charcoal/60 border border-brand-cream/10">
              <p className="font-medium text-brand-cream">{faq.q}</p>
              <p className="text-sm text-brand-cream/60 mt-1">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-8 text-center">
        <p className="text-xs text-brand-cream/30">
          Questions? Email amarsbody@gmail.com
        </p>
      </footer>
    </main>
  );
}
