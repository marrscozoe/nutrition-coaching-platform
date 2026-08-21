import { NextRequest, NextResponse } from 'next/server';
import { db_run, db_get, db_all } from '@/lib/db';

const VALID_PROGRAMS = ['get_shredded', 'muscle_gain', 'event_ready', 'general_health'];

// Starting phases for each program (fallback only — actual phase determined by weight check below)
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

    // Fetch current client data to determine correct phase based on weight
    const client = await db_get('SELECT * FROM clients WHERE id = ?', clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const currentWeight = client.current_weight;
    const goalWeight = client.goal_weight;

    // Determine correct phase based on current weight vs goal weight
    let newPhase = PROGRAM_STARTING_PHASES[program_type];
    if (goalWeight && currentWeight) {
      const atGoal = (program_type === 'muscle_gain')
        ? (currentWeight >= goalWeight)
        : (currentWeight <= goalWeight);

      if (atGoal) {
        newPhase = 4;
      } else if (program_type === 'muscle_gain') {
        // muscle_gain: not at goal → Phase 6
        newPhase = 6;
      }
      // general_health: always Phase 4 (maintenance only) — if 4+ lbs over goal, AI/trainer advises to switch programs
    }

    // Build dynamic update query
    const updates: string[] = ['program_type = ?', 'current_phase = ?'];
    const values: any[] = [program_type, newPhase];

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
    } else {
      // Clear event_date when switching to a non-event_ready program
      updates.push('event_date = NULL');
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(clientId);

    await db_run(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    // Fetch updated client to return
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
