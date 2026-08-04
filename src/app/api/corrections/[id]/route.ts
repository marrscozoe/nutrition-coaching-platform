import { NextRequest, NextResponse } from 'next/server';
import { deleteCorrection } from '@/lib/food-corrections-cache';

/**
 * DELETE /api/corrections/[id]
 * Delete a correction (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for trainer authentication
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Correction ID required' }, { status: 400 });
    }

    await deleteCorrection(id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Corrections API] DELETE error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
