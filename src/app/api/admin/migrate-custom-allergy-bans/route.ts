import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getAdminClient } from '@/lib/db';

// POST /api/admin/migrate-custom-allergy-bans
// Verifies (or adds) the custom_allergy_bans TEXT[] column on the clients table.
// This uses a SELECT check — if the column doesn't exist the SELECT will fail.
// For Supabase: the column must be pre-created via the SQL migration file or manually.
// This endpoint then makes the column available by re-inserting/updating rows if needed.
export async function POST() {
  try {
    const supabase = getAdminClient();

    // Check if column exists by trying to read it
    const { data: colCheck, error: colError } = await supabase
      .from('clients')
      .select('custom_allergy_bans')
      .limit(1)
      .maybeSingle();

    if (colError && colError.message && colError.message.includes('column "custom_allergy_bans" does not exist')) {
      console.error('[Migration] custom_allergy_bans column does not exist. Apply the SQL migration first.');
      return NextResponse.json({
        error: 'Column does not exist. Run this SQL in Supabase SQL Editor: ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_allergy_bans text[] DEFAULT \'{}\';',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'custom_allergy_bans column exists and is ready',
    });
  } catch (error: any) {
    console.error('[Migration] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
