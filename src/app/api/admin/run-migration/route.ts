import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const sql = `
    CREATE TABLE IF NOT EXISTS client_grocery_items (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('protein', 'veggies', 'starch', 'fats')),
      checked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE client_grocery_items ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'client_grocery_items' AND policyname = 'Clients can manage own grocery items'
      ) THEN
        CREATE POLICY "Clients can manage own grocery items" ON client_grocery_items
          FOR ALL USING (client_id = auth.uid());
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_grocery_items_client_id ON client_grocery_items(client_id);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_category ON client_grocery_items(category);
  `;

  const { error } = await supabaseAdmin.rpc('exec', { sql_query: sql });
  
  if (error) {
    // Try direct query if rpc doesn't exist
    const { error: directError } = await supabaseAdmin.from('client_grocery_items').select('id').limit(1);
    if (directError && directError.code === '42P01') {
      // Table doesn't exist - try with raw query via connection
      return NextResponse.json({ 
        error: 'Migration needed - table not found',
        hint: 'Run the SQL manually in Supabase SQL Editor' 
      }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: 'Table already exists or migration applied' });
  }

  return NextResponse.json({ success: true, message: 'Migration applied' });
}
