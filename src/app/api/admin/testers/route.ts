import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

/**
 * GET /api/admin/testers
 * Get list of all clients with their tester status
 * Requires trainer authentication
 */
export async function GET(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, email, is_tester, created_at')
      .eq('trainer_id', trainerId)
      .order('name');
    
    if (error) {
      console.error('[Admin Testers API] Error fetching testers:', error);
      return NextResponse.json({ error: 'Failed to fetch testers' }, { status: 500 });
    }
    
    return NextResponse.json({ clients: data || [] });
  } catch (e) {
    console.error('[Admin Testers API] GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/testers
 * Toggle tester status for a client
 * Body: { clientId: string, isTester: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, isTester } = body;

    if (!clientId || typeof isTester !== 'boolean') {
      return NextResponse.json({ error: 'clientId and isTester (boolean) are required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    
    // Update the client's tester status
    const { error } = await supabase
      .from('clients')
      .update({ is_tester: isTester })
      .eq('id', clientId)
      .eq('trainer_id', trainerId); // Ensure client belongs to this trainer
    
    if (error) {
      console.error('[Admin Testers API] Error updating tester status:', error);
      return NextResponse.json({ error: 'Failed to update tester status' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Admin Testers API] POST error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
