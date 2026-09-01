import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
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

    // Use admin client to bypass RLS
    const supabase = getAdminClient();
    
    // Get client by ID
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get recent meal logs
    const { data: mealLogs } = await supabase
      .from('meals')
      .select('*')
      .eq('client_id', id)
      .order('logged_at', { ascending: false })
      .limit(20);

    // Get recent weigh-ins
    const { data: weighIns } = await supabase
      .from('weigh_ins')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get milestones
    let milestones: any[] = [];
    try {
      const { data } = await supabase
        .from('milestones')
        .select('*')
        .eq('client_id', id)
        .order('achieved_at', { ascending: false });
      milestones = data || [];
    } catch (e) {
      console.warn('Milestones fetch error:', e);
    }

    return NextResponse.json({
      client,
      mealLogs: mealLogs || [],
      weighIns: weighIns || [],
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

    // Use admin client to bypass RLS
    let supabase;
    try {
      supabase = getAdminClient();
    } catch (e) {
      console.error('[PUT] Failed to initialize admin client:', e);
      return NextResponse.json({ error: 'Server configuration error - please contact support' }, { status: 500 });
    }
    
    // Verify client exists
    const { data: client, error: verifyError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

    if (verifyError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const { notes, current_phase, current_week, subscription_status } = body;

    // Build update object
    const updateObj: Record<string, any> = {};

    if (notes !== undefined) {
      updateObj.notes = notes;
    }
    if (current_phase !== undefined) {
      updateObj.current_phase = current_phase;
      updateObj.phase_start_date = new Date().toISOString();
      // If changing to Phase 5, generate a new 3-day plan
      if (Number(current_phase) === 5) {
        console.log('[PUT] Phase 5 detected - generating plan...');
        try {
          const phase5Plan = generatePhase5Plan();
          const planJson = JSON.stringify(phase5Plan);
          const startDate = new Date().toISOString().split('T')[0];
          updateObj.phase5_plan = planJson;
          updateObj.phase5_start_date = startDate;
          console.log('[PUT] Phase 5 fields added to update');
        } catch (planErr) {
          console.error('[PUT] Phase 5 plan generation failed:', planErr);
        }
      }
    }
    if (current_week !== undefined) {
      updateObj.current_week = current_week;
    }
    if (subscription_status !== undefined) {
      updateObj.subscription_status = subscription_status;
    }

    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updateObj.updated_at = new Date().toISOString();
    
    console.log('[PUT /trainer/clients/:id] Updating client:', id, 'with:', updateObj);
    
    const { error: updateError } = await supabase
      .from('clients')
      .update(updateObj)
      .eq('id', id);
    
    if (updateError) {
      console.error('[PUT] Update failed:', updateError);
      return NextResponse.json({ error: updateError.message || 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

// DELETE - Delete a client and all their data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trainerId = request.headers.get('x-trainer-id');
    
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();
    
    // Verify client exists AND belongs to this trainer
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, trainer_id')
      .eq('id', id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // SECURITY: Verify this client belongs to the requesting trainer
    if (client.trainer_id !== trainerId) {
      console.error(`[DELETE /trainer/clients/:id] Unauthorized: trainer ${trainerId} tried to delete client ${id} owned by ${client.trainer_id}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const clientId = id;
    console.log(`[DELETE /trainer/clients/:id] Deleting client ${clientId} (${client.email})`);

    // Delete in order: coach_messages -> feedback -> milestones -> weigh_ins -> meals -> clients
    // Note: 'clients' table uses 'id' not 'client_id' as primary key
    const tablesWithClientId = ['coach_messages', 'feedback', 'milestones', 'weigh_ins', 'meals'];
    
    for (const table of tablesWithClientId) {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('client_id', clientId);
      
      if (deleteError) {
        console.error(`[DELETE] Error deleting from ${table}:`, deleteError);
      } else {
        console.log(`[DELETE] Deleted from ${table}`);
      }
    }
    
    // Delete from clients table using 'id' (not 'client_id')
    const { error: deleteClientError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (deleteClientError) {
      console.error(`[DELETE] Error deleting client:`, deleteClientError);
    } else {
      console.log(`[DELETE] Deleted client ${clientId} from clients table`);
    }

    // Also delete from auth.users if possible (email match)
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(clientId);
      if (authError) {
        console.warn(`[DELETE] Could not delete auth user: ${authError.message}`);
      } else {
        console.log(`[DELETE] Deleted auth user ${clientId}`);
      }
    } catch (e) {
      console.warn(`[DELETE] Auth user deletion skipped (not available)`);
    }

    console.log(`[DELETE /trainer/clients/:id] Successfully deleted client ${clientId}`);
    return NextResponse.json({ success: true, deletedClientId: clientId });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
