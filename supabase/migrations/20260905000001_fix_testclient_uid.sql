-- Fix testclient UID mismatch:
-- Supabase Auth UID: 2b485033-0f55-4982-9160-869da27ff793
-- clients.id:     20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef
-- All child tables must be updated BEFORE clients.id is changed, then FKs recreated

-- Step 1: Update all child tables to use the new UID BEFORE changing clients.id
UPDATE meals SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE feedback SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE milestones SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE food_corrections SET submitted_by = '2b485033-0f55-4982-9160-869da27ff793' WHERE submitted_by = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE coach_messages SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';
UPDATE weigh_ins SET client_id = '2b485033-0f55-4982-9160-869da27ff793' WHERE client_id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';

-- Step 2: Update clients.id to match Supabase Auth UID
UPDATE clients SET id = '2b485033-0f55-4982-9160-869da27ff793' WHERE id = '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef';

-- Step 3: Verify
SELECT id, email, allergy_discovery_enabled FROM clients WHERE email LIKE '%testclient%' OR email LIKE '%delete%';
