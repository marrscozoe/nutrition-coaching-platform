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
      .select('id, name, email, gender, program_type, starting_weight, current_weight, goal_weight, event_date, current_phase, current_week, subscription_status, waiver_signed, notes, lead_source, created_at, updated_at, phase5_plan, phase5_start_date')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get trainer clients error:', error);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    // Get last meal date for each client
    if (clients && clients.length > 0) {
      const clientIds = clients.map(c => c.id);
      
      // Query meal logs to get the most recent meal for each client
      const { data: mealLogs } = await supabase
        .from('meals')
        .select('client_id, logged_at')
        .in('client_id', clientIds)
        .order('logged_at', { ascending: false });

      // Build a map of client_id -> last_meal_date
      const lastMealMap: Record<string, string> = {};
      if (mealLogs) {
        for (const log of mealLogs) {
          if (!lastMealMap[log.client_id]) {
            lastMealMap[log.client_id] = log.logged_at;
          }
        }
      }

      // Add last_meal_date to each client
      for (const client of clients as any[]) {
        (client as any).last_meal_date = lastMealMap[client.id] || null;
      }
    }

    return NextResponse.json({ clients: clients || [] });
  } catch (error) {
    console.error('Get trainer clients error:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}
