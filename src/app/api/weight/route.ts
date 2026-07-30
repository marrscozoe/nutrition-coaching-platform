import { NextRequest, NextResponse } from 'next/server';
import { db_get, db_all, db_run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET - Fetch weight history for a client
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const weighIns = await db_all(
      `SELECT * FROM weigh_ins 
       WHERE client_id = ? 
       ORDER BY created_at DESC 
       LIMIT 20`,
      clientId
    );

    return NextResponse.json({ weighIns });
  } catch (error) {
    console.error('Get weight error:', error);
    return NextResponse.json({ error: 'Failed to fetch weight' }, { status: 500 });
  }
}

// POST - Log a new weight
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { weight, bodyFatPercent, pantSize, waistSize, notes, weighDay } = body;

    if (!weight) {
      return NextResponse.json({ error: 'Weight is required' }, { status: 400 });
    }

    const weighInId = uuidv4();
    const now = new Date().toISOString();

    // Insert weigh-in
    await db_run(
      `INSERT INTO weigh_ins (id, client_id, weight, body_fat_percent, pant_size, waist_size, notes, weigh_day, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      weighInId, clientId, weight, bodyFatPercent || null, pantSize || null, waistSize || null, notes || null, weighDay || null, now
    );

    // Check for milestones
    const client = await db_get('SELECT * FROM clients WHERE id = ?', clientId) as any;
    
    // If starting_weight is not set, set it to this first weight
    if (!client?.starting_weight) {
      await db_run(
        `UPDATE clients SET starting_weight = ?, current_weight = ?, updated_at = ? WHERE id = ?`,
        weight, weight, now, clientId
      );
    } else {
      // Update client's current weight
      await db_run(
        `UPDATE clients SET current_weight = ?, updated_at = ? WHERE id = ?`,
        weight, now, clientId
      );

      // Phase progression check on weight log
      try {
        const updatedClient = await db_get('SELECT * FROM clients WHERE id = ?', clientId) as any;
        if (updatedClient) {
          const currentPhase = updatedClient.current_phase || 1;
          const goalWeight = updatedClient.goal_weight;
          const phaseStartDate = updatedClient.phase_start_date || now;
          const daysInPhase = Math.floor((new Date(now).getTime() - new Date(phaseStartDate).getTime()) / (1000 * 60 * 60 * 24));

          let newPhase = currentPhase;
          let resetPhaseStart = false;

          if (currentPhase === 3 && goalWeight && weight <= goalWeight) {
            // Phase 3 → Phase 4: at goal weight
            newPhase = 4;
            resetPhaseStart = true;
          } else if (currentPhase === 3 && daysInPhase >= 14) {
            // Phase 3 → Phase 1: 14+ days in Phase 3 but not at goal
            newPhase = 1;
            resetPhaseStart = true;
          } else if (currentPhase === 4 && goalWeight && weight > goalWeight + 5) {
            // Phase 4 → Phase 1: 5+ lbs above goal
            newPhase = 1;
            resetPhaseStart = true;
          }

          if (newPhase !== currentPhase) {
            await db_run(
              `UPDATE clients SET current_phase = ?, phase_start_date = ?, updated_at = ? WHERE id = ?`,
              newPhase, resetPhaseStart ? now : phaseStartDate, now, clientId
            );
          }
        }
      } catch (phaseErr) {
        console.error('Phase progression check error:', phaseErr);
      }
    }

    const startingWeight = client?.starting_weight || weight;
    const weightLost = startingWeight - weight;
    const goalWeight = client?.goal_weight;

    const milestones: string[] = [];

    if (goalWeight && weight <= goalWeight) {
      await db_run(
        `INSERT INTO milestones (id, client_id, milestone_type, achieved_at) VALUES (?, ?, 'goal', ?)`,
        uuidv4(), clientId, now
      );
      milestones.push('goal');
    } else if (weightLost >= 30) {
      const existing = await db_get("SELECT id FROM milestones WHERE client_id = ? AND milestone_type = '30lb'", clientId);
      if (!existing) {
        await db_run(
          `INSERT INTO milestones (id, client_id, milestone_type, achieved_at) VALUES (?, ?, '30lb', ?)`,
          uuidv4(), clientId, now
        );
        milestones.push('30lb');
      }
    } else if (weightLost >= 20) {
      const existing = await db_get("SELECT id FROM milestones WHERE client_id = ? AND milestone_type = '20lb'", clientId);
      if (!existing) {
        await db_run(
          `INSERT INTO milestones (id, client_id, milestone_type, achieved_at) VALUES (?, ?, '20lb', ?)`,
          uuidv4(), clientId, now
        );
        milestones.push('20lb');
      }
    } else if (weightLost >= 10) {
      const existing = await db_get("SELECT id FROM milestones WHERE client_id = ? AND milestone_type = '10lb'", clientId);
      if (!existing) {
        await db_run(
          `INSERT INTO milestones (id, client_id, milestone_type, achieved_at) VALUES (?, ?, '10lb', ?)`,
          uuidv4(), clientId, now
        );
        milestones.push('10lb');
      }
    }

    return NextResponse.json({
      success: true,
      weighInId,
      weightLost: Math.round(weightLost * 10) / 10,
      milestones,
      message: 'Weight logged successfully',
    });
  } catch (error) {
    console.error('Log weight error:', error);
    return NextResponse.json({ error: 'Failed to log weight' }, { status: 500 });
  }
}
