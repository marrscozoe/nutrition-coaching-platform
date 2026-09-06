import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/admin/migrate-custom-allergy-bans
// Adds custom_allergy_bans TEXT[] column to clients table
export async function POST() {
  const sql = `
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_allergy_bans text[] DEFAULT '{}';
    ALTER TABLE clients ALTER COLUMN custom_allergy_bans SET DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS idx_clients_custom_allergy_bans ON clients USING GIN (custom_allergy_bans);
  `;

  const { error } = await supabaseAdmin.rpc('exec', { sql_query: sql });

  if (error) {
    console.error('[migrate-custom-allergy-bans] RPC error:', error);
    // Fallback: try to SELECT from the column to see if it exists
    const { data: colCheck, error: selectError } = await supabaseAdmin
      .from('clients')
      .select('custom_allergy_bans')
      .limit(1)
      .maybeSingle();

    if (selectError && selectError.code === 'PGRST116') {
      // Column doesn't exist — can't add via SELECT fallback
      return NextResponse.json(
        { error: `Migration failed: ${error.message}. Run manually in Supabase SQL Editor.` },
        { status: 500 }
      );
    }

    // If SELECT worked (column exists), we're fine
    if (!selectError || selectError.code === 'PGRST116') {
      return NextResponse.json({
        success: true,
        message: 'custom_allergy_bans column ready (or already exists)',
      });
    }

    return NextResponse.json(
      { error: `Migration failed: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'custom_allergy_bans column added successfully',
  });
}
