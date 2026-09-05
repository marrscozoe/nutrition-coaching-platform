-- Add photo_meal_log_enabled column to clients table
-- Default FALSE means existing clients will NOT see photo UI until they opt in
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_meal_log_enabled BOOLEAN NOT NULL DEFAULT FALSE;
