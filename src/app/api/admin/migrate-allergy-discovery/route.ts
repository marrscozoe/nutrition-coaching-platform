import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// One-shot migration: add allergy_discovery_enabled column
// Safe to run multiple times — uses IF NOT EXISTS
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();

    // Add column if it doesn't exist
    const { error } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergy_discovery_enabled BOOLEAN NOT NULL DEFAULT FALSE;',
    }).catch(() => {
      // Fallback: try direct SQL via raw query if rpc not available
      return { error: null };
    });

    // If RPC didn't work, try via raw REST
    // Actually just return success — Supabase free tier doesn't allow DDL via anon key
    // This migration should be run in Supabase dashboard
    return NextResponse.json({
      message: 'Migration endpoint hit. Run this SQL in Supabase dashboard:',
      sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergy_discovery_enabled BOOLEAN NOT NULL DEFAULT FALSE;',
      note: 'Default FALSE means existing clients will NOT receive discovery tips until they opt in.',
    });
  } catch (err) {
    console.error('[migrate-allergy-discovery] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
