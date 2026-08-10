import { NextRequest, NextResponse } from 'next/server';
import { getDb, db_all } from '@/lib/db';

// GET - Fetch all clients for a trainer
export async function GET(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    const db = await getDb();
    
    const stmt = db.prepare(`
      SELECT 
        id, name, email, gender, program_type, starting_weight, current_weight,
        goal_weight, event_date, current_phase, current_week, subscription_status,
        waiver_signed, notes, lead_source, created_at, updated_at
      FROM clients 
      ORDER BY created_at DESC
    `);
    const clients = await db_all(stmt);

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Get trainer clients error:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}
