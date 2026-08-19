import { NextRequest, NextResponse } from 'next/server';
import { db_run } from '@/lib/db';

const VALID_PROGRAMS = ['get_shredded', 'muscle_gain', 'event_ready', 'general_health'];

// Starting phases for each program
const PROGRAM_STARTING_PHASES: Record<string, number> = {
  event_ready: 1,
  get_shredded: 1,
  general_health: 4,
  muscle_gain: 6,
};

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { program_type, event_date } = body;

    if (!program_type || !VALID_PROGRAMS.includes(program_type)) {
      return NextResponse.json(
        { error: `Invalid program type. Must be one of: ${VALID_PROGRAMS.join(', ')}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Build dynamic update query
    const updates: string[] = ['program_type = ?', 'current_phase = ?'];
    const values: any[] = [program_type, PROGRAM_STARTING_PHASES[program_type]];

    // If event_ready program, require event_date
    if (program_type === 'event_ready') {
      if (!event_date) {
        return NextResponse.json(
          { error: 'Event date is required for Event Ready program' },
          { status: 400 }
        );
      }
      updates.push('event_date = ?');
      values.push(event_date);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(clientId);

    await db_run(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    // Fetch updated client to return
    const { db_all } = await import('@/lib/db');
    const clients = await db_all(
      'SELECT * FROM clients WHERE id = ?',
      clientId
    );

    return NextResponse.json({
      success: true,
      message: 'Program updated successfully',
      client: clients[0] || null,
    });
  } catch (error) {
    console.error('Update program error:', error);
    return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
  }
}
