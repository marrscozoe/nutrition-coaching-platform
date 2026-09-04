-- Disable RLS on symptoms table (app uses service role key for all operations)
ALTER TABLE symptoms DISABLE ROW LEVEL SECURITY;
GRANT ALL ON symptoms TO service_role;
GRANT ALL ON symptoms TO anon;
GRANT ALL ON symptoms TO authenticated;
GRANT ALL ON symptoms TO postgres;
