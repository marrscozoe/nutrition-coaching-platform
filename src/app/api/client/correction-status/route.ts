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
    const { data: trainer, error: trainerError } = await supabase
      .from('trainers')
      .select('id, email')
      .eq('id', client.trainer_id)
      .single();
    
    // Check if it's Allen (superadmin) - for now, check by known email
    // Allen's trainer account should be amarsbody@gmail.com or similar
    const isAllen = trainer?.email === process.env.ALLEN_TRAINER_EMAIL || 
                    trainer?.email === 'amarsbody@gmail.com' ||
                    trainer?.email === 'allen@amarsbody.com';
    
    // Get the correction_feature_enabled setting
    const { data: setting } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', 'correction_feature_enabled')
      .maybeSingle();
    
    const featureEnabled = setting?.value === 'true';
    const isTester = client.is_tester === true;
    
    // Allen always sees the button, testers see it if feature is enabled
    const canSeeCorrectionButton = isAllen || (isTester && featureEnabled);
    
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
