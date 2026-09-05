-- Smart Grocery List: client_grocery_items table
CREATE TABLE IF NOT EXISTS client_grocery_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('protein', 'veggies', 'starch', 'fats')),
  checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_grocery_items ENABLE ROW LEVEL SECURITY;

-- Policy: clients can only manage their own grocery items (idempotent)
DROP POLICY IF EXISTS "Clients can manage own grocery items" ON client_grocery_items;
CREATE POLICY "Clients can manage own grocery items" ON client_grocery_items
  FOR ALL USING (client_id = auth.uid());

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_grocery_items_client_id ON client_grocery_items(client_id);
CREATE INDEX IF NOT EXISTS idx_grocery_items_category ON client_grocery_items(category);
