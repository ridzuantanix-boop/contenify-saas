-- ============================================================================
-- Supabase Test Harness Stubs
-- For local non-Supabase PostgreSQL and PGlite test environments ONLY.
-- DO NOT APPLY TO PRODUCTION SUPABASE CLUSTERS.
-- ============================================================================

-- 1. Ensure Supabase standard roles exist in test environment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
END $$;

-- 2. Fallback for uuid_generate_v4() when uuid-ossp extension is missing
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid AS $$
    SELECT gen_random_uuid();
$$ LANGUAGE sql;

-- 3. Mock auth.uid() function for non-Supabase test engines executing RLS policies
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
    SELECT '00000000-0000-0000-0000-000000000000'::uuid;
$$ LANGUAGE sql;
