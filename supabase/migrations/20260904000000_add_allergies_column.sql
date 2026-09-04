-- Add allergies column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}';
ALTER TABLE clients ALTER COLUMN allergies SET DEFAULT '{}';
-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_allergies ON clients USING GIN (allergies);
