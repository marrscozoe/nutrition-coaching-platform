import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// DELETE /api/trainer/delete-account - Trainer deletes their own account
// Also deletes all clients and their data belonging to this trainer
export async function DELETE(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();
    
    // Verify trainer exists
    const { data: trainer, error: trainerError } = await supabase
      .from('trainers')
      .select('id, email')
      .eq('id', trainerId)
      .single();

    if (trainerError || !trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    console.log(`[DELETE /api/trainer/delete-account] Deleting trainer ${trainerId} (${trainer.email})`);

    // First, get all clients belonging to this trainer
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('trainer_id', trainerId);

    if (clientsError) {
      console.error('[DELETE] Error fetching trainer clients:', clientsError);
    }

    const clientIds = clients?.map(c => c.id) || [];
    console.log(`[DELETE] Found ${clientIds.length} clients belonging to trainer ${trainerId}`);

    // Delete all data for each client
    const tablesToDeleteFrom = ['coach_messages', 'feedback', 'milestones', 'weigh_ins', 'meals'];
    
    for (const clientId of clientIds) {
      for (const table of tablesToDeleteFrom) {
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('client_id', clientId);
        
        if (deleteError) {
          console.error(`[DELETE] Error deleting from ${table} for client ${clientId}:`, deleteError);
        } else {
          console.log(`[DELETE] Deleted from ${table} for client ${clientId}`);
        }
      }
    }

    // Delete all clients belonging to this trainer
    if (clientIds.length > 0) {
      const { error: deleteClientsError } = await supabase
        .from('clients')
        .delete()
        .eq('trainer_id', trainerId);
      
      if (deleteClientsError) {
        console.error('[DELETE] Error deleting clients:', deleteClientsError);
      } else {
        console.log(`[DELETE] Deleted ${clientIds.length} clients`);
      }

      // Also delete auth users for clients (if possible)
      for (const clientId of clientIds) {
        try {
          const { error: authError } = await supabase.auth.admin.deleteUser(clientId);
          if (authError) {
            console.warn(`[DELETE] Could not delete auth user ${clientId}: ${authError.message}`);
          } else {
            console.log(`[DELETE] Deleted auth user ${clientId}`);
          }
        } catch (e) {
          console.warn(`[DELETE] Auth user deletion skipped for ${clientId}`);
        }
      }
    }

    // Delete the trainer from trainers table
    const { error: deleteTrainerError } = await supabase
      .from('trainers')
      .delete()
      .eq('id', trainerId);
    
    if (deleteTrainerError) {
      console.error('[DELETE] Error deleting trainer:', deleteTrainerError);
      return NextResponse.json({ error: 'Failed to delete trainer account' }, { status: 500 });
    }

    // Also delete from auth.users if possible
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(trainerId);
      if (authError) {
        console.warn(`[DELETE] Could not delete trainer auth user: ${authError.message}`);
      } else {
        console.log(`[DELETE] Deleted trainer auth user ${trainerId}`);
      }
    } catch (e) {
      console.warn(`[DELETE] Trainer auth user deletion skipped (not available)`);
    }

    console.log(`[DELETE /api/trainer/delete-account] Successfully deleted trainer ${trainerId} and ${clientIds.length} clients`);
    return NextResponse.json({ success: true, deletedTrainerId: trainerId, deletedClientsCount: clientIds.length });
  } catch (error) {
    console.error('Delete trainer account error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
