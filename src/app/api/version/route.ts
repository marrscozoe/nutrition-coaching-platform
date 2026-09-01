import { NextResponse } from 'next/server';

// This endpoint returns the current server version (deployment ID)
// Client can poll this to check if a new version is available

export const dynamic = 'force-dynamic';

export async function GET() {
  // Use the same version logic as version.ts
  // Must check NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID first, then VERCEL_DEPLOYMENT_ID
  // to match the client-side version.ts
  const deploymentId = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ||
                       process.env.VERCEL_DEPLOYMENT_ID ||
                       'local-dev';

  return NextResponse.json({
    version: deploymentId,
    timestamp: Date.now()
  });
}
