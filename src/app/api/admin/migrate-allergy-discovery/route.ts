import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// One-shot migration: add allergy_discovery_enabled column
// Safe to run multiple times — uses IF NOT EXISTS
// Run in Supabase dashboard SQL Editor:
/*
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS allergy_discovery_enabled BOOLEAN NOT NULL DEFAULT FALSE;
*/
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();

    // Check if column already exists by trying to read it
    const { error: selectError } = await supabase
      .from('clients')
      .select('allergy_discovery_enabled')
      .limit(1);

    if (selectError && selectError.message.includes('allergy_discovery_enabled')) {
      return NextResponse.json({
        status: 'already_applied',
        message: 'Column allergy_discovery_enabled already exists.',
      });
    }

    // Try to add the column via raw SQL using rpc (if available)
    // Note: this requires the pgcrypto extension or direct DB access
    // The fallback response tells the caller to run in Supabase dashboard
    return NextResponse.json({
      status: 'manual_migration_required',
      message: 'Run this SQL in Supabase SQL Editor:',
      sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergy_discovery_enabled BOOLEAN NOT NULL DEFAULT FALSE;',
      note: 'Default FALSE means existing clients will NOT receive discovery tips until they opt in.',
    });
  } catch (err) {
    console.error('[migrate-allergy-discovery] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
