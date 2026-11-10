BEGIN;
UPDATE system_settings SET value=value||'{"enabled":false,"autoFulfillEnabled":false,"instantFullAccessEnabled":false}'::jsonb,updated_at=now() WHERE key='qr_checkout_config';
REVOKE ALL ON FUNCTION public.create_qr_order_atomic(UUID,UUID,UUID,TEXT,TEXT) FROM service_role;
REVOKE ALL ON FUNCTION public.reactivate_workspace_payment_atomic(UUID,TEXT,TEXT) FROM service_role;
-- Financial, notification and entitlement records are intentionally preserved.
COMMIT;
