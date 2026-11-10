-- AffiMatik V8.4 QR Express Checkout.
-- Additive: existing orders, subscriptions, wallets, commissions and media stay intact.
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_state TEXT NOT NULL DEFAULT 'PAYMENT_UNVERIFIED';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_object_key TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_sha256 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_mime_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_size_bytes BIGINT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS evidence_submitted_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provisional_granted_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bank_verified_at TIMESTAMPTZ;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_state_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_state_check CHECK (payment_state IN (
  'PAYMENT_EVIDENCE_SUBMITTED','PAYMENT_UNVERIFIED','CREDITS_PROVISIONALLY_GRANTED','BANK_PAYMENT_VERIFIED'
));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_receipt_size_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_receipt_size_check CHECK (receipt_size_bytes IS NULL OR (receipt_size_bytes > 0 AND receipt_size_bytes <= 5242880));
CREATE UNIQUE INDEX IF NOT EXISTS orders_receipt_sha256_once ON public.orders(receipt_sha256) WHERE receipt_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_payment_state_date ON public.orders(payment_state, created_at DESC);

-- Preserve the meaning of historical settled orders. The new state machine is
-- only "unverified" by default for new/manual QR orders, not past paid sales.
UPDATE public.orders
SET payment_state='BANK_PAYMENT_VERIFIED',
    bank_verified_at=COALESCE(paid_at,created_at)
WHERE status='PAID'
  AND payment_state='PAYMENT_UNVERIFIED';

INSERT INTO public.system_settings(key,value,updated_at) VALUES (
  'qr_checkout_config',
  '{"enabled":false,"autoFulfillEnabled":false,"merchantName":"","bankName":"","recipientInfo":"","instructions":"Imbas QR menggunakan aplikasi bank anda. Pastikan jumlah dan rujukan pesanan tepat sebelum menghantar bukti bayaran.","qrObjectKey":"","qrSha256":"","recipientConfirmed":false,"provisionalExposureCapMyr":300,"maxAutoOrderMyr":129}'::jsonb,
  now()
) ON CONFLICT(key) DO NOTHING;

