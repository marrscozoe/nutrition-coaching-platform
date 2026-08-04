import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import { initializeCorrectionsCache, addCorrection, getAllCorrections, isCacheLoaded, invalidateCache } from '@/lib/food-corrections-cache';

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
 * PATCH /api/corrections
 * Approve or reject a correction (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, approved } = body;

    if (!id || approved === undefined) {
      return NextResponse.json({ error: 'id and approved are required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const now = new Date().toISOString();

    // Update the correction
    const { data, error } = await supabase
      .from('food_corrections')
      .update({
        approved,
        reviewed_by: trainerId,
        reviewed_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Corrections API] PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update correction' }, { status: 500 });
    }

    // Invalidate and reload the cache so AI gets the updated corrections
    await invalidateCache();

    return NextResponse.json({ success: true, correction: data });
  } catch (e: any) {
    console.error('[Corrections API] PATCH error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
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

    // Add the correction (not auto-approved - trainer must review and approve)
    const correction = await addCorrection(
      foodName,
      correctCategory,
      clientId,
      false, // NOT auto-approved - pending trainer review
    );

    return NextResponse.json({ success: true, correction });
  } catch (e: any) {
    console.error('[Corrections API] POST error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
