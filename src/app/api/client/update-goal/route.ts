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

      // Phase 4 check: if weight exceeds threshold, go to Phase 1
      // (GET_SHREDDED, EVENT_READY, GENERAL_HEALTH: over goal + 4 lbs = Phase 1)
      if (currentPhase === 4 && currentWeight && currentWeight > goal_weight + 4) {
        newPhase = 1;
        phaseChanged = true;
      }
      // GOAL ATTAINED - check if at goal, go to Phase 4
      // (except for Phase 6 which has special logic)
      else if (currentPhase !== 6 && currentWeight) {
        const atGoal = (programType === 'muscle_gain')
          ? (currentWeight >= goal_weight)
          : (currentWeight <= goal_weight);
        if (atGoal) {
          newPhase = 4;
          phaseChanged = true;
        }
      }

      // If phase changed, update it
      if (phaseChanged) {
        await db_run(
          `UPDATE clients SET current_phase = ?, phase_start_date = ?, current_week = 4, updated_at = ? WHERE id = ?`,
          newPhase, now, now, clientId
        );
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
