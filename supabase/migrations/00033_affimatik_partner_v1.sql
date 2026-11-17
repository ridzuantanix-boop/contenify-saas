-- AffiMatik Partner V1: qualify once through a genuinely settled subscription,
-- then retain approved affiliate access independently of subscription expiry.
-- Additive: legacy codes, commissions, payouts and attribution remain intact.
BEGIN;

ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS affiliate_username TEXT;
ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS affiliate_username_reserved_at TIMESTAMPTZ;
ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS qualification_order_id UUID REFERENCES public.orders(id);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_partners_username_lower_unique
  ON public.affiliate_partners (lower(affiliate_username))
  WHERE affiliate_username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.affiliate_referral_aliases (
  alias_normalized TEXT PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  alias_kind TEXT NOT NULL CHECK (alias_kind IN ('LEGACY_CODE','CUSTOM_USERNAME')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS affiliate_referral_aliases_partner
  ON public.affiliate_referral_aliases(affiliate_id);
ALTER TABLE public.affiliate_referral_aliases ENABLE ROW LEVEL SECURITY;

INSERT INTO public.affiliate_referral_aliases(alias_normalized,affiliate_id,alias_kind)
SELECT lower(trim(referral_code)),id,'LEGACY_CODE'
FROM public.affiliate_partners
ON CONFLICT(alias_normalized) DO NOTHING;

INSERT INTO public.affiliate_referral_aliases(alias_normalized,affiliate_id,alias_kind)
SELECT lower(trim(affiliate_username)),id,'CUSTOM_USERNAME'
FROM public.affiliate_partners WHERE affiliate_username IS NOT NULL
ON CONFLICT(alias_normalized) DO NOTHING;

ALTER TABLE public.affiliate_partners ALTER COLUMN commission_rate SET DEFAULT 20.00;
ALTER TABLE public.affiliate_commissions ALTER COLUMN rate_percentage SET DEFAULT 20.00;
UPDATE public.affiliate_partners SET commission_rate=20.00
WHERE status IN ('PENDING','APPROVED');

CREATE OR REPLACE FUNCTION public.has_ever_qualified_paid_subscription_v1(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id=p_user_id
      AND o.plan_id IN ('plan_starter','plan_pro','plan_agency')
      AND o.status='PAID'
      AND o.payment_state IN ('PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED')
      AND coalesce((o.metadata->>'qa_simulation')::boolean,false)=false
      AND coalesce((o.metadata->>'full_refund')::boolean,false)=false
      AND coalesce((o.metadata->>'chargeback')::boolean,false)=false
      AND coalesce((o.metadata->>'fraudulent_payment')::boolean,false)=false
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_affiliate_partner_v1(p_alias TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT ap.id
  FROM public.affiliate_referral_aliases ara
  JOIN public.affiliate_partners ap ON ap.id=ara.affiliate_id
  WHERE ara.alias_normalized=lower(trim(p_alias)) AND ara.is_active AND ap.status='APPROVED'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_partner_state_v1(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_partner RECORD;v_qualified BOOLEAN;v_order UUID;
BEGIN
  SELECT * INTO v_partner FROM affiliate_partners WHERE user_id=p_user_id;
  v_qualified:=public.has_ever_qualified_paid_subscription_v1(p_user_id);
  SELECT id INTO v_order FROM orders
   WHERE user_id=p_user_id AND plan_id IN ('plan_starter','plan_pro','plan_agency')
    AND status='PAID' AND payment_state IN ('PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED')
    AND coalesce((metadata->>'qa_simulation')::boolean,false)=false
    AND coalesce((metadata->>'full_refund')::boolean,false)=false
    AND coalesce((metadata->>'chargeback')::boolean,false)=false
    AND coalesce((metadata->>'fraudulent_payment')::boolean,false)=false
   ORDER BY paid_at NULLS LAST,created_at LIMIT 1;
  RETURN jsonb_build_object(
    'status',coalesce(v_partner.status,'NOT_APPLIED'),
    'affiliate_id',v_partner.id,
    'legacy_referral_code',v_partner.referral_code,
    'affiliate_username',v_partner.affiliate_username,
    'commission_rate',coalesce(v_partner.commission_rate,20),
    'has_ever_qualified_paid_subscription',v_qualified,
    'qualification_order_id',coalesce(v_partner.qualification_order_id,v_order),
    'approved_at',v_partner.approved_at,
    'can_apply',v_qualified AND v_partner.id IS NULL,
    'lifetime_access',v_partner.status='APPROVED'
  );
END $$;

CREATE OR REPLACE FUNCTION public.apply_affiliate_partner_v1(
  p_user_id UUID,p_username TEXT,p_accept_terms BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_username TEXT:=lower(trim(p_username));v_partner RECORD;v_order UUID;v_id UUID;v_code TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('affiliate-user-'||p_user_id::text,0));
  IF p_accept_terms IS DISTINCT FROM true THEN RETURN jsonb_build_object('success',false,'error','TERMS_REQUIRED');END IF;
  IF v_username !~ '^[a-z0-9_]{3,20}$' THEN RETURN jsonb_build_object('success',false,'error','INVALID_USERNAME');END IF;
  IF v_username=ANY(ARRAY['admin','administrator','api','affimatik','billing','checkout','help','official','owner','partner','payment','payments','privacy','root','security','staff','support','system','terms','www'])
     OR v_username LIKE 'affimatik\_%' ESCAPE '\' OR v_username LIKE '%\_official' ESCAPE '\' THEN
    RETURN jsonb_build_object('success',false,'error','RESERVED_USERNAME');
  END IF;
  SELECT * INTO v_partner FROM affiliate_partners WHERE user_id=p_user_id FOR UPDATE;
  IF v_partner.id IS NOT NULL AND v_partner.affiliate_username IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'status',v_partner.status,'username',v_partner.affiliate_username,'existing',true);
  END IF;
  IF v_partner.id IS NULL AND NOT public.has_ever_qualified_paid_subscription_v1(p_user_id) THEN
    RETURN jsonb_build_object('success',false,'error','QUALIFYING_SUBSCRIPTION_REQUIRED');
  END IF;
  IF EXISTS(SELECT 1 FROM affiliate_referral_aliases WHERE alias_normalized=v_username) THEN
    RETURN jsonb_build_object('success',false,'error','USERNAME_TAKEN');
  END IF;
  IF v_partner.id IS NULL THEN
    SELECT id INTO v_order FROM orders
     WHERE user_id=p_user_id AND plan_id IN ('plan_starter','plan_pro','plan_agency')
      AND status='PAID' AND payment_state IN ('PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED')
      AND coalesce((metadata->>'qa_simulation')::boolean,false)=false
      AND coalesce((metadata->>'full_refund')::boolean,false)=false
      AND coalesce((metadata->>'chargeback')::boolean,false)=false
      AND coalesce((metadata->>'fraudulent_payment')::boolean,false)=false
     ORDER BY paid_at NULLS LAST,created_at LIMIT 1;
    v_id:=gen_random_uuid();v_code:='AF'||upper(substr(replace(v_id::text,'-',''),1,12));
    INSERT INTO affiliate_partners(id,user_id,referral_code,affiliate_username,affiliate_username_reserved_at,
      commission_rate,status,applied_at,terms_accepted_at,qualification_order_id)
    VALUES(v_id,p_user_id,v_code,v_username,now(),20,'PENDING',now(),now(),v_order);
    INSERT INTO affiliate_referral_aliases(alias_normalized,affiliate_id,alias_kind)
      VALUES(lower(v_code),v_id,'LEGACY_CODE'),(v_username,v_id,'CUSTOM_USERNAME');
    INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
      VALUES('affiliate-self-service','AFFILIATE_APPLICATION','AFFILIATE',v_id::text,'AFFILIATE',v_id::text,
       jsonb_build_object('username',v_username,'qualification_order_id',v_order,'commission_rate',20));
    RETURN jsonb_build_object('success',true,'status','PENDING','username',v_username);
  END IF;
  BEGIN
    INSERT INTO affiliate_referral_aliases(alias_normalized,affiliate_id,alias_kind)
      VALUES(v_username,v_partner.id,'CUSTOM_USERNAME');
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success',false,'error','USERNAME_TAKEN');
  END;
  UPDATE affiliate_partners SET affiliate_username=v_username,affiliate_username_reserved_at=now()
   WHERE id=v_partner.id AND affiliate_username IS NULL;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
    VALUES('affiliate-self-service','AFFILIATE_USERNAME_CLAIM','AFFILIATE',v_partner.id::text,'AFFILIATE',v_partner.id::text,jsonb_build_object('username',v_username));
  RETURN jsonb_build_object('success',true,'status',v_partner.status,'username',v_username,'legacy_alias_preserved',true);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success',false,'error','USERNAME_TAKEN');
END $$;

CREATE OR REPLACE FUNCTION public.review_affiliate_partner_v1(
  p_affiliate_id UUID,p_status TEXT,p_reviewer TEXT,p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_partner RECORD;
BEGIN
  SELECT * INTO v_partner FROM affiliate_partners WHERE id=p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','NOT_FOUND');END IF;
  IF p_status NOT IN ('APPROVED','REJECTED','SUSPENDED') THEN RETURN jsonb_build_object('success',false,'error','INVALID_STATUS');END IF;
  IF p_status='APPROVED' AND v_partner.status<>'APPROVED'
     AND NOT public.has_ever_qualified_paid_subscription_v1(v_partner.user_id) THEN
    RETURN jsonb_build_object('success',false,'error','QUALIFICATION_NO_LONGER_VALID');
  END IF;
  UPDATE affiliate_partners SET status=p_status,reviewed_at=now(),reviewed_by=p_reviewer,
    approved_at=CASE WHEN p_status='APPROVED' THEN coalesce(approved_at,now()) ELSE approved_at END,
    commission_rate=20 WHERE id=p_affiliate_id;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
    VALUES(p_reviewer,CASE WHEN p_status='SUSPENDED' THEN 'AFFILIATE_FRAUD_OR_POLICY_SUSPENSION' ELSE 'AFFILIATE_REVIEW' END,
      'AFFILIATE',p_affiliate_id::text,'AFFILIATE',p_affiliate_id::text,jsonb_build_object('status',p_status,'reason',p_reason,'subscription_status_ignored',true));
  RETURN jsonb_build_object('success',true,'status',p_status);
END $$;

-- Registration attribution resolves both permanent custom usernames and legacy codes.
CREATE OR REPLACE FUNCTION public.provision_verified_account_atomic(
  p_user_id UUID,p_email TEXT,p_full_name TEXT,p_whatsapp TEXT,p_referral_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_auth RECORD;v_workspace UUID;v_partner UUID;v_profile RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT id,email,email_confirmed_at INTO v_auth FROM auth.users WHERE id=p_user_id;
  IF NOT FOUND OR v_auth.email_confirmed_at IS NULL OR lower(v_auth.email)<>lower(p_email) THEN RETURN jsonb_build_object('success',false,'error','Verified email required');END IF;
  SELECT * INTO v_profile FROM profiles WHERE id=p_user_id FOR UPDATE;v_workspace:=v_profile.default_workspace_id;
  IF v_workspace IS NULL THEN SELECT workspace_id INTO v_workspace FROM workspace_members WHERE user_id=p_user_id ORDER BY created_at LIMIT 1;END IF;
  IF v_workspace IS NULL THEN SELECT id INTO v_workspace FROM workspaces WHERE owner_id=p_user_id ORDER BY created_at LIMIT 1;END IF;
  IF v_workspace IS NULL THEN INSERT INTO workspaces(name,slug,owner_id,status) VALUES(left(coalesce(nullif(trim(p_full_name),''),split_part(p_email,'@',1))||' Workspace',255),'ws-'||replace(p_user_id::text,'-',''),p_user_id,'active') RETURNING id INTO v_workspace;END IF;
  INSERT INTO profiles(id,email,full_name,whatsapp,tier,default_workspace_id) VALUES(p_user_id,lower(p_email),left(p_full_name,255),left(p_whatsapp,50),'free',v_workspace)
   ON CONFLICT(id) DO UPDATE SET default_workspace_id=coalesce(profiles.default_workspace_id,excluded.default_workspace_id);
  INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(v_workspace,p_user_id,'owner') ON CONFLICT(workspace_id,user_id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM credit_wallets WHERE workspace_id=v_workspace) THEN PERFORM provision_wallet_atomic(v_workspace,20);END IF;
  IF nullif(trim(p_referral_code),'') IS NOT NULL THEN
    v_partner:=public.resolve_affiliate_partner_v1(p_referral_code);
    IF v_partner IS NOT NULL AND NOT EXISTS(SELECT 1 FROM affiliate_partners WHERE id=v_partner AND user_id=p_user_id) THEN
      UPDATE profiles SET referred_by_affiliate_id=v_partner WHERE id=p_user_id AND referred_by_affiliate_id IS NULL;
      INSERT INTO affiliate_referral_events(affiliate_id,event_type,referred_user_id) VALUES(v_partner,'REGISTRATION',p_user_id) ON CONFLICT(referred_user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'workspace_id',v_workspace);
END $$;

-- Current QR confirmation remains idempotent; alias resolution and 20% are the only commercial changes.
CREATE OR REPLACE FUNCTION public.verify_qr_order_payment_atomic(p_order_id UUID,p_bank_reference TEXT,p_admin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD;v_ent RECORD;v_affiliate RECORD;v_comm NUMERIC(10,2);v_balance INT;v_affiliate_id UUID;
BEGIN
 IF nullif(trim(p_bank_reference),'') IS NULL THEN RETURN jsonb_build_object('success',false,'error','BANK_REFERENCE_REQUIRED');END IF;
 SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.gateway_provider<>'qr_manual' THEN RETURN jsonb_build_object('success',false,'error','QR_ORDER_NOT_FOUND');END IF;
 IF v_order.payment_state IN('PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED') THEN SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;RETURN jsonb_build_object('success',true,'idempotent_replay',true,'balance',v_balance,'payment_state','PAYMENT_CONFIRMED');END IF;
 IF v_order.payment_state<>'PROVISIONALLY_ACTIVE' THEN RETURN jsonb_build_object('success',false,'error','PROVISIONALLY_ACTIVE_ORDER_REQUIRED');END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE id<>p_order_id AND status='PAID' AND gateway_reference=p_bank_reference) THEN RETURN jsonb_build_object('success',false,'error','BANK_REFERENCE_ALREADY_USED');END IF;
 SELECT * INTO v_ent FROM provisional_credit_entitlements WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_ent.state<>'PROVISIONALLY_ACTIVE' THEN RETURN jsonb_build_object('success',false,'error','PROVISIONAL_ENTITLEMENT_NOT_FOUND');END IF;
 UPDATE orders SET status='PAID',payment_state='PAYMENT_CONFIRMED',gateway_reference=p_bank_reference,paid_at=now(),bank_verified_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('bank_verified_by',p_admin,'bank_verified',true) WHERE id=p_order_id;
 UPDATE provisional_credit_entitlements SET state='PAYMENT_CONFIRMED',confirmed_at=now(),reviewed_by=p_admin,updated_at=now() WHERE order_id=p_order_id;
 IF v_order.referral_code IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders WHERE workspace_id=v_order.workspace_id AND status='PAID' AND id<>v_order.id) THEN
  v_affiliate_id:=public.resolve_affiliate_partner_v1(v_order.referral_code);
  SELECT * INTO v_affiliate FROM affiliate_partners WHERE id=v_affiliate_id AND user_id<>v_order.user_id;
  IF FOUND AND v_order.plan_id NOT LIKE 'topup_%' THEN v_comm:=round(v_order.amount_myr*0.20,2);
   INSERT INTO affiliate_commissions(affiliate_id,order_id,workspace_id,amount_myr,rate_percentage,status,available_at)
   VALUES(v_affiliate.id,v_order.id,v_order.workspace_id,v_comm,20.00,'PENDING',now()+interval '14 days') ON CONFLICT(order_id) DO NOTHING;END IF;
 END IF;
 INSERT INTO customer_notifications(workspace_id,user_id,title,message,notification_type,related_order_id) VALUES(v_order.workspace_id,v_order.user_id,'Pembayaran disahkan','Pembayaran anda telah disahkan. Akaun dan kredit anda kekal aktif.','PAYMENT_CONFIRMED',v_order.id);
 INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details) VALUES(p_admin,'QR_PAYMENT_CONFIRMED','ORDER',v_order.id::text,'WORKSPACE',v_order.workspace_id::text,jsonb_build_object('bank_reference',p_bank_reference,'credits_regranted',false));
 SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;
 RETURN jsonb_build_object('success',true,'payment_state','PAYMENT_CONFIRMED','balance',v_balance,'credits_granted',0);
END $$;

REVOKE ALL ON TABLE public.affiliate_referral_aliases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.affiliate_referral_aliases TO service_role;
REVOKE ALL ON FUNCTION public.has_ever_qualified_paid_subscription_v1(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resolve_affiliate_partner_v1(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.affiliate_partner_state_v1(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_affiliate_partner_v1(UUID,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_affiliate_partner_v1(UUID,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.has_ever_qualified_paid_subscription_v1(UUID),public.resolve_affiliate_partner_v1(TEXT),public.affiliate_partner_state_v1(UUID),public.apply_affiliate_partner_v1(UUID,TEXT,BOOLEAN),public.review_affiliate_partner_v1(UUID,TEXT,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.provision_verified_account_atomic(UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_verified_account_atomic(UUID,TEXT,TEXT,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.verify_qr_order_payment_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_qr_order_payment_atomic(UUID,TEXT,TEXT) TO service_role;

COMMIT;
