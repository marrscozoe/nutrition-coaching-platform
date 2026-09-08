import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const clientId = request.headers.get('x-client-id');
  if (!clientId) return NextResponse.json({ error: 'Missing x-client-id' }, { status: 400 });

  const supabase = getAdminClient();

  // Get items
  const { data: items, error: itemsError } = await supabase
    .from('client_grocery_items')
    .select('id, item_name, category, shop_amount, unit, checked')
    .eq('client_id', clientId)
    .order('category');

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  // Get list metadata
  const { data: list, error: listError } = await supabase
    .from('client_grocery_lists')
    .select('notes, adjusted_totals, meal_count')
    .eq('client_id', clientId)
    .single();

  if (listError && listError.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json({
    items: items || [],
    list: {
      notes: list?.notes || '',
      adjustedTotals: list?.adjusted_totals || {},
      mealCount: list?.meal_count ?? 12
    }
  });
}

export async function PATCH(request: NextRequest) {
  const clientId = request.headers.get('x-client-id');
  if (!clientId) return NextResponse.json({ error: 'Missing x-client-id' }, { status: 400 });

  const body = await request.json();
  const supabase = getAdminClient();

  const { notes, adjustedTotals, mealCount } = body;
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
  if (notes !== undefined) updateData.notes = notes;
  if (adjustedTotals !== undefined) updateData.adjusted_totals = adjustedTotals;
  if (mealCount !== undefined) updateData.meal_count = mealCount;

  const { data, error } = await supabase
    .from('client_grocery_lists')
    .upsert({ client_id: clientId, ...updateData }, { onConflict: 'client_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
