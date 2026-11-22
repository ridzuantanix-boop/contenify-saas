-- AffiMatik FOMO Bonus V1: genuine 60-minute offer and auditable RM19 entitlement.
-- Additive and disabled by default. Production activation requires a separate reviewed toggle.
BEGIN;

CREATE TABLE IF NOT EXISTS public.fomo_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  offer_minutes INTEGER NOT NULL DEFAULT 60 CHECK (offer_minutes BETWEEN 5 AND 1440),
  payment_reservation_hours INTEGER NOT NULL DEFAULT 24 CHECK (payment_reservation_hours BETWEEN 1 AND 72),
  base_credits INTEGER NOT NULL DEFAULT 150 CHECK (base_credits > 0),
  bonus_credits INTEGER NOT NULL DEFAULT 100 CHECK (bonus_credits > 0),
  amount_myr NUMERIC(10,2) NOT NULL DEFAULT 19 CHECK (amount_myr > 0),
  holdout_bps INTEGER NOT NULL DEFAULT 1000 CHECK (holdout_bps BETWEEN 0 AND 9000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.fomo_offer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.fomo_campaigns(id) ON DELETE RESTRICT,
  visitor_id UUID NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cohort TEXT NOT NULL CHECK (cohort IN ('OFFER','CONTROL')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  offer_expires_at TIMESTAMPTZ NOT NULL,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(campaign_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS public.fomo_bonus_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.fomo_campaigns(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL REFERENCES public.fomo_offer_assignments(id) ON DELETE RESTRICT,
  visitor_id UUID NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  order_id UUID UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('CLAIMED','ORDER_LINKED','GRANTED','PURCHASE_CONFIRMED','EXPIRED','REVERSED')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_expires_at TIMESTAMPTZ NOT NULL,
  granted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  base_credits INTEGER NOT NULL,
  bonus_credits INTEGER NOT NULL,
  amount_myr NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, visitor_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS fomo_bonus_once_per_user
  ON public.fomo_bonus_claims(campaign_id, user_id)
  WHERE user_id IS NOT NULL AND status IN ('CLAIMED','ORDER_LINKED','GRANTED','PURCHASE_CONFIRMED');
CREATE INDEX IF NOT EXISTS fomo_claims_status_expiry ON public.fomo_bonus_claims(status, payment_expires_at);

CREATE TABLE IF NOT EXISTS public.fomo_offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.fomo_campaigns(id) ON DELETE SET NULL,
  visitor_id UUID,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES public.fomo_bonus_claims(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'fomo_offer_view','fomo_claim_click','fomo_claim_success','fomo_claim_expired',
    'fomo_whatsapp_request','fomo_checkout_start','fomo_receipt_uploaded',
    'fomo_bonus_granted','fomo_purchase_confirmed'
  )),
  dedupe_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('web','server')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fomo_events_campaign_time ON public.fomo_offer_events(campaign_id, occurred_at DESC);

ALTER TABLE public.fomo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fomo_offer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fomo_bonus_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fomo_offer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fomo_campaigns,public.fomo_offer_assignments,public.fomo_bonus_claims,public.fomo_offer_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fomo_campaigns,public.fomo_offer_assignments,public.fomo_bonus_claims,public.fomo_offer_events TO service_role;

INSERT INTO public.fomo_campaigns(code,enabled,starts_at,ends_at,offer_minutes,payment_reservation_hours,base_credits,bonus_credits,amount_myr,holdout_bps)
VALUES('fomo_v1',false,'2026-11-22 00:00:00+00','2026-12-31 15:59:59+00',60,24,150,100,19,1000)
ON CONFLICT(code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.initialize_fomo_offer_v1(p_visitor_id UUID,p_user_id UUID DEFAULT NULL,p_utm JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign RECORD;v_assignment RECORD;v_cohort TEXT;v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_campaign FROM fomo_campaigns WHERE code='fomo_v1' AND enabled=true AND now()>=starts_at AND now()<ends_at;
  IF NOT FOUND THEN RETURN jsonb_build_object('enabled',false,'reason','CAMPAIGN_INACTIVE');END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fomo_assignment_'||p_visitor_id::text,0));
  SELECT * INTO v_assignment FROM fomo_offer_assignments WHERE campaign_id=v_campaign.id AND visitor_id=p_visitor_id FOR UPDATE;
  IF FOUND THEN
    IF p_user_id IS NOT NULL AND v_assignment.user_id IS NULL THEN UPDATE fomo_offer_assignments SET user_id=p_user_id WHERE id=v_assignment.id;v_assignment.user_id:=p_user_id;END IF;
  ELSE
    v_cohort:=CASE WHEN mod((hashtextextended(p_visitor_id::text,0) & 9223372036854775807),10000)<v_campaign.holdout_bps THEN 'CONTROL' ELSE 'OFFER' END;
    v_expires:=least(now()+make_interval(mins=>v_campaign.offer_minutes),v_campaign.ends_at);
    INSERT INTO fomo_offer_assignments(campaign_id,visitor_id,user_id,cohort,offer_expires_at,utm)
    VALUES(v_campaign.id,p_visitor_id,p_user_id,v_cohort,v_expires,coalesce(p_utm,'{}'::jsonb)) RETURNING * INTO v_assignment;
  END IF;
  RETURN jsonb_build_object('enabled',true,'campaign_id',v_campaign.id,'campaign_code',v_campaign.code,'cohort',v_assignment.cohort,
    'server_now',now(),'offer_expires_at',v_assignment.offer_expires_at,'campaign_ends_at',v_campaign.ends_at,
    'base_credits',v_campaign.base_credits,'bonus_credits',v_campaign.bonus_credits,'total_credits',v_campaign.base_credits+v_campaign.bonus_credits,
    'amount_myr',v_campaign.amount_myr,'payment_reservation_hours',v_campaign.payment_reservation_hours);
END $$;

CREATE OR REPLACE FUNCTION public.claim_fomo_bonus_v1(p_visitor_id UUID,p_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_assignment RECORD;v_campaign RECORD;v_claim RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('fomo_claim_'||p_visitor_id::text,0));
  SELECT a.*,c.enabled,c.starts_at,c.ends_at,c.payment_reservation_hours,c.base_credits,c.bonus_credits,c.amount_myr
    INTO v_assignment FROM fomo_offer_assignments a JOIN fomo_campaigns c ON c.id=a.campaign_id
    WHERE a.visitor_id=p_visitor_id AND c.code='fomo_v1' FOR UPDATE OF a;
  IF NOT FOUND OR v_assignment.enabled IS NOT TRUE OR now()<v_assignment.starts_at OR now()>=v_assignment.ends_at THEN RETURN jsonb_build_object('success',false,'error','CAMPAIGN_INACTIVE');END IF;
  IF v_assignment.cohort<>'OFFER' THEN RETURN jsonb_build_object('success',false,'error','CONTROL_GROUP');END IF;
  IF now()>=v_assignment.offer_expires_at THEN
    INSERT INTO fomo_offer_events(campaign_id,visitor_id,user_id,event_name,dedupe_key,source)
      VALUES(v_assignment.campaign_id,p_visitor_id,p_user_id,'fomo_claim_expired','claim_expired:'||v_assignment.id::text,'server') ON CONFLICT(dedupe_key) DO NOTHING;
    RETURN jsonb_build_object('success',false,'error','OFFER_EXPIRED');
  END IF;
  IF p_user_id IS NOT NULL AND v_assignment.user_id IS NOT NULL AND v_assignment.user_id<>p_user_id THEN RETURN jsonb_build_object('success',false,'error','CLAIM_OWNER_MISMATCH');END IF;
  SELECT * INTO v_claim FROM fomo_bonus_claims WHERE campaign_id=v_assignment.campaign_id AND visitor_id=p_visitor_id FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'status',v_claim.status,'payment_expires_at',v_claim.payment_expires_at);END IF;
  IF p_user_id IS NOT NULL AND EXISTS(SELECT 1 FROM fomo_bonus_claims WHERE campaign_id=v_assignment.campaign_id AND user_id=p_user_id AND status IN('CLAIMED','ORDER_LINKED','GRANTED','PURCHASE_CONFIRMED')) THEN RETURN jsonb_build_object('success',false,'error','BONUS_ALREADY_CLAIMED');END IF;
  UPDATE fomo_offer_assignments SET user_id=coalesce(user_id,p_user_id) WHERE id=v_assignment.id;
  INSERT INTO fomo_bonus_claims(campaign_id,assignment_id,visitor_id,user_id,status,payment_expires_at,base_credits,bonus_credits,amount_myr)
    VALUES(v_assignment.campaign_id,v_assignment.id,p_visitor_id,p_user_id,'CLAIMED',now()+make_interval(hours=>v_assignment.payment_reservation_hours),v_assignment.base_credits,v_assignment.bonus_credits,v_assignment.amount_myr)
    RETURNING * INTO v_claim;
  INSERT INTO fomo_offer_events(campaign_id,visitor_id,user_id,claim_id,event_name,dedupe_key,source)
    VALUES(v_claim.campaign_id,p_visitor_id,p_user_id,v_claim.id,'fomo_claim_success','claim_success:'||v_claim.id::text,'server') ON CONFLICT(dedupe_key) DO NOTHING;
  RETURN jsonb_build_object('success',true,'claim_id',v_claim.id,'status',v_claim.status,'payment_expires_at',v_claim.payment_expires_at,
    'base_credits',v_claim.base_credits,'bonus_credits',v_claim.bonus_credits,'total_credits',v_claim.base_credits+v_claim.bonus_credits,'amount_myr',v_claim.amount_myr);
END $$;

CREATE OR REPLACE FUNCTION public.create_qr_order_fomo_v1(
 p_workspace_id UUID,p_user_id UUID,p_order_id UUID,p_claim_id UUID,p_visitor_id UUID,p_referral_code TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_claim RECORD;v_reference TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_qr_workspace_'||p_workspace_id::text,0));
  SELECT cl.*,c.enabled,c.starts_at,c.ends_at INTO v_claim FROM fomo_bonus_claims cl JOIN fomo_campaigns c ON c.id=cl.campaign_id
    WHERE cl.id=p_claim_id AND cl.visitor_id=p_visitor_id AND c.code='fomo_v1' FOR UPDATE OF cl;
  IF NOT FOUND OR v_claim.enabled IS NOT TRUE OR now()>=v_claim.payment_expires_at OR v_claim.status NOT IN('CLAIMED','ORDER_LINKED') THEN RETURN jsonb_build_object('success',false,'error','FOMO_CLAIM_NOT_ELIGIBLE');END IF;
  IF v_claim.user_id IS NOT NULL AND v_claim.user_id<>p_user_id THEN RETURN jsonb_build_object('success',false,'error','CLAIM_OWNER_MISMATCH');END IF;
  IF NOT EXISTS(SELECT 1 FROM workspaces WHERE id=p_workspace_id AND owner_id=p_user_id) THEN RETURN jsonb_build_object('success',false,'error','ORDER_OWNER_REQUIRED');END IF;
  IF EXISTS(SELECT 1 FROM workspace_payment_controls WHERE workspace_id=p_workspace_id AND hold_status='PAYMENT_HOLD') THEN RETURN jsonb_build_object('success',false,'error','ACCOUNT_PAYMENT_HOLD');END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE user_id=p_user_id AND plan_id='launch_pack' AND provisional_granted_at IS NOT NULL) THEN RETURN jsonb_build_object('success',false,'error','LAUNCH_PACK_ALREADY_PURCHASED');END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE workspace_id=p_workspace_id AND gateway_provider='qr_manual' AND status='PENDING' AND payment_state IN('PAYMENT_UNVERIFIED','PAYMENT_EVIDENCE_SUBMITTED','CREDITS_PROVISIONALLY_GRANTED','PROVISIONALLY_ACTIVE')) THEN RETURN jsonb_build_object('success',false,'error','UNRESOLVED_QR_ORDER_EXISTS');END IF;
  v_reference:='AFM-'||upper(left(p_order_id::text,8));
  INSERT INTO orders(id,workspace_id,user_id,plan_id,amount_myr,credits_granted,status,gateway_provider,gateway_reference,payment_method,referral_code,metadata,payment_state)
  VALUES(p_order_id,p_workspace_id,p_user_id,'launch_pack',v_claim.amount_myr,v_claim.base_credits+v_claim.bonus_credits,'PENDING','qr_manual',v_reference,'qr',nullif(trim(p_referral_code),''),
    jsonb_build_object('planName','Launch Pack','purchaseType','LAUNCH_PACK','creditValidityDays',180,'paymentAuthority','CUSTOMER_DECLARATION_UNVERIFIED','renewalType','none',
      'promotion_code','fomo_v1','fomo_claim_id',v_claim.id,'launch_pack_base',v_claim.base_credits,'fomo_v1_bonus',v_claim.bonus_credits),
    'PAYMENT_UNVERIFIED');
  UPDATE fomo_bonus_claims SET user_id=p_user_id,order_id=p_order_id,status='ORDER_LINKED',updated_at=now() WHERE id=v_claim.id;
  INSERT INTO fomo_offer_events(campaign_id,visitor_id,user_id,workspace_id,claim_id,order_id,event_name,dedupe_key,source)
    VALUES(v_claim.campaign_id,p_visitor_id,p_user_id,p_workspace_id,v_claim.id,p_order_id,'fomo_checkout_start','checkout:'||p_order_id::text,'server') ON CONFLICT(dedupe_key) DO NOTHING;
  RETURN jsonb_build_object('success',true,'order_id',p_order_id,'amount_myr',v_claim.amount_myr,'credits_granted',v_claim.base_credits+v_claim.bonus_credits,
    'base_credits',v_claim.base_credits,'bonus_credits',v_claim.bonus_credits,'reference_code',v_reference,'purchase_type','LAUNCH_PACK','promotion_code','fomo_v1');
END $$;

CREATE OR REPLACE FUNCTION public.provision_qr_order_fomo_v1(
 p_order_id UUID,p_receipt_sha256 TEXT,p_receipt_object_key TEXT,p_receipt_mime_type TEXT,p_receipt_size_bytes BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD;v_claim RECORD;v_wallet RECORD;v_bucket UUID;v_balance INT;
BEGIN
  IF p_receipt_sha256 !~ '^[a-f0-9]{64}$' OR coalesce(p_receipt_object_key,'')='' OR
     p_receipt_mime_type NOT IN('image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/bmp','image/tiff','application/pdf') OR
     p_receipt_size_bytes<8 OR p_receipt_size_bytes>26214400 THEN RETURN jsonb_build_object('success',false,'error','INVALID_PAYMENT_EVIDENCE');END IF;
  SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.gateway_provider<>'qr_manual' OR v_order.plan_id<>'launch_pack' OR v_order.amount_myr<>19 OR v_order.credits_granted<>250 OR v_order.metadata->>'promotion_code'<>'fomo_v1' THEN RETURN jsonb_build_object('success',false,'error','FOMO_ORDER_NOT_FOUND');END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_qr_workspace_'||v_order.workspace_id::text,0));
  SELECT * INTO v_claim FROM fomo_bonus_claims WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_claim.user_id<>v_order.user_id OR v_claim.status NOT IN('ORDER_LINKED','GRANTED','PURCHASE_CONFIRMED') THEN RETURN jsonb_build_object('success',false,'error','FOMO_CLAIM_NOT_ELIGIBLE');END IF;
  IF EXISTS(SELECT 1 FROM workspace_payment_controls WHERE workspace_id=v_order.workspace_id AND hold_status='PAYMENT_HOLD') THEN RETURN jsonb_build_object('success',false,'error','ACCOUNT_PAYMENT_HOLD');END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE id<>p_order_id AND receipt_sha256=p_receipt_sha256) THEN RETURN jsonb_build_object('success',false,'error','RECEIPT_ALREADY_USED');END IF;
  IF v_order.payment_state IN('PROVISIONALLY_ACTIVE','PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED') THEN SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;RETURN jsonb_build_object('success',true,'idempotent_replay',true,'provisional_granted',true,'payment_state',v_order.payment_state,'balance',v_balance,'credits_granted',0);END IF;
  IF now()>=v_claim.payment_expires_at THEN UPDATE fomo_bonus_claims SET status='EXPIRED',updated_at=now() WHERE id=v_claim.id;RETURN jsonb_build_object('success',false,'error','FOMO_PAYMENT_WINDOW_EXPIRED');END IF;
  IF v_order.status<>'PENDING' OR v_order.payment_state NOT IN('PAYMENT_UNVERIFIED','PAYMENT_EVIDENCE_SUBMITTED') THEN RETURN jsonb_build_object('success',false,'error','ORDER_NOT_ELIGIBLE');END IF;
  SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=v_order.workspace_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','WALLET_NOT_FOUND');END IF;
  UPDATE credit_wallets SET balance=balance+250,lifetime_granted=lifetime_granted+250,updated_at=now() WHERE id=v_wallet.id RETURNING balance INTO v_balance;
  INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description,metadata)
    VALUES(v_order.workspace_id,v_wallet.id,150,'GRANT','TOP_UP',v_order.id,'ord_qr_instant_base_'||v_order.id::text,'Launch Pack kredit asas',jsonb_build_object('promotion_code','fomo_v1','component','launch_pack_base','revenue_verified',false));
  INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description,metadata)
    VALUES(v_order.workspace_id,v_wallet.id,100,'GRANT','TOP_UP',v_order.id,'ord_qr_fomo_bonus_'||v_order.id::text,'FOMO V1 bonus 100 kredit',jsonb_build_object('promotion_code','fomo_v1','component','fomo_v1_bonus','revenue_verified',false));
  INSERT INTO credit_buckets(workspace_id,wallet_id,order_id,source_type,granted_credits,remaining_credits,expires_at,provisional_order_id)
    VALUES(v_order.workspace_id,v_wallet.id,v_order.id,'TOP_UP',250,250,now()+interval '180 days',v_order.id) RETURNING id INTO v_bucket;
  INSERT INTO provisional_credit_entitlements(order_id,workspace_id,bucket_id,state,credits_granted,credits_remaining,amount_myr)
    VALUES(v_order.id,v_order.workspace_id,v_bucket,'PROVISIONALLY_ACTIVE',250,250,v_order.amount_myr);
  UPDATE orders SET payment_state='PROVISIONALLY_ACTIVE',receipt_sha256=p_receipt_sha256,receipt_object_key=p_receipt_object_key,receipt_mime_type=p_receipt_mime_type,
    receipt_size_bytes=p_receipt_size_bytes,evidence_submitted_at=now(),provisional_granted_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('provisional_credits',250,'bank_verified',false,'full_credit_access',true)
    WHERE id=p_order_id;
  UPDATE fomo_bonus_claims SET status='GRANTED',granted_at=now(),updated_at=now() WHERE id=v_claim.id;
  INSERT INTO customer_notifications(workspace_id,user_id,title,message,notification_type,related_order_id)
    VALUES(v_order.workspace_id,v_order.user_id,'250 kredit Launch Pack telah diaktifkan','150 kredit asas dan 100 kredit bonus telah diaktifkan. Pembayaran masih dalam proses pengesahan.','PAYMENT_PROVISIONAL_ACTIVE',v_order.id);
  INSERT INTO fomo_offer_events(campaign_id,visitor_id,user_id,workspace_id,claim_id,order_id,event_name,dedupe_key,source)
    VALUES(v_claim.campaign_id,v_claim.visitor_id,v_order.user_id,v_order.workspace_id,v_claim.id,v_order.id,'fomo_bonus_granted','bonus_granted:'||v_order.id::text,'server') ON CONFLICT(dedupe_key) DO NOTHING;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
    VALUES('qr-instant-activation','FOMO_V1_PROVISIONALLY_ACTIVE','ORDER',v_order.id::text,'WORKSPACE',v_order.workspace_id::text,jsonb_build_object('amount_myr',19,'launch_pack_base',150,'fomo_v1_bonus',100,'bank_verified',false));
  RETURN jsonb_build_object('success',true,'provisional_granted',true,'payment_state','PROVISIONALLY_ACTIVE','balance',v_balance,'credits_granted',250,'base_credits',150,'bonus_credits',100);
END $$;

CREATE OR REPLACE FUNCTION public.sync_fomo_claim_from_order_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.metadata->>'promotion_code'='fomo_v1' THEN
    IF NEW.status='REFUNDED' OR NEW.payment_state='PAYMENT_REJECTED' THEN UPDATE fomo_bonus_claims SET status='REVERSED',reversed_at=now(),updated_at=now() WHERE order_id=NEW.id AND status<>'REVERSED';
    ELSIF NEW.status='PAID' AND NEW.payment_state IN('PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED') THEN
      UPDATE fomo_bonus_claims SET status='PURCHASE_CONFIRMED',confirmed_at=now(),updated_at=now() WHERE order_id=NEW.id AND status<>'PURCHASE_CONFIRMED';
      INSERT INTO fomo_offer_events(campaign_id,visitor_id,user_id,workspace_id,claim_id,order_id,event_name,dedupe_key,source)
        SELECT campaign_id,visitor_id,NEW.user_id,NEW.workspace_id,id,NEW.id,'fomo_purchase_confirmed','purchase_confirmed:'||NEW.id::text,'server' FROM fomo_bonus_claims WHERE order_id=NEW.id ON CONFLICT(dedupe_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_fomo_claim_from_order_v1 ON public.orders;
CREATE TRIGGER sync_fomo_claim_from_order_v1 AFTER UPDATE OF status,payment_state ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_fomo_claim_from_order_v1();

REVOKE ALL ON FUNCTION public.initialize_fomo_offer_v1(UUID,UUID,JSONB),public.claim_fomo_bonus_v1(UUID,UUID),
  public.create_qr_order_fomo_v1(UUID,UUID,UUID,UUID,UUID,TEXT),public.provision_qr_order_fomo_v1(UUID,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_fomo_offer_v1(UUID,UUID,JSONB),public.claim_fomo_bonus_v1(UUID,UUID),
  public.create_qr_order_fomo_v1(UUID,UUID,UUID,UUID,UUID,TEXT),public.provision_qr_order_fomo_v1(UUID,TEXT,TEXT,TEXT,BIGINT) TO service_role;

COMMIT;
