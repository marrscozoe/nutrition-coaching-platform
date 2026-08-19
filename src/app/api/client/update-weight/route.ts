import { NextRequest, NextResponse } from 'next/server';
import { db_run, db_all, getAdminClient } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { starting_weight, current_weight } = body;

    if (!starting_weight && !current_weight) {
      return NextResponse.json({ error: 'At least one weight field is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Get current client data BEFORE update to check if weight actually changed
    const supabase = getAdminClient();
    const { data: oldClient } = await supabase.from('clients').select('*').eq('id', clientId).single();

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];

    if (starting_weight !== undefined && starting_weight !== null) {
      updates.push('starting_weight = ?');
      values.push(starting_weight);
    }

    if (current_weight !== undefined && current_weight !== null) {
      updates.push('current_weight = ?');
      values.push(current_weight);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(clientId);

    await db_run(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    // Phase transition logic - only check if current_weight was updated
    let newPhase = oldClient?.current_phase;
    let phaseChanged = false;
    let resetPhaseStart = false;
    let newWeek = oldClient?.current_week || 1;

    if (current_weight !== undefined && current_weight !== null && oldClient) {
      const goalWeight = oldClient.goal_weight;
      const programType = oldClient.program_type;
      const currentPhase = oldClient.current_phase || 1;
      const phaseStartDate = oldClient.phase_start_date || now;
      const daysInPhase = Math.floor((new Date(now).getTime() - new Date(phaseStartDate).getTime()) / (1000 * 60 * 60 * 24));

      newPhase = currentPhase;

      // GOAL ATTAINED - check FIRST (except for Phase 4 and Phase 6)
      if (goalWeight && currentPhase !== 4 && currentPhase !== 6) {
        const atGoal = (programType === 'muscle_gain')
          ? (current_weight >= goalWeight)
          : (current_weight <= goalWeight);
        if (atGoal) {
          newPhase = 4;
          resetPhaseStart = true;
        }
      }

      // ===== PROGRAM-SPECIFIC PHASE TRANSITIONS =====

      // GET_SHREDDED: Phase 1 ↔ Phase 5 (14 days each), Phase 4 when 4+ lbs over goal
      if (programType === 'get_shredded' && newPhase === currentPhase) {
        // Phase 1 → Phase 5: After 14 days
        if (currentPhase === 1 && daysInPhase >= 14) {
          newPhase = 5;
          resetPhaseStart = true;
        }
        // Phase 5 → Phase 1: After 14 days
        else if (currentPhase === 5 && daysInPhase >= 14) {
          newPhase = 1;
          resetPhaseStart = true;
        }
        // Phase 4: If 4+ lbs over goal → Phase 1
        else if (currentPhase === 4 && goalWeight && current_weight > goalWeight + 4) {
          newPhase = 1;
          resetPhaseStart = true;
        }
      }

      // EVENT_READY: Phase 1 → Phase 2 (14 days), Phase 2 → Phase 1 (7 days), Phase 4 when 4+ lbs over goal
      else if (programType === 'event_ready' && newPhase === currentPhase) {
        // Phase 1 → Phase 2: After 14 days
        if (currentPhase === 1 && daysInPhase >= 14) {
          newPhase = 2;
          resetPhaseStart = true;
        }
        // Phase 2 → Phase 1: After 7 days
        else if (currentPhase === 2 && daysInPhase >= 7) {
          newPhase = 1;
          resetPhaseStart = true;
        }
        // Phase 4: If 4+ lbs over goal → Phase 1
        else if (currentPhase === 4 && goalWeight && current_weight > goalWeight + 4) {
          newPhase = 1;
          resetPhaseStart = true;
        }
      }

      // GENERAL_HEALTH: Phase 4 ↔ Phase 1 (4+ lbs gain triggers Phase 1, 7 days returns to Phase 4)
      else if (programType === 'general_health' && newPhase === currentPhase) {
        // Phase 4 → Phase 1: If client GAINS 4+ lbs over goal
        if (currentPhase === 4 && goalWeight && current_weight > goalWeight + 4) {
          newPhase = 1;
          resetPhaseStart = true;
        }
        // Phase 1 → Phase 4: After 7 days
        else if (currentPhase === 1 && daysInPhase >= 7) {
          newPhase = 4;
          resetPhaseStart = true;
        }
      }

      // MUSCLE_GAIN: Phase 6 ↔ Phase 4 (at goal = Phase 4, 4+ lbs below = Phase 6)
      else if (programType === 'muscle_gain' && newPhase === currentPhase) {
        // At goal → Phase 4
        if (goalWeight && current_weight >= goalWeight) {
          newPhase = 4;
          resetPhaseStart = true;
        }
        // Weight drops 4+ lbs below goal → Phase 6
        else if (currentPhase === 4 && goalWeight && current_weight < goalWeight - 4) {
          newPhase = 6;
          resetPhaseStart = true;
        }
        // At goal again → Phase 4 (from Phase 6)
        else if (currentPhase === 6 && goalWeight && current_weight >= goalWeight) {
          newPhase = 4;
          resetPhaseStart = true;
        }
      }

      // Calculate current_week based on phase and days in phase
      if (currentPhase === 1) {
        newWeek = 1;
      } else if (currentPhase === 2) {
        newWeek = Math.min(2, Math.floor(daysInPhase / 7) + 1);
      } else if (currentPhase === 5) {
        newWeek = Math.min(3, Math.floor(daysInPhase / 14) + 1);
      } else if (currentPhase === 4 || currentPhase === 6) {
        newWeek = 4;
      }

      // Update phase if it changed
      if (newPhase !== currentPhase) {
        await db_run(
          `UPDATE clients SET current_phase = ?, phase_start_date = ?, current_week = ?, updated_at = ? WHERE id = ?`,
          newPhase, resetPhaseStart ? now : phaseStartDate, newWeek, now, clientId
        );
        phaseChanged = true;
      } else if (newWeek !== oldClient.current_week) {
        // Update week even if phase didn't change
        await db_run(
          `UPDATE clients SET current_week = ?, updated_at = ? WHERE id = ?`,
          newWeek, now, clientId
        );
      }
    }

    // Fetch updated client data to return
    const { data: updatedClient } = await supabase.from('clients').select('*').eq('id', clientId).single();

    return NextResponse.json({
      success: true,
      message: 'Weight updated successfully',
      phaseChanged,
      currentPhase: updatedClient?.current_phase,
      currentWeek: updatedClient?.current_week,
    });
  } catch (error) {
    console.error('Update weight error:', error);
    return NextResponse.json({ error: 'Failed to update weight' }, { status: 500 });
  }
}
