import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// POST /api/admin/migrate-allergies — one-time migration to add allergies column
// NOTE: This route is kept for backward compatibility. The column should already exist.
// If it doesn't, run: ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}';
export async function POST() {
  try {
    const supabase = getAdminClient();

    // Check if column exists by trying to read it
    const { data: colCheck, error: colError } = await supabase
      .from('clients')
      .select('allergies')
      .limit(1)
      .maybeSingle();

    if (colError && colError.message && colError.message.includes('column "allergies" does not exist')) {
      console.error('[Migration] allergies column does not exist. Please run the SQL migration.');
      return NextResponse.json({ 
        error: 'Column does not exist. Please apply migration manually.',
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'allergies column exists' });
  } catch (error: any) {
    console.error('[Migration] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
