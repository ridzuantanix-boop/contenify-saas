-- Affiliate applications are written only by the authenticated server route.
-- Supabase's service_role bypasses RLS but still requires table privileges.
BEGIN;

GRANT SELECT, INSERT, UPDATE ON TABLE public.affiliate_partners TO service_role;
GRANT SELECT ON TABLE public.affiliate_commissions TO service_role;

COMMIT;
