// Stripe configuration
// STRIPE IS DISABLED FOR BETA - All accounts have free access

export const STRIPE_ENABLED = false; // Always false until beta ends

export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  prices: {
    monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',
    quarterly: process.env.STRIPE_PRICE_QUARTERLY || 'price_quarterly_placeholder',
    annual: process.env.STRIPE_PRICE_ANNUAL || 'price_annual_placeholder',
  },
};

export const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 99,
    interval: 'month',
    features: [
      'Full program access',
      'AI nutrition coaching',
      'Meal logging',
      'Weight tracking',
      'Trainer support',
    ],
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    price: 249,
    interval: 'quarter',
    savings: '17%',
    features: [
      'Everything in Monthly',
      'Save 17% vs monthly',
      'Priority support',
      'Custom meal plans',
    ],
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 799,
    interval: 'year',
    savings: '33%',
    features: [
      'Everything in Quarterly',
      'Save 33% vs monthly',
      'VIP support',
      'Custom meal plans',
      'Nutrition consultation',
    ],
  },
];

// If Stripe is disabled, these functions are not used
export async function createCheckoutSession(clientId: string, planId: string) {
  if (!STRIPE_ENABLED) {
    throw new Error('Stripe is disabled for beta');
  }
  // Stripe integration would go here
  throw new Error('Stripe not implemented');
}

export async function createCustomerPortalSession(trainerId: string) {
  if (!STRIPE_ENABLED) {
    throw new Error('Stripe is disabled for beta');
  }
  throw new Error('Stripe not implemented');
}

export async function getSubscriptionStatus(subscriptionId: string) {
  if (!STRIPE_ENABLED) {
    return { status: 'active', plan: 'beta' };
  }
  throw new Error('Stripe not implemented');
}
