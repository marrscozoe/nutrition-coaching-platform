import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// POST /api/admin/migrate-allergies — one-time migration to add allergies column
export async function POST() {
  try {
    const supabase = getAdminClient();

    // Check if column already exists
    const { data: colCheck, error: colError } = await supabase
      .from('clients')
      .select('allergies')
      .limit(1)
      .maybeSingle();

    if (colError && colError.message?.includes('column "allergies" does not exist')) {
      console.log('[Migration] Column does not exist — need to add it');
      
      // Use Supabase management API via REST with service role
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 });
      }

      // Use the Supabase pg endpoint to run DDL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          query: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}'`
        })
      });

      // If that doesn't work, try via PostgREST custom route
      // Actually the best way: use the Supabase management API
      const managementResponse = await fetch(
        `https://api.supabase.com/v1/projects/${supabaseUrl.split('//')[1].split('.')[0]}/database/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            query: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}'`
          })
        }
      );

      if (managementResponse.ok) {
        console.log('[Migration] allergies column added via management API');
        return NextResponse.json({ success: true, message: 'allergies column added' });
      }

      // If management API fails, try using the Supabase connection string
      // via the postgres connection
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        // Use dynamic import for pg only when needed
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        try {
          await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}'`);
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_allergies ON clients USING GIN (allergies)`);
          console.log('[Migration] allergies column added via pg');
          await pool.end();
          return NextResponse.json({ success: true, message: 'allergies column added via pg' });
        } catch (pgErr: any) {
          await pool.end();
          if (pgErr.code === '4273' || pgErr.message?.includes('already exists')) {
            return NextResponse.json({ success: true, message: 'allergies column already exists' });
          }
          console.error('[Migration] pg error:', pgErr);
          return NextResponse.json({ error: pgErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ 
        error: 'Could not add column — no DATABASE_URL',
        supabaseUrl: !!supabaseUrl,
        serviceKey: !!serviceKey,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'allergies column already exists' });
  } catch (error: any) {
    console.error('[Migration] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
