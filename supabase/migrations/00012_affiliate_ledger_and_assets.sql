-- V2 affiliate ledger, payouts and atomic product asset registration.
-- Additive migration. Existing orders, wallets, media and commission rows remain intact.
BEGIN;

CREATE TABLE IF NOT EXISTS public.affiliate_referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliate_partners(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('CLICK', 'REGISTRATION')),
  visitor_hash TEXT,
  referred_user_id UUID REFERENCES public.profiles(id),
  campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_registration_once UNIQUE (referred_user_id)
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID REFERENCES public.affiliate_partners(id);
CREATE INDEX IF NOT EXISTS affiliate_events_partner_date ON public.affiliate_referral_events(affiliate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.affiliate_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliate_partners(id),
  amount_myr NUMERIC(10,2) NOT NULL CHECK (amount_myr >= 50),
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','PAID','REJECTED','CANCELLED')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,
  reviewed_by TEXT,
  CONSTRAINT payout_reference_once UNIQUE (payout_reference)
);
CREATE INDEX IF NOT EXISTS affiliate_payout_partner_date ON public.affiliate_payout_requests(affiliate_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.affiliate_clawbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliate_partners(id),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id),
  amount_myr NUMERIC(10,2) NOT NULL CHECK (amount_myr > 0),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RECOVERED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recovered_at TIMESTAMPTZ,
  recovery_reference TEXT
);

ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ;
UPDATE public.affiliate_commissions
SET available_at = created_at + INTERVAL '14 days'
WHERE available_at IS NULL;
ALTER TABLE public.affiliate_commissions ALTER COLUMN available_at SET DEFAULT (now() + INTERVAL '14 days');
ALTER TABLE public.affiliate_commissions ALTER COLUMN available_at SET NOT NULL;
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS payout_request_id UUID REFERENCES public.affiliate_payout_requests(id);
CREATE INDEX IF NOT EXISTS affiliate_commissions_available ON public.affiliate_commissions(affiliate_id, status, available_at);

