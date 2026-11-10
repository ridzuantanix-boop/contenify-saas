BEGIN;
REVOKE ALL ON FUNCTION public.settle_verified_order_v72_atomic(UUID,TEXT,TEXT) FROM service_role;
REVOKE ALL ON FUNCTION public.allocate_job_credit_buckets_atomic(UUID,UUID,INT) FROM service_role;
REVOKE ALL ON FUNCTION public.expire_credit_buckets_atomic(UUID) FROM service_role;
-- Buckets and ledger entries are financial audit records and are never deleted by rollback.
COMMIT;
