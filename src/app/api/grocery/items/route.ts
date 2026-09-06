import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const clientId = request.headers.get('x-client-id');
  if (!clientId) return NextResponse.json({ error: 'Missing x-client-id' }, { status: 400 });

  const body = await request.json();
  const { item_name, category, shop_amount, unit } = body;

  if (!item_name || !category) {
    return NextResponse.json({ error: 'item_name and category required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('client_grocery_items')
    .insert({
      client_id: clientId,
      item_name,
      category,
      shop_amount: shop_amount ?? null,
      unit: unit ?? null,
      checked: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