CREATE OR REPLACE FUNCTION public.request_affiliate_payout_atomic(p_affiliate_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_partner RECORD; v_total NUMERIC(10,2); v_request UUID;
BEGIN
  SELECT * INTO v_partner FROM affiliate_partners WHERE id=p_affiliate_id FOR UPDATE;
  IF NOT FOUND OR v_partner.status <> 'APPROVED' THEN
    RETURN jsonb_build_object('success',false,'error','Affiliate not approved');
  END IF;
  IF v_partner.payout_bank IS NULL OR v_partner.payout_account_number IS NULL OR v_partner.payout_account_holder IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Payout destination incomplete');
  END IF;
  IF EXISTS (SELECT 1 FROM affiliate_clawbacks WHERE affiliate_id=p_affiliate_id AND status='OPEN') THEN
    RETURN jsonb_build_object('success',false,'error','Outstanding refunded commission requires recovery');
  END IF;
  SELECT COALESCE(sum(amount_myr),0) INTO v_total FROM affiliate_commissions
  WHERE affiliate_id=p_affiliate_id AND status IN ('PENDING','APPROVED','PAYABLE')
    AND available_at <= now() AND payout_request_id IS NULL;
  IF v_total < 50 THEN RETURN jsonb_build_object('success',false,'error','Minimum payout RM50'); END IF;
  INSERT INTO affiliate_payout_requests(affiliate_id,amount_myr) VALUES(p_affiliate_id,v_total) RETURNING id INTO v_request;
  UPDATE affiliate_commissions SET payout_request_id=v_request, status='PAYABLE'
  WHERE affiliate_id=p_affiliate_id AND status IN ('PENDING','APPROVED','PAYABLE')
    AND available_at <= now() AND payout_request_id IS NULL;
  RETURN jsonb_build_object('success',true,'request_id',v_request,'amount_myr',v_total);
END $$;
REVOKE ALL ON FUNCTION public.request_affiliate_payout_atomic(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_affiliate_payout_atomic(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.review_affiliate_payout_atomic(p_request_id UUID, p_action TEXT, p_admin TEXT, p_reference TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request RECORD;
BEGIN
  SELECT * INTO v_request FROM affiliate_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Request not found'); END IF;
  IF p_action='APPROVED' AND v_request.status='REQUESTED' THEN
    UPDATE affiliate_payout_requests SET status='APPROVED',reviewed_at=now(),reviewed_by=p_admin WHERE id=p_request_id;
  ELSIF p_action='PAID' AND v_request.status='APPROVED' AND nullif(trim(p_reference),'') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM affiliate_commissions WHERE payout_request_id=p_request_id AND status='REVERSED') THEN
      RETURN jsonb_build_object('success',false,'error','Refunded commission in payout');
    END IF;
    UPDATE affiliate_payout_requests SET status='PAID',paid_at=now(),reviewed_by=p_admin,payout_reference=p_reference WHERE id=p_request_id;
    UPDATE affiliate_commissions SET status='PAID',paid_at=now(),payout_reference=p_reference WHERE payout_request_id=p_request_id AND status='PAYABLE';
  ELSIF p_action='REJECTED' AND v_request.status IN ('REQUESTED','APPROVED') THEN
    UPDATE affiliate_payout_requests SET status='REJECTED',reviewed_at=now(),reviewed_by=p_admin WHERE id=p_request_id;
    UPDATE affiliate_commissions SET payout_request_id=NULL,status='APPROVED' WHERE payout_request_id=p_request_id AND status='PAYABLE';
  ELSE RETURN jsonb_build_object('success',false,'error','Invalid payout transition'); END IF;
  RETURN jsonb_build_object('success',true,'request_id',p_request_id,'status',p_action);
END $$;
REVOKE ALL ON FUNCTION public.review_affiliate_payout_atomic(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_affiliate_payout_atomic(UUID,TEXT,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reverse_affiliate_commission_atomic(p_order_id UUID, p_admin TEXT, p_reason TEXT, p_refund_reference TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD; v_commission RECORD;
BEGIN
  IF nullif(trim(p_refund_reference),'') IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Verified refund reference required');
  END IF;
  SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status NOT IN ('PAID','REFUNDED') THEN
    RETURN jsonb_build_object('success',false,'error','Paid order not found');
  END IF;
  SELECT * INTO v_commission FROM affiliate_commissions WHERE order_id=p_order_id FOR UPDATE;
  IF v_commission.status='PAID' THEN
    INSERT INTO affiliate_clawbacks(affiliate_id,order_id,amount_myr)
    VALUES(v_commission.affiliate_id,p_order_id,v_commission.amount_myr)
    ON CONFLICT(order_id) DO NOTHING;
  END IF;
  UPDATE orders SET status='REFUNDED',metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('refund_reason',p_reason,'refund_reference',p_refund_reference,'refund_recorded_by',p_admin,'refunded_at',now()) WHERE id=p_order_id;
  IF v_commission.id IS NOT NULL AND v_commission.status<>'PAID' THEN
    UPDATE affiliate_commissions SET status='REVERSED' WHERE id=v_commission.id AND status<>'REVERSED';
    IF v_commission.payout_request_id IS NOT NULL THEN
      UPDATE affiliate_payout_requests SET status='CANCELLED',reviewed_at=now(),reviewed_by=p_admin WHERE id=v_commission.payout_request_id AND status IN ('REQUESTED','APPROVED');
      UPDATE affiliate_commissions SET payout_request_id=NULL,status='APPROVED'
      WHERE payout_request_id=v_commission.payout_request_id AND id<>v_commission.id AND status='PAYABLE';
    END IF;
  END IF;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
  VALUES(p_admin,'ORDER_REFUND','ORDER',p_order_id::text,'ORDER',p_order_id::text,jsonb_build_object('reason',p_reason,'reference',p_refund_reference,'commission_id',v_commission.id));
  RETURN jsonb_build_object('success',true,'order_id',p_order_id,'commission_reversed',v_commission.id IS NOT NULL AND v_commission.status<>'PAID','clawback_open',v_commission.status='PAID');
END $$;
REVOKE ALL ON FUNCTION public.reverse_affiliate_commission_atomic(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_affiliate_commission_atomic(UUID,TEXT,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.recover_affiliate_clawback_atomic(p_clawback_id UUID,p_admin TEXT,p_reference TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row RECORD;
BEGIN
  IF nullif(trim(p_reference),'') IS NULL THEN RETURN jsonb_build_object('success',false,'error','Recovery reference required'); END IF;
  SELECT * INTO v_row FROM affiliate_clawbacks WHERE id=p_clawback_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Clawback not found'); END IF;
  IF v_row.status='RECOVERED' THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true); END IF;
  UPDATE affiliate_clawbacks SET status='RECOVERED',recovered_at=now(),recovery_reference=p_reference WHERE id=p_clawback_id;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
  VALUES(p_admin,'AFFILIATE_CLAWBACK_RECOVERED','AFFILIATE_CLAWBACK',p_clawback_id::text,'AFFILIATE_CLAWBACK',p_clawback_id::text,jsonb_build_object('reference',p_reference,'amount_myr',v_row.amount_myr));
  RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.recover_affiliate_clawback_atomic(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_affiliate_clawback_atomic(UUID,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.register_product_image_atomic(
  p_workspace_id UUID,p_product_id UUID,p_image_id UUID,p_name TEXT,p_category TEXT,p_notes TEXT,
  p_object_key TEXT,p_filename TEXT,p_mime_type TEXT,p_size BIGINT,p_checksum TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_existing RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||p_checksum,0));
  SELECT id,product_id,r2_key INTO v_existing FROM product_images
  WHERE workspace_id=p_workspace_id AND sha256_checksum=p_checksum ORDER BY created_at LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('asset_id',v_existing.id,'product_id',v_existing.product_id,'object_key',v_existing.r2_key,'reused',true); END IF;
  INSERT INTO products(id,workspace_id,name,category,description) VALUES(p_product_id,p_workspace_id,p_name,p_category,p_notes);
  INSERT INTO product_images(id,workspace_id,product_id,r2_key,original_filename,mime_type,size_bytes,sha256_checksum,is_primary)
  VALUES(p_image_id,p_workspace_id,p_product_id,p_object_key,p_filename,p_mime_type,p_size,p_checksum,true);
  RETURN jsonb_build_object('asset_id',p_image_id,'product_id',p_product_id,'object_key',p_object_key,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.register_product_image_atomic(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_product_image_atomic(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT) TO service_role;

COMMIT;
