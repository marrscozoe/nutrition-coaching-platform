import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, clearChatClearedAt } from '@/lib/db';

// POST /api/clear-user-data - Delete ALL user data from the database
// This clears meals, weight entries, coach messages, and the chat cleared flag
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const errors: string[] = [];

    // Delete from meals table
    try {
      const { error: mealsError } = await supabase
        .from('meals')
        .delete()
        .eq('client_id', clientId);
      if (mealsError) {
        console.error('[clear-user-data] meals delete error:', mealsError);
        errors.push(`meals: ${mealsError.message}`);
      }
    } catch (e) {
      console.error('[clear-user-data] meals delete exception:', e);
      errors.push('meals: delete failed');
    }

    // Delete from weigh_ins table
    try {
      const { error: weighInsError } = await supabase
        .from('weigh_ins')
        .delete()
        .eq('client_id', clientId);
      if (weighInsError) {
        console.error('[clear-user-data] weigh_ins delete error:', weighInsError);
        errors.push(`weigh_ins: ${weighInsError.message}`);
      }
    } catch (e) {
      console.error('[clear-user-data] weigh_ins delete exception:', e);
      errors.push('weigh_ins: delete failed');
    }

    // Delete from coach_messages table
    try {
      const { error: coachError } = await supabase
        .from('coach_messages')
        .delete()
        .eq('client_id', clientId);
      if (coachError) {
        console.error('[clear-user-data] coach_messages delete error:', coachError);
        errors.push(`coach_messages: ${coachError.message}`);
      }
    } catch (e) {
      console.error('[clear-user-data] coach_messages delete exception:', e);
      errors.push('coach_messages: delete failed');
    }

    // Clear the chat_cleared_at flag from kv_store
    try {
      await clearChatClearedAt(clientId);
    } catch (e) {
      console.error('[clear-user-data] clearChatClearedAt error:', e);
      // Non-critical, continue
    }

    if (errors.length > 0) {
      console.error('[clear-user-data] Some deletions failed:', errors);
      return NextResponse.json({ 
        success: false, 
        error: 'Some deletions failed',
        details: errors 
      }, { status: 500 });
    }

    console.log(`[clear-user-data] Successfully cleared all data for client: ${clientId}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[clear-user-data] Error:', error);
    return NextResponse.json({ error: 'Failed to clear user data' }, { status: 500 });
  }
}
