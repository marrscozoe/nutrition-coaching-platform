import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const results: string[] = [];

  const runSql = async (sql: string, label: string) => {
    try {
      const { error } = await supabaseAdmin.rpc('exec', { sql_query: sql });
      if (error) {
        results.push(`${label}: ${error.message}`);
      } else {
        results.push(`${label}: OK`);
      }
    } catch (err: any) {
      results.push(`${label}: ${err?.message || String(err)}`);
    }
  };

  // Step 1: Add shop_amount column
  await runSql(
    'ALTER TABLE client_grocery_items ADD COLUMN IF NOT EXISTS shop_amount DECIMAL(10,2);',
    'shop_amount'
  );

  // Step 2: Add unit column
  await runSql(
    'ALTER TABLE client_grocery_items ADD COLUMN IF NOT EXISTS unit TEXT;',
    'unit'
  );

  // Step 3: Add checked column
  await runSql(
    'ALTER TABLE client_grocery_items ADD COLUMN IF NOT EXISTS checked BOOLEAN DEFAULT false;',
    'checked'
  );

  // Step 4: Create client_grocery_lists table
  await runSql(`
    CREATE TABLE IF NOT EXISTS client_grocery_lists (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
      notes TEXT DEFAULT '',
      adjusted_totals JSONB DEFAULT '{"protein_lb":0,"veggies_cups":0,"starch_cups":0,"fats_oz":0,"eggs_carton":0}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `, 'client_grocery_lists table');

  // Step 5: Create RLS policy
  await runSql(
    'ALTER TABLE client_grocery_lists ENABLE ROW LEVEL SECURITY;',
    'enable_rls'
  );

  await runSql(
    'DROP POLICY IF EXISTS "Clients manage own grocery list" ON client_grocery_lists;',
    'drop_policy'
  );

  await runSql(`
    CREATE POLICY "Clients manage own grocery list" ON client_grocery_lists
      FOR ALL USING (client_id = auth.uid());
  `, 'create_policy');

  return NextResponse.json({ success: true, results });
}
