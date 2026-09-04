import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// GET /api/grocery - Get current grocery list for logged-in client
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('client_grocery_items')
      .select('*')
      .eq('client_id', clientId)
      .order('category', { ascending: true })
      .order('item_name', { ascending: true });

    if (error) {
      console.error('Get grocery items error:', error);
      return NextResponse.json({ error: 'Failed to fetch grocery list' }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Get grocery error:', error);
    return NextResponse.json({ error: 'Failed to fetch grocery list' }, { status: 500 });
  }
}

// DELETE /api/grocery - Clear all grocery items for logged-in client
export async function DELETE(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('client_grocery_items')
      .delete()
      .eq('client_id', clientId);

    if (error) {
      console.error('Delete grocery items error:', error);
      return NextResponse.json({ error: 'Failed to clear grocery list' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Grocery list cleared' });
  } catch (error) {
    console.error('Delete grocery error:', error);
    return NextResponse.json({ error: 'Failed to clear grocery list' }, { status: 500 });
  }
}
