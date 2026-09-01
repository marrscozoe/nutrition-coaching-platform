import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// DELETE /api/client/delete-account - Client deletes their own account
export async function DELETE(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();
    
    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    console.log(`[DELETE /api/client/delete-account] Deleting client ${clientId} (${client.email})`);

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

    // Also delete from auth.users if possible
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

    console.log(`[DELETE /api/client/delete-account] Successfully deleted client ${clientId}`);
    return NextResponse.json({ success: true, deletedClientId: clientId });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
