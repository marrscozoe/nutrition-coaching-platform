-- Re-enable RLS on symptoms (was disabled in 20260904000002).
-- App APIs use service_role via getAdminClient(), which bypasses RLS.
ALTER TABLE symptoms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON symptoms FROM anon;
REVOKE ALL ON symptoms FROM authenticated;
GRANT ALL ON symptoms TO service_role;
GRANT ALL ON symptoms TO postgres;
