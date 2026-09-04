-- Migration: Add allergy_discovery_enabled to clients table
-- Run this in Supabase SQL Editor or via migration
-- Default FALSE so existing clients are not nagged

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS allergy_discovery_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Verify
SELECT id, name, allergy_discovery_enabled FROM clients LIMIT 5;
