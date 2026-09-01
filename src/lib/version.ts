// Auto-generated version system - no manual updates needed!
// Uses Vercel deployment ID in production (changes every deploy)
// Falls back to build timestamp in dev mode

// Vercel automatically sets these on each deploy
const getVersion = (): string => {
  // Production: use Vercel's deployment ID (unique per deploy)
  // Check both env vars to match the server API route logic
  if (process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID) {
    return process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID;
  }

  // Fallback to VERCEL_DEPLOYMENT_ID (set in Vercel runtime environment)
  if (process.env.VERCEL_DEPLOYMENT_ID) {
    return process.env.VERCEL_DEPLOYMENT_ID;
  }

  // Fallback for local dev: use a fixed dev marker
  // DO NOT use Date.now() or Math.random() - those change on every call/build
  // and cause infinite update loops because client and server versions drift apart
  return 'local-dev';
};

export const CURRENT_VERSION = getVersion();
