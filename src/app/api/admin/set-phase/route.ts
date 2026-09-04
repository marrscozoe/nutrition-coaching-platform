import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

/**
 * GET /api/admin/set-phase?phase=2&client_id=xxx&program_type=event_ready&phase_start_date=2026-08-01&goal_weight=150&current_weight=170
 * Test-only endpoint to force a client to a specific phase with optional phase_start_date, goal_weight, current_weight.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phase = parseInt(searchParams.get('phase') || '1');
    const clientId = searchParams.get('client_id');

    if (!clientId) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const updateObj: Record<string, unknown> = { current_phase: phase };
    const programType = searchParams.get('program_type');
    if (programType) {
      updateObj.program_type = programType;
    }
    const phaseStartDate = searchParams.get('phase_start_date');
    if (phaseStartDate) {
      updateObj.phase_start_date = phaseStartDate;
    }
    const goalWeight = searchParams.get('goal_weight');
    if (goalWeight) {
      updateObj.goal_weight = parseFloat(goalWeight);
    }
    const currentWeight = searchParams.get('current_weight');
    if (currentWeight) {
      updateObj.current_weight = parseFloat(currentWeight);
    }
    const { error } = await supabase
      .from('clients')
      .update(updateObj)
      .eq('id', clientId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, phase, clientId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
