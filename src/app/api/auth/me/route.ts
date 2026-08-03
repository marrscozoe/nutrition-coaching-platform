import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    // Use admin client to bypass RLS
    let supabase;
    try {
      supabase = getAdminClient();
    } catch (e) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id, trainer_id, email, name, gender, program_type, starting_weight, current_weight, goal_weight, goal_start_date, goal_type, event_date, current_phase, current_week, waiver_signed, subscription_status, subscription_end_date, notes, lead_source, created_at, updated_at')
      .eq('id', clientId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
