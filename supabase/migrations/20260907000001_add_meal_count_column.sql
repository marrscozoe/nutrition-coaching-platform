-- Add meal_count column to client_grocery_lists for persisting grocery meal count
ALTER TABLE client_grocery_lists ADD COLUMN IF NOT EXISTS meal_count INTEGER DEFAULT 12;
