import { NextRequest, NextResponse } from 'next/server';
import { getDb, db_get, db_all, db_run } from '@/lib/db';
import { generatePhase5Plan } from '@/lib/ai-coach';

// GET - Fetch a single client's details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trainerId = request.headers.get('x-trainer-id');
    
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    const db = await getDb();
    
    // Get client by ID
    const clientStmt = db.prepare(`SELECT * FROM clients WHERE id = ?`);
    const client = await db_get(clientStmt, id);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get recent meal logs
    const mealLogsStmt = db.prepare(`
      SELECT * FROM meals 
      WHERE client_id = ? 
      ORDER BY logged_at DESC 
      LIMIT 20
    `);
    const mealLogs = await db_all(mealLogsStmt, id);

    // Get recent weigh-ins
    const weighInsStmt = db.prepare(`
      SELECT * FROM weigh_ins 
      WHERE client_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    const weighIns = await db_all(weighInsStmt, id);

    // Get milestones (if table exists)
    let milestones: any[] = [];
    try {
      const milestonesStmt = db.prepare(`
        SELECT * FROM milestones 
        WHERE client_id = ? 
        ORDER BY achieved_at DESC
      `);
      milestones = await db_all(milestonesStmt, id);
    } catch (e) {
      // milestones table may not exist - that's OK
      console.warn('Milestones table not found:', e);
    }

    return NextResponse.json({
      client,
      mealLogs,
      weighIns,
      milestones,
    });
  } catch (error) {
    console.error('Get client detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

// PUT - Update client (phase, notes, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trainerId = request.headers.get('x-trainer-id');
    
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    const db = await getDb();
    
    // Verify client exists
    const verifyStmt = db.prepare(`SELECT * FROM clients WHERE id = ?`);
    const client = await db_get(verifyStmt, id);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const { notes, current_phase, current_week, subscription_status } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    if (current_phase !== undefined) {
      updates.push('current_phase = ?');
      values.push(current_phase);
      // Reset phase_start_date when phase changes manually
      updates.push('phase_start_date = ?');
      values.push(new Date().toISOString());
      // If changing to Phase 5, generate a new 3-day plan
      // Use explicit number comparison to avoid string/number issues
      if (Number(current_phase) === 5) {
        console.log('[PUT] Phase 5 detected - generating plan...');
        try {
          const phase5Plan = generatePhase5Plan();
          console.log('[PUT] Phase 5 plan generated:', JSON.stringify(phase5Plan));
          const planJson = JSON.stringify(phase5Plan);
          const startDate = new Date().toISOString().split('T')[0];
          console.log('[PUT] Phase 5 plan stringified, length:', planJson.length, 'startDate:', startDate);
          updates.push('phase5_plan = ?');
          values.push(planJson);
          updates.push('phase5_start_date = ?');
          values.push(startDate);
          console.log('[PUT] Phase 5 fields added to update');
        } catch (planErr) {
          console.error('[PUT] Phase 5 plan generation failed:', planErr);
          // Continue with update even if plan generation fails - phase will still be saved
        }
      }
    }
    if (current_week !== undefined) {
      updates.push('current_week = ?');
      values.push(current_week);
    }
    if (subscription_status !== undefined) {
      updates.push('subscription_status = ?');
      values.push(subscription_status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const updateStmt = db.prepare(`
      UPDATE clients SET ${updates.join(', ')} WHERE id = ?
    `);
    
    console.log('[PUT /trainer/clients/:id] Updating client:', id);
    console.log('[PUT] Updates:', updates.join(', '));
    console.log('[PUT] Values count:', values.length, '- values:', JSON.stringify(values));
    
    const result = await db_run(updateStmt, ...values);
    console.log('[PUT] db_run result:', JSON.stringify(result));
    
    if (!result.success) {
      console.error('[PUT] Update failed:', result.error);
      return NextResponse.json({ error: result.error || 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}
