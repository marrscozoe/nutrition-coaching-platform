-- Add custom_allergy_bans column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_allergy_bans text[] DEFAULT '{}';
ALTER TABLE clients ALTER COLUMN custom_allergy_bans SET DEFAULT '{}';
-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_custom_allergy_bans ON clients USING GIN (custom_allergy_bans);