REVOKE ALL ON TABLE public.system_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.system_settings TO service_role;
REVOKE ALL ON TABLE public.orders, public.subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orders TO service_role;
GRANT SELECT ON TABLE public.subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.provision_qr_order_atomic(
  p_order_id UUID,
  p_receipt_sha256 TEXT,
  p_receipt_object_key TEXT,
  p_receipt_mime_type TEXT,
  p_receipt_size_bytes BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_order RECORD; v_wallet RECORD; v_config JSONB; v_exposure NUMERIC(12,2); v_cap NUMERIC(12,2); v_max_order NUMERIC(12,2);
  v_tier TEXT; v_new_balance INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_qr_provisional_exposure',0));
  SELECT value INTO v_config FROM system_settings WHERE key='qr_checkout_config';
  IF COALESCE((v_config->>'enabled')::boolean,false) IS NOT TRUE OR COALESCE((v_config->>'autoFulfillEnabled')::boolean,false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success',false,'error','QR_AUTO_FULFILL_DISABLED');
  END IF;
  IF COALESCE((v_config->>'recipientConfirmed')::boolean,false) IS NOT TRUE OR COALESCE(v_config->>'qrObjectKey','')='' THEN
    RETURN jsonb_build_object('success',false,'error','QR_RECIPIENT_NOT_CONFIGURED');
  END IF;
  IF p_receipt_sha256 !~ '^[a-f0-9]{64}$' OR COALESCE(p_receipt_object_key,'')='' OR p_receipt_size_bytes<1 OR p_receipt_size_bytes>5242880 THEN
    RETURN jsonb_build_object('success',false,'error','INVALID_PAYMENT_EVIDENCE');
  END IF;
  SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','ORDER_NOT_FOUND'); END IF;
  IF v_order.gateway_provider<>'qr_manual' OR v_order.payment_method<>'qr' THEN
    RETURN jsonb_build_object('success',false,'error','NOT_QR_ORDER');
  END IF;
  IF v_order.payment_state IN ('CREDITS_PROVISIONALLY_GRANTED','BANK_PAYMENT_VERIFIED') THEN
    SELECT balance INTO v_new_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;
    RETURN jsonb_build_object('success',true,'idempotent_replay',true,'order_id',v_order.id,'payment_state',v_order.payment_state,'balance',v_new_balance);
  END IF;
  IF v_order.status<>'PENDING' OR v_order.receipt_sha256 IS NOT NULL THEN
    RETURN jsonb_build_object('success',false,'error','ORDER_ALREADY_SUBMITTED');
  END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE receipt_sha256=p_receipt_sha256 AND id<>p_order_id) THEN
    RETURN jsonb_build_object('success',false,'error','RECEIPT_ALREADY_USED');
  END IF;
  UPDATE orders SET payment_state='PAYMENT_EVIDENCE_SUBMITTED',receipt_sha256=p_receipt_sha256,
    receipt_object_key=p_receipt_object_key,receipt_mime_type=p_receipt_mime_type,receipt_size_bytes=p_receipt_size_bytes,
    evidence_submitted_at=now(),metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('payment_evidence_authority','UNVERIFIED_CUSTOMER_UPLOAD')
  WHERE id=p_order_id;

  v_cap:=COALESCE((v_config->>'provisionalExposureCapMyr')::numeric,300);
  v_max_order:=COALESCE((v_config->>'maxAutoOrderMyr')::numeric,129);
  SELECT COALESCE(sum(amount_myr),0) INTO v_exposure FROM orders WHERE payment_state='CREDITS_PROVISIONALLY_GRANTED';
  IF v_order.amount_myr>v_max_order OR v_exposure+v_order.amount_myr>v_cap THEN
    UPDATE orders SET payment_state='PAYMENT_UNVERIFIED',metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object(
      'provisional_hold_reason',CASE WHEN v_order.amount_myr>v_max_order THEN 'ORDER_ABOVE_AUTO_LIMIT' ELSE 'EXPOSURE_CAP_REACHED' END)
    WHERE id=p_order_id;
    RETURN jsonb_build_object('success',true,'provisional_granted',false,'order_id',v_order.id,'payment_state','PAYMENT_UNVERIFIED',
      'reason',CASE WHEN v_order.amount_myr>v_max_order THEN 'ORDER_ABOVE_AUTO_LIMIT' ELSE 'EXPOSURE_CAP_REACHED' END);
  END IF;

  SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=v_order.workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet missing for QR order %',p_order_id; END IF;
  UPDATE credit_wallets SET balance=balance+v_order.credits_granted,lifetime_granted=lifetime_granted+v_order.credits_granted,updated_at=now()
    WHERE id=v_wallet.id RETURNING balance INTO v_new_balance;
  INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description)
  VALUES(v_order.workspace_id,v_wallet.id,v_order.credits_granted,'GRANT','SUBSCRIPTION',v_order.id,
    'ord_qr_provisional_'||v_order.id::text,'Provisional QR credits: '||v_order.plan_id)
  ON CONFLICT(idempotency_key) DO NOTHING;
  v_tier:=CASE WHEN v_order.plan_id LIKE '%agency%' THEN 'agency' WHEN v_order.plan_id LIKE '%pro%' THEN 'pro' ELSE 'starter' END;
  UPDATE profiles SET tier=v_tier WHERE id=v_order.user_id;
  INSERT INTO subscriptions(workspace_id,user_id,plan_id,tier,status,current_period_start,current_period_end,updated_at)
  VALUES(v_order.workspace_id,v_order.user_id,v_order.plan_id,v_tier,'active',now(),now()+interval '30 days',now())
  ON CONFLICT(workspace_id) DO UPDATE SET plan_id=excluded.plan_id,tier=excluded.tier,status='active',
    current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=now();
  UPDATE orders SET payment_state='CREDITS_PROVISIONALLY_GRANTED',provisional_granted_at=now(),
    metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('provisional_credits',v_order.credits_granted,'bank_verified',false)
  WHERE id=p_order_id;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
  VALUES('qr-auto-fulfillment','QR_PROVISIONAL_CREDITS_GRANTED','ORDER',p_order_id::text,'ORDER',p_order_id::text,
    jsonb_build_object('amount_myr',v_order.amount_myr,'credits',v_order.credits_granted,'receipt_sha256',p_receipt_sha256));
  RETURN jsonb_build_object('success',true,'provisional_granted',true,'order_id',v_order.id,
    'payment_state','CREDITS_PROVISIONALLY_GRANTED','balance',v_new_balance,'credits_granted',v_order.credits_granted);
