import { NextRequest, NextResponse } from 'next/server';
import { db_run, getAdminClient } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { goal_weight } = body;

    if (!goal_weight || goal_weight <= 0) {
      return NextResponse.json({ error: 'Valid goal weight is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Get current client data BEFORE update to check for phase transitions
    const supabase = getAdminClient();
    const { data: oldClient } = await supabase.from('clients').select('*').eq('id', clientId).single();

    // Update goal_weight AND reset goal_start_date to now
    // This makes week counter reset to 1 for the new goal
    await db_run(
      `UPDATE clients SET goal_weight = ?, goal_start_date = ?, updated_at = ? WHERE id = ?`,
      goal_weight, now, now, clientId
    );

    // Phase transition logic - check if new goal weight triggers phase transitions
    let phaseChanged = false;
    let newPhase = oldClient?.current_phase;

    if (oldClient && goal_weight) {
      const currentWeight = oldClient.current_weight;
      const programType = oldClient.program_type;
      const currentPhase = oldClient.current_phase || 1;

      // ===== MUSCLE_GAIN: Phase 6 → Phase 4 when goal is at/below current weight =====
      if (programType === 'muscle_gain' && currentPhase === 6 && currentWeight) {
        if (goal_weight <= currentWeight) {
          newPhase = 4; // Goal met/attained → maintenance
          phaseChanged = true;
        }
        // Otherwise stays in Phase 6 (still needs to gain toward higher goal)
      }
      // ===== MUSCLE_GAIN: goal raised above current weight → Phase 6 (needs to gain) =====
      else if (programType === 'muscle_gain' && currentPhase !== 6 && currentWeight) {
        if (goal_weight > currentWeight) {
          newPhase = 6; // Goal is now above current weight → needs to gain
          phaseChanged = true;
        }
      }
      // ===== GET_SHREDDED Phase 5: goal attained → Phase 4, otherwise restart =====
      if (programType === 'get_shredded' && currentPhase === 5 && currentWeight) {
        if (goal_weight && currentWeight <= goal_weight) {
          newPhase = 4; // Goal attained → maintenance
          phaseChanged = true;
        }
        // Note: no 'else' - Phase 5 stays in Phase 5 until daysInPhase check triggers restart
      }
      // ===== EVENT_READY Phase 2: goal check before transition =====
      else if (programType === 'event_ready' && currentPhase === 2 && currentWeight) {
        // Phase 2 → Phase 4 if goal attained, otherwise stays in Phase 2 (duration check)
        if (goal_weight && currentWeight <= goal_weight) {
          newPhase = 4; // Goal attained → maintenance
          phaseChanged = true;
        }
        // Otherwise stays in Phase 2 until duration check triggers restart to Phase 1
      }
      // ===== Phase 4 check: if weight exceeds threshold, go to Phase 1 =====
      else if (currentPhase === 4 && currentWeight && currentWeight > goal_weight + 4) {
        newPhase = 1;
        phaseChanged = true;
      }
      // ===== GOAL ATTAINED - check if at goal, go to Phase 4 (skip for muscle_gain, handled above; general_health stays in maintenance)
      else if (currentPhase !== 6 && programType !== 'muscle_gain' && programType !== 'general_health' && currentWeight) {
        const atGoal = (currentWeight <= goal_weight);
        if (atGoal) {
          newPhase = 4;
          phaseChanged = true;
        }
      }

      // If phase changed, update it
      if (phaseChanged) {
        if (newPhase === 4) {
          // Transitioning to Phase 4 (maintenance): reset streak
          await db_run(
            `UPDATE clients SET current_phase = ?, phase_start_date = ?, current_week = 4, good_meal_streak = 0, updated_at = ? WHERE id = ?`,
            newPhase, now, now, clientId
          );
        } else {
          await db_run(
            `UPDATE clients SET current_phase = ?, phase_start_date = ?, current_week = 4, updated_at = ? WHERE id = ?`,
            newPhase, now, now, clientId
          );
        }
      }
    }

    // Fetch updated client data to return
    const { data: updatedClient } = await supabase.from('clients').select('*').eq('id', clientId).single();

    return NextResponse.json({
      success: true,
      message: 'Goal updated successfully',
      phaseChanged,
      currentPhase: updatedClient?.current_phase,
      currentWeek: updatedClient?.current_week,
    });
  } catch (error) {
    console.error('Update goal error:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}
