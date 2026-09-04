import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET /api/client/symptoms — get recent symptoms for a client
// Returns symptoms from the last 7 days (America/Chicago timezone)
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();

    // Get symptoms from last 7 days in America/Chicago timezone
    // Calculate 7 days ago in Chicago time
    const nowChicago = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const sevenDaysAgo = new Date(nowChicago.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sinceStr = sevenDaysAgo.toISOString();

    const { data: symptoms, error } = await supabase
      .from('symptoms')
      .select('*')
      .eq('client_id', clientId)
      .gte('created_at', sinceStr)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET /api/client/symptoms error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ symptoms: symptoms || [] });
  } catch (error) {
    console.error('GET /api/client/symptoms error:', error);
    return NextResponse.json({ error: 'Failed to get symptoms' }, { status: 500 });
  }
}

// POST /api/client/symptoms — log a new symptom
// Body: { type: 'bloating' | 'stomach_pain', mealId?: string, notes?: string }
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { type, mealId, notes } = body;

    if (!type || !['bloating', 'stomach_pain'].includes(type)) {
      return NextResponse.json({ error: 'Invalid symptom type' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const symptomId = uuidv4();
    const now = new Date().toISOString();

    const { data: symptom, error } = await supabase
      .from('symptoms')
      .insert({
        id: symptomId,
        client_id: clientId,
        type,
        meal_id: mealId || null,
        notes: notes || null,
        created_at: now,
      })
      .select()
      .single();

    if (error) {
      // If symptoms table doesn't exist, try to create it
      if (error.message.includes('relation "symptoms" does not exist') || error.code === '42P01') {
        console.log('[Symptoms] Table does not exist — creating...');
        // Create table via pg
        const dbUrl = process.env.DATABASE_URL;
        if (dbUrl) {
          const { Pool } = await import('pg');
          const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS symptoms (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id UUID NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('bloating', 'stomach_pain')),
                meal_id UUID,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_symptoms_client_id ON symptoms (client_id);
              CREATE INDEX IF NOT EXISTS idx_symptoms_created_at ON symptoms (created_at);
            `);
            await pool.end();
            console.log('[Symptoms] Table created successfully');
            
            // Retry insert
            const { Pool: Pool2 } = await import('pg');
            const pool2 = new Pool2({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
            const symptomId2 = uuidv4();
            const { data: symptom2, error: error2 } = await pool2.query(
              `INSERT INTO symptoms (id, client_id, type, meal_id, notes, created_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               RETURNING *`,
              [symptomId2, clientId, type, mealId || null, notes || null]
            ).then(async (result) => {
              await pool2.end();
              return { data: result.rows[0], error: null };
            }).catch((err) => ({
              data: null,
              error: err
            }));
            
            if (error2) {
              console.error('[Symptoms] Retry insert error:', error2);
              return NextResponse.json({ error: error2.message }, { status: 500 });
            }
            return NextResponse.json({ symptom: symptom2 || symptom }, { status: 201 });
          } catch (createErr: any) {
            await pool.end();
            console.error('[Symptoms] Create table error:', createErr);
            return NextResponse.json({ error: createErr.message }, { status: 500 });
          }
        }
      }
      console.error('POST /api/client/symptoms error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ symptom }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/client/symptoms error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
