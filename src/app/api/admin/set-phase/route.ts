import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

/**
 * GET /api/admin/set-phase?phase=2&client_id=xxx
 * Test-only endpoint to force a client to a specific phase.
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
