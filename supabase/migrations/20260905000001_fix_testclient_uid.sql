-- Fix testclient UID mismatch:
-- Supabase Auth UID: 2b485033-0f55-4982-9160-869da27ff793
-- clients.id:     20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef
-- FKs are NOT DEFERRABLE so must drop all, update children, update parent, recreate

-- Step 1: Drop ALL FKs referencing clients(id)
ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_client_id_fkey;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_client_id_fkey;
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_client_id_fkey;
ALTER TABLE food_corrections DROP CONSTRAINT IF EXISTS food_corrections_submitted_by_fkey;
ALTER TABLE coach_messages DROP CONSTRAINT IF EXISTS coach_messages_client_id_fkey;
ALTER TABLE weigh_ins DROP CONSTRAINT IF EXISTS weigh_ins_client_id_fkey;

-- Step 2: Update ALL child tables to new UID
UPDATE meals SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE feedback SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE milestones SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE food_corrections SET submitted_by = '2b485033-0f55-4982-9160-869da27ff793' WHERE submitted_by = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE coach_messages SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE weigh_ins SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';

-- Step 3: Update clients.id to match Supabase Auth UID
UPDATE clients SET id = '2b485033-0f55-4982-9160-869da27ff793' WHERE id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';

-- Step 4: Recreate ALL FKs with ON UPDATE CASCADE
ALTER TABLE meals ADD CONSTRAINT meals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;
ALTER TABLE feedback ADD CONSTRAINT feedback_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;
ALTER TABLE milestones ADD CONSTRAINT milestones_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;
ALTER TABLE food_corrections ADD CONSTRAINT food_corrections_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES clients(id) ON UPDATE CASCADE;
ALTER TABLE coach_messages ADD CONSTRAINT coach_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;
ALTER TABLE weigh_ins ADD CONSTRAINT weigh_ins_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;

-- Step 5: Verify
SELECT id, email, allergy_discovery_enabled FROM clients WHERE email LIKE '%testclient%' OR email LIKE '%delete%';
