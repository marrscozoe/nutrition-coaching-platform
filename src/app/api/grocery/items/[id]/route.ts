import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientId = request.headers.get('x-client-id');
  if (!clientId) return NextResponse.json({ error: 'Missing x-client-id' }, { status: 400 });

  const body = await request.json();
  const supabase = getAdminClient();

  const allowed = ['shop_amount', 'unit', 'checked'];
  const updateData: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) updateData[key] = body[key];
  }

  const { data, error } = await supabase
    .from('client_grocery_items')
    .update(updateData)
    .eq('id', id)
    .eq('client_id', clientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientId = request.headers.get('x-client-id');
  if (!clientId) return NextResponse.json({ error: 'Missing x-client-id' }, { status: 400 });

  const supabase = getAdminClient();

  const { error } = await supabase
    .from('client_grocery_items')
    .delete()
    .eq('id', id)
    .eq('client_id', clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
