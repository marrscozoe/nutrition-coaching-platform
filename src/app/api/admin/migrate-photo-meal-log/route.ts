import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// Migration: add photo_meal_log_enabled column to clients table
// Safe to run multiple times — uses IF NOT EXISTS
export async function POST() {
  try {
    const supabase = getAdminClient();

    // Check if column already exists
    const { error: selectError } = await supabase
      .from('clients')
      .select('photo_meal_log_enabled')
      .limit(1);

    if (!selectError) {
      return NextResponse.json({
        status: 'already_applied',
        message: 'Column photo_meal_log_enabled already exists.',
      });
    }

    // Try to add the column via raw SQL using rpc (if available)
    // This requires the exec function to be available in Supabase
    const { error: rpcError } = await supabase.rpc('exec', {
      sql_query: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_meal_log_enabled BOOLEAN NOT NULL DEFAULT FALSE;',
    });

    if (rpcError) {
      // Fallback: try using the admin client directly
      // This won't work for DDL in most Supabase setups but we try anyway
      const { error: alterError } = await supabase.from('clients').upsert({
        id: '00000000-0000-0000-0000-000000000000',
      }).select();

      if (alterError && alterError.message.includes('photo_meal_log_enabled')) {
        return NextResponse.json({
          status: 'already_applied',
          message: 'Column photo_meal_log_enabled already exists.',
        });
      }

      return NextResponse.json({
        status: 'manual_migration_required',
        message: 'Run this SQL in Supabase SQL Editor:',
        sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_meal_log_enabled BOOLEAN NOT NULL DEFAULT FALSE;',
        note: 'Default FALSE means existing clients will NOT see photo UI until they opt in.',
        rpcError: rpcError?.message,
      });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Migration applied: photo_meal_log_enabled column added to clients table.',
    });
  } catch (err) {
    console.error('[migrate-photo-meal-log] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
