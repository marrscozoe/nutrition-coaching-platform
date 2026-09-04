-- Fix testclient UID mismatch:
-- Supabase Auth UID: 2b485033-0f55-4982-9160-869da27ff793
-- clients.id:     20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef
-- Both weigh_ins AND milestones reference clients(id) - must drop all FKs first

-- Step 1: Drop ALL FKs referencing clients(id)
ALTER TABLE weigh_ins DROP CONSTRAINT IF EXISTS weigh_ins_client_id_fkey;
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_client_id_fkey;

-- Step 2: Update clients.id to match Supabase Auth UID
UPDATE clients
SET id = '2b485033-0f55-4982-9160-869da27ff793'
WHERE id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';

-- Step 3: Recreate FKs with ON UPDATE CASCADE
ALTER TABLE weigh_ins
ADD CONSTRAINT weigh_ins_client_id_fkey
FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;

ALTER TABLE milestones
ADD CONSTRAINT milestones_client_id_fkey
FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;

-- Step 4: Verify
SELECT id, email, allergy_discovery_enabled
FROM clients
WHERE email LIKE '%testclient%' OR email LIKE '%delete%';
