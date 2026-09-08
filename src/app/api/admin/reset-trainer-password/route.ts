import { NextRequest, NextResponse } from 'next/server';

// DISABLED: this route previously reset amarsbody@gmail.com to a known password
// and returned it in JSON. That is unsafe on production. Use a one-off local script
// or Supabase dashboard if a reset is needed — never an open HTTP endpoint.
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'Disabled. Trainer password reset via HTTP is not allowed.' },
    { status: 410 }
  );
}
