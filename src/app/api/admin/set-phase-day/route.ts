import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import { generatePhase5Plan } from '@/lib/ai-coach';
import { getPhase5DayNumber } from '@/lib/nutrition-data';

/**
 * GET /api/admin/set-phase-day?phase5_start_date=YYYY-MM-DD&force_today_type=phase1|phase2|phase4
 * 
 * Test-only endpoint to regenerate a Phase 5 plan with a forced day type for today.
 * Updates the test client's phase5_plan and phase5_start_date.
 * 
 * This is an INTERNAL TEST ENDPOINT - no auth required.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phase5StartDate = searchParams.get('phase5_start_date');
    const forceTodayType = searchParams.get('force_today_type') as 'phase1' | 'phase2' | 'phase4' | null;

    if (!phase5StartDate || !forceTodayType) {
      return NextResponse.json(
        { error: 'phase5_start_date and force_today_type are required' },
        { status: 400 }
      );
    }

    if (!['phase1', 'phase2', 'phase4'].includes(forceTodayType)) {
      return NextResponse.json(
        { error: 'force_today_type must be phase1, phase2, or phase4' },
        { status: 400 }
      );
    }

    // Generate a fresh Phase 5 plan
    let plan = generatePhase5Plan();

    // Find today's day number based on the provided start date
    const dayNum = getPhase5DayNumber(phase5StartDate);

    if (dayNum < 1 || dayNum > 14) {
      return NextResponse.json(
        { error: `Invalid day number ${dayNum} - must be between 1 and 14` },
        { status: 400 }
      );
    }

    // Get label for the forced type
    const typeLabels: Record<'phase1' | 'phase2' | 'phase4', string> = {
      phase1: 'No starch today',
      phase2: 'Starch with breakfast and lunch only',
      phase4: 'Starch with every meal',
    };

    // Force today's day to have the specified type
    plan = plan.map(d =>
      d.day === dayNum
        ? { ...d, type: forceTodayType, label: typeLabels[forceTodayType] }
        : d
    );

    // Update the test client's phase5_plan in the database
    const supabase = getAdminClient();
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        phase5_plan: { type: 'phase5', days: plan },
        phase5_start_date: phase5StartDate,
      })
      .eq('email', 'testclient_delete_test@test.com');

    if (updateError) {
      console.error('[Set Phase Day] Error updating client:', updateError);
      return NextResponse.json(
        { error: `Failed to update client: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`[Set Phase Day] Forced day ${dayNum} to ${forceTodayType} for test client`);

    return NextResponse.json({
      ok: true,
      dayNum,
      forceTodayType,
      label: typeLabels[forceTodayType],
      plan: plan,
    });
  } catch (e) {
    console.error('[Set Phase Day] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