END $$;
REVOKE ALL ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_qr_order_payment_atomic(p_order_id UUID,p_bank_reference TEXT,p_admin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD; v_wallet RECORD; v_result JSONB; v_affiliate RECORD; v_commission NUMERIC(10,2); v_balance INT;
BEGIN
  IF nullif(trim(p_bank_reference),'') IS NULL THEN RETURN jsonb_build_object('success',false,'error','BANK_REFERENCE_REQUIRED'); END IF;
  SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.gateway_provider<>'qr_manual' THEN RETURN jsonb_build_object('success',false,'error','QR_ORDER_NOT_FOUND'); END IF;
  IF v_order.payment_state='BANK_PAYMENT_VERIFIED' THEN
    SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;
    RETURN jsonb_build_object('success',true,'idempotent_replay',true,'order_id',p_order_id,'balance',v_balance);
  END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE id<>p_order_id AND status='PAID' AND gateway_reference=p_bank_reference) THEN
    RETURN jsonb_build_object('success',false,'error','BANK_REFERENCE_ALREADY_USED');
  END IF;
  IF v_order.payment_state='CREDITS_PROVISIONALLY_GRANTED' THEN
    UPDATE orders SET status='PAID',payment_state='BANK_PAYMENT_VERIFIED',gateway_reference=p_bank_reference,
      paid_at=now(),bank_verified_at=now(),metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('bank_verified_by',p_admin,'bank_verified',true)
    WHERE id=p_order_id;
    SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;
    IF v_order.referral_code IS NOT NULL THEN
      SELECT * INTO v_affiliate FROM affiliate_partners WHERE referral_code=v_order.referral_code AND status='APPROVED'
        AND user_id<>v_order.user_id AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.workspace_id=v_order.workspace_id AND o.status='PAID' AND o.id<>v_order.id);
      IF FOUND THEN
        v_commission:=round(v_order.amount_myr*0.10,2);
        INSERT INTO affiliate_commissions(affiliate_id,order_id,workspace_id,amount_myr,rate_percentage,status,available_at)
        VALUES(v_affiliate.id,v_order.id,v_order.workspace_id,v_commission,10.00,'PENDING',now()+interval '14 days') ON CONFLICT(order_id) DO NOTHING;
      END IF;
    END IF;
  ELSIF v_order.payment_state IN ('PAYMENT_EVIDENCE_SUBMITTED','PAYMENT_UNVERIFIED') THEN
    SELECT settle_order_payment_atomic(p_order_id,p_bank_reference,jsonb_build_object('bank_verified_by',p_admin,'bank_verified',true)) INTO v_result;
    IF COALESCE((v_result->>'success')::boolean,false) IS NOT TRUE THEN RETURN v_result; END IF;
    UPDATE orders SET payment_state='BANK_PAYMENT_VERIFIED',bank_verified_at=now() WHERE id=p_order_id;
    v_balance:=(v_result->>'balance')::int;
  ELSE RETURN jsonb_build_object('success',false,'error','PAYMENT_EVIDENCE_REQUIRED'); END IF;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
  VALUES(p_admin,'QR_BANK_PAYMENT_VERIFIED','ORDER',p_order_id::text,'ORDER',p_order_id::text,jsonb_build_object('bank_reference',p_bank_reference));
  RETURN jsonb_build_object('success',true,'order_id',p_order_id,'payment_state','BANK_PAYMENT_VERIFIED','balance',v_balance);
