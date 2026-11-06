-- V2 launch policy. Historical commission rows and existing wallet balances are untouched.
-- Previously active partners require explicit reapproval because the old flow did not
-- record a separate application or acceptance of affiliate terms.
BEGIN;
ALTER TABLE public.affiliate_partners DROP CONSTRAINT IF EXISTS affiliate_partners_status_check;
UPDATE public.affiliate_partners SET status = 'SUSPENDED' WHERE status = 'active';
UPDATE public.affiliate_partners SET status = 'SUSPENDED' WHERE status = 'suspended';
ALTER TABLE public.affiliate_partners
  ADD CONSTRAINT affiliate_partners_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'));
ALTER TABLE public.affiliate_partners ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE public.affiliate_partners ALTER COLUMN commission_rate SET DEFAULT 10.00;
ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE public.affiliate_commissions ALTER COLUMN rate_percentage SET DEFAULT 10.00;

-- Keep the existing atomic order settlement body intact while replacing only its
-- obsolete affiliate clause. Assert the known migration-00006 text before rewriting.
DO $policy$
DECLARE
  old_definition TEXT;
  new_definition TEXT;
  old_clause TEXT := 'WHERE referral_code = v_order.referral_code AND status = ''active'';';
  new_clause TEXT := $clause$WHERE referral_code = v_order.referral_code AND status = 'APPROVED'
          AND user_id <> v_order.user_id
          AND NOT EXISTS (
              SELECT 1 FROM orders prior_order
              WHERE prior_order.workspace_id = v_order.workspace_id
                AND prior_order.status = 'PAID'
                AND prior_order.id <> v_order.id
          );$clause$;
BEGIN
  SELECT pg_get_functiondef('public.settle_order_payment_atomic(uuid,character varying,jsonb)'::regprocedure)
    INTO old_definition;
  IF position(old_clause IN old_definition) = 0 THEN
    RAISE EXCEPTION 'Affiliate settlement body differs from reviewed version; manual migration review required';
  END IF;
  new_definition := replace(old_definition, old_clause, new_clause);
  IF position('v_affiliate.commission_rate / 100.0' IN new_definition) = 0 THEN
    RAISE EXCEPTION 'Affiliate percentage calculation differs from reviewed version';
  END IF;
  new_definition := replace(new_definition, 'v_affiliate.commission_rate / 100.0', '0.10');
  new_definition := replace(new_definition, 'v_affiliate.commission_rate,', '10.00,');
  EXECUTE new_definition;
END;
$policy$;

-- No new commissions on free signups or unapproved affiliates. Existing earned
-- commission records retain their historical rate and amount.
COMMIT;
