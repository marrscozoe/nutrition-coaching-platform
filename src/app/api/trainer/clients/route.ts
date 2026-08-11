import { NextRequest, NextResponse } from 'next/server';
import { getDb, db_all, getAdminClient } from '@/lib/db';

// GET - Fetch all clients for a trainer
export async function GET(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    // Use admin client to bypass RLS (trainer API needs full access)
    const supabase = getAdminClient();
    
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, email, gender, program_type, starting_weight, current_weight, goal_weight, event_date, current_phase, current_week, subscription_status, waiver_signed, notes, lead_source, created_at, updated_at')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get trainer clients error:', error);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    return NextResponse.json({ clients: clients || [] });
  } catch (error) {
    console.error('Get trainer clients error:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}
