-- Add shop_amount and unit columns to client_grocery_items
ALTER TABLE client_grocery_items ADD COLUMN IF NOT EXISTS shop_amount DECIMAL(10,2);
ALTER TABLE client_grocery_items ADD COLUMN IF NOT EXISTS unit TEXT;

-- Create client_grocery_lists table for Grocery v2
CREATE TABLE IF NOT EXISTS client_grocery_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  notes TEXT DEFAULT '',
  adjusted_totals JSONB DEFAULT '{"protein_lb":0,"veggies_cups":0,"starch_cups":0,"fats_oz":0,"eggs_carton":0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS on client_grocery_lists
ALTER TABLE client_grocery_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients manage own grocery list" ON client_grocery_lists;
CREATE POLICY "Clients manage own grocery list" ON client_grocery_lists
  FOR ALL USING (client_id = auth.uid());
