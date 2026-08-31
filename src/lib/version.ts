// Auto-generated version system - no manual updates needed!
// Uses Vercel deployment ID in production (changes every deploy)
// Falls back to build timestamp in dev mode

// Vercel automatically sets this on each deploy
const getVersion = (): string => {
  // Production: use Vercel's deployment ID (unique per deploy)
  if (process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID) {
    return process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID;
  }
  
  // Fallback for local dev: use timestamp (changes on every build/hot-reload)
  // Using a random suffix ensures even same-second builds get different versions
  return `dev-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

export const CURRENT_VERSION = getVersion();
