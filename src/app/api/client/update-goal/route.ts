import { NextRequest, NextResponse } from 'next/server';
import { db_run } from '@/lib/db';

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

    // Update goal_weight AND reset goal_start_date to now
    // This makes week counter reset to 1 for the new goal
    await db_run(
      `UPDATE clients SET goal_weight = ?, goal_start_date = ?, updated_at = ? WHERE id = ?`,
      goal_weight, now, now, clientId
    );

    return NextResponse.json({
      success: true,
      message: 'Goal updated successfully',
    });
  } catch (error) {
    console.error('Update goal error:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}
