import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import { initializeCorrectionsCache, addCorrection, getAllCorrections, isCacheLoaded } from '@/lib/food-corrections-cache';

/**
 * GET /api/corrections
 * Returns all corrections (for admin review)
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
      .from('food_corrections')
      .select('*')
      .order('submitted_at', { ascending: false });
    
    if (error) {
      console.error('[Corrections API] Error fetching corrections:', error);
      return NextResponse.json({ error: 'Failed to fetch corrections' }, { status: 500 });
    }
    
    return NextResponse.json({ corrections: data || [] });
  } catch (e) {
    console.error('[Corrections API] GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/corrections
 * Submit a new food correction
 * This is called by the client when they spot an AI misclassification
 */
export async function POST(request: NextRequest) {
  try {
    // Get client ID from header (set by client app)
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { foodName, correctCategory } = body;

    if (!foodName || !correctCategory) {
      return NextResponse.json({ error: 'foodName and correctCategory are required' }, { status: 400 });
    }

    // Validate category
    const validCategories = ['protein', 'vegetable', 'fat', 'starch', 'dairy', 'sugar', 'other'];
    if (!validCategories.includes(correctCategory)) {
      return NextResponse.json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    // Initialize cache if not already loaded
    if (!isCacheLoaded()) {
      await initializeCorrectionsCache();
    }

    // Add the correction
    const correction = await addCorrection(
      foodName,
      correctCategory,
      clientId,
      true, // auto-approve for now (testers are trusted)
    );

    return NextResponse.json({ success: true, correction });
  } catch (e: any) {
    console.error('[Corrections API] POST error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
