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
      console.error('POST /api/client/symptoms error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ symptom }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/client/symptoms error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