END $$;
REVOKE ALL ON FUNCTION public.verify_qr_order_payment_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_qr_order_payment_atomic(UUID,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reject_qr_provisional_order_atomic(p_order_id UUID,p_admin TEXT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD; v_wallet RECORD; v_revoke INT; v_shortfall INT;
BEGIN
  IF length(trim(COALESCE(p_reason,'')))<8 THEN RETURN jsonb_build_object('success',false,'error','REJECTION_REASON_REQUIRED'); END IF;
  SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.gateway_provider<>'qr_manual' THEN RETURN jsonb_build_object('success',false,'error','QR_ORDER_NOT_FOUND'); END IF;
  IF v_order.status='CANCELLED' THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true); END IF;
  IF v_order.status<>'PENDING' OR v_order.payment_state<>'CREDITS_PROVISIONALLY_GRANTED' THEN RETURN jsonb_build_object('success',false,'error','PROVISIONAL_ORDER_REQUIRED'); END IF;
  SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=v_order.workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet missing for provisional QR reversal %',p_order_id; END IF;
  v_revoke:=LEAST(v_order.credits_granted,GREATEST(0,v_wallet.balance-v_wallet.reserved_balance));
  v_shortfall:=v_order.credits_granted-v_revoke;
  IF v_revoke>0 THEN
    UPDATE credit_wallets SET balance=balance-v_revoke,updated_at=now() WHERE id=v_wallet.id;
    INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description)
    VALUES(v_order.workspace_id,v_wallet.id,-v_revoke,'MANUAL_ADJUSTMENT','SUBSCRIPTION',v_order.id,
      'ord_qr_reject_'||v_order.id::text,'Rejected provisional QR credits reversed') ON CONFLICT(idempotency_key) DO NOTHING;
  END IF;
  IF v_shortfall>0 THEN
    INSERT INTO credit_refund_debts(order_id,workspace_id,original_credits,outstanding_credits)
    VALUES(v_order.id,v_order.workspace_id,v_order.credits_granted,v_shortfall)
    ON CONFLICT(order_id) DO UPDATE SET outstanding_credits=GREATEST(credit_refund_debts.outstanding_credits,excluded.outstanding_credits);
  END IF;
  UPDATE orders SET status='CANCELLED',payment_state='PAYMENT_UNVERIFIED',metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object(
    'provisional_rejected_by',p_admin,'provisional_rejected_at',now(),'provisional_rejection_reason',p_reason,'credits_revoked',v_revoke,'credit_debt',v_shortfall)
  WHERE id=p_order_id;
  UPDATE subscriptions
  SET status='cancelled',cancel_at_period_end=true,updated_at=now()
  WHERE workspace_id=v_order.workspace_id
    AND plan_id=v_order.plan_id
    AND status='active';
  IF NOT EXISTS(
    SELECT 1 FROM orders
    WHERE workspace_id=v_order.workspace_id
      AND status='PAID'
      AND id<>v_order.id
  ) THEN
    UPDATE profiles SET tier='free' WHERE id=v_order.user_id;
  END IF;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details) VALUES(p_admin,'QR_PROVISIONAL_REJECTED','ORDER',p_order_id::text,'ORDER',p_order_id::text,
    jsonb_build_object('reason',p_reason,'credits_revoked',v_revoke,'credit_debt',v_shortfall));
  RETURN jsonb_build_object('success',true,'order_id',p_order_id,'credits_revoked',v_revoke,'credit_debt',v_shortfall);
END $$;
REVOKE ALL ON FUNCTION public.reject_qr_provisional_order_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reject_qr_provisional_order_atomic(UUID,TEXT,TEXT) TO service_role;

COMMIT;
