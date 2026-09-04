-- Fix testclient UID mismatch:
-- Supabase Auth UID: 2b485033-0f55-4982-9160-869da27ff793
-- clients table:   20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef
-- Weigh_ins FK references clients(id) so cascade update is needed

-- Drop FK (will recreate with ON UPDATE CASCADE)
ALTER TABLE weigh_ins DROP CONSTRAINT IF EXISTS weigh_ins_client_id_fkey;

-- Update clients id to match Supabase Auth
UPDATE clients
SET id = '2b485033-0f55-4982-9160-869da27ff793'
WHERE id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';

-- Recreate FK with ON UPDATE CASCADE so future UID changes propagate
ALTER TABLE weigh_ins
ADD CONSTRAINT weigh_ins_client_id_fkey
FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;

-- Verify
SELECT id, email, allergy_discovery_enabled FROM clients WHERE email LIKE '%testclient%' OR email LIKE '%delete%';
