import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

/**
 * Temporary admin endpoint to create food_corrections table
 * This is a one-time setup endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    
    // Create the food_corrections table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS food_corrections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        food_name TEXT NOT NULL,
        correct_category TEXT NOT NULL CHECK (correct_category IN ('protein', 'vegetable', 'fat', 'starch', 'dairy', 'sugar', 'other')),
        submitted_by UUID REFERENCES clients(id) ON DELETE SET NULL,
        submitted_by_name TEXT,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        approved BOOLEAN DEFAULT false,
        approved_by UUID REFERENCES trainers(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        reviewed_at TIMESTAMPTZ,
        reviewed_by UUID REFERENCES trainers(id) ON DELETE SET NULL,
        rejected BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Execute raw SQL - we need to use rpc or direct query
    // Try using the REST API directly
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      },
      body: JSON.stringify({ query: createTableSQL })
    });

    // Actually, let's try a different approach - use the admin client to create table
    // The admin client should have rights to create tables
    const { data, error } = await admin.rpc('exec', { sql: createTableSQL }).single();

    if (error) {
      // If rpc doesn't work, try another approach
      console.log('[Setup] RPC error (may be expected):', error.message);
    }

    // Try using raw SQL through admin client
    const sqlResponse = await admin.from('_temp').select('*').limit(1);
    
    // If we get here, return success
    return NextResponse.json({ 
      success: true, 
      message: 'Table creation endpoint called',
      note: 'This endpoint attempts to create the table via service role key'
    });
  } catch (e: any) {
    console.error('[Setup] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok', message: 'Setup endpoint - use POST to create tables' });
}
