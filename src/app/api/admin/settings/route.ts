import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

/**
 * GET /api/admin/settings
 * Get all settings (for now, just correction_feature_enabled)
 * Requires trainer authentication
 */
export async function GET(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    
    // Try to get from kv_store first
    const { data: kvData, error: kvError } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', 'correction_feature_enabled')
      .maybeSingle();
    
    if (kvError) {
      console.error('[Admin Settings API] Error fetching setting:', kvError);
      // Fallback: return default value
      return NextResponse.json({ settings: { correction_feature_enabled: false } });
    }
    
    const enabled = kvData?.value === 'true';
    
    return NextResponse.json({ 
      settings: { 
        correction_feature_enabled: enabled 
      } 
    });
  } catch (e) {
    console.error('[Admin Settings API] GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/settings
 * Update settings
 * Body: { settings: { correction_feature_enabled: boolean } }
 */
export async function POST(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    
    // Update correction_feature_enabled in kv_store
    if (typeof settings.correction_feature_enabled === 'boolean') {
      const { error } = await supabase
        .from('kv_store')
        .upsert({ 
          key: 'correction_feature_enabled', 
          value: settings.correction_feature_enabled ? 'true' : 'false' 
        }, { onConflict: 'key' });
      
      if (error) {
        console.error('[Admin Settings API] Error saving setting:', error);
        return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Admin Settings API] POST error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
