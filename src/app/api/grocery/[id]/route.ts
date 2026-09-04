import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/grocery/[id] - Toggle checked status of a grocery item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { checked } = body;

    if (typeof checked !== 'boolean') {
      return NextResponse.json({ error: 'checked (boolean) is required' }, { status: 400 });
    }

    const { getAdminClient } = await import('@/lib/db');
    const supabase = getAdminClient();

    // Update the item (only if it belongs to this client - RLS will also enforce this)
    const { data, error } = await supabase
      .from('client_grocery_items')
      .update({ checked })
      .eq('id', id)
      .eq('client_id', clientId)
      .select()
      .single();

    if (error) {
      console.error('Update grocery item error:', error);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Update grocery item error:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}
