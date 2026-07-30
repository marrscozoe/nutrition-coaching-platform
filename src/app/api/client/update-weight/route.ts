import { NextRequest, NextResponse } from 'next/server';
import { db_run } from '@/lib/db';

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

    return NextResponse.json({
      success: true,
      message: 'Weight updated successfully',
    });
  } catch (error) {
    console.error('Update weight error:', error);
    return NextResponse.json({ error: 'Failed to update weight' }, { status: 500 });
  }
}
