import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

/**
 * GET /api/client/correction-status
 * Returns whether the correction feature is enabled for this client
 * Requires client authentication (x-client-id header)
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();
    
    // Get client's is_tester status
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, is_tester, trainer_id')
      .eq('id', clientId)
      .single();
    
    if (error || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    
    // Get the trainer to check if it's Allen
    // Handle case when trainer_id is null (e.g., for testing/dev clients)
    let trainer = null;
    let trainerError = null;
    if (client.trainer_id) {
      const result = await supabase
        .from('trainers')
        .select('id, email')
        .eq('id', client.trainer_id)
        .maybeSingle();
      trainer = result.data;
      trainerError = result.error;
    }
    
    // Check if it's Allen (superadmin) - for now, check by known email
    // Allen's trainer account should be amarsbody@gmail.com or similar
    // If trainer_id is null, default to showing correction button for testing
    const isAllen = trainer?.email === process.env.ALLEN_TRAINER_EMAIL || 
                    trainer?.email === 'amarsbody@gmail.com' ||
                    trainer?.email === 'allen@amarsbody.com';
    
    // If no trainer assigned (null trainer_id), show the button for testing
    const hasNoTrainer = !client.trainer_id || !trainer;
    
    // Get the correction_feature_enabled setting
    const { data: setting } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', 'correction_feature_enabled')
      .maybeSingle();
    
    const featureEnabled = setting?.value === 'true';
    const isTester = client.is_tester === true;
    
    // Allen always sees the button, testers see it if feature is enabled
    // Also show button if client has no trainer assigned (for development/testing)
    const canSeeCorrectionButton = isAllen || hasNoTrainer || (isTester && featureEnabled);
    
    return NextResponse.json({
      isTester,
      isAllen,
      featureEnabled,
      canSeeCorrectionButton,
    });
  } catch (e) {
    console.error('[Correction Status API] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
