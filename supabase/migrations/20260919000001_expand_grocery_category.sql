-- Expand client_grocery_items category check to include 'eggs' and 'other'
-- Drop existing check constraint and recreate with all valid categories

ALTER TABLE client_grocery_items DROP CONSTRAINT IF EXISTS client_grocery_items_category_check;

ALTER TABLE client_grocery_items ADD CONSTRAINT client_grocery_items_category_check
  CHECK (category IN ('protein', 'veggies', 'starch', 'fats', 'eggs', 'other'));
