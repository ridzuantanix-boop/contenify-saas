-- Safe application rollback: stop new QR grants while retaining all evidence,
-- order state, wallet ledger rows and audit records for reconciliation.
BEGIN;
UPDATE public.system_settings SET value=COALESCE(value,'{}'::jsonb)||'{"enabled":false,"autoFulfillEnabled":false}'::jsonb,updated_at=now()
WHERE key='qr_checkout_config';
REVOKE ALL ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.verify_qr_order_payment_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.reject_qr_provisional_order_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
