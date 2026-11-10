-- AffiMatik Instant QR Payment Activation V1.
-- Full provisional credits are spendable immediately after payment evidence,
-- while revenue and affiliate commission remain unverified until admin review.
BEGIN;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_state_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_state_check CHECK(payment_state IN(
  'PAYMENT_UNVERIFIED','PAYMENT_EVIDENCE_SUBMITTED','CREDITS_PROVISIONALLY_GRANTED','BANK_PAYMENT_VERIFIED',
  'PROVISIONALLY_ACTIVE','PAYMENT_CONFIRMED','PAYMENT_REJECTED'
));

CREATE TABLE IF NOT EXISTS public.workspace_payment_controls(
 workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
 hold_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(hold_status IN('ACTIVE','PAYMENT_HOLD')),
 hold_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
 hold_reason TEXT,held_at TIMESTAMPTZ,held_by TEXT,reactivated_at TIMESTAMPTZ,reactivated_by TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.provisional_credit_entitlements(
 order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
 workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 bucket_id UUID REFERENCES public.credit_buckets(id) ON DELETE RESTRICT,
 state TEXT NOT NULL CHECK(state IN('PROVISIONALLY_ACTIVE','PAYMENT_CONFIRMED','PAYMENT_REJECTED')),
 credits_granted INT NOT NULL CHECK(credits_granted>0),credits_consumed INT NOT NULL DEFAULT 0 CHECK(credits_consumed>=0),
 credits_remaining INT NOT NULL CHECK(credits_remaining>=0),amount_myr NUMERIC(10,2) NOT NULL,
 activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),confirmed_at TIMESTAMPTZ,rejected_at TIMESTAMPTZ,
 reviewed_by TEXT,rejection_reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.customer_notifications(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 user_id UUID NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,notification_type TEXT NOT NULL,
 related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,read_at TIMESTAMPTZ,
 email_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(email_status IN('PENDING','SENT','FAILED','NOT_CONFIGURED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_buckets ADD COLUMN IF NOT EXISTS provisional_order_id UUID REFERENCES public.orders(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS credit_buckets_provisional_order_unique ON public.credit_buckets(provisional_order_id) WHERE provisional_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS provisional_entitlements_workspace_state ON public.provisional_credit_entitlements(workspace_id,state,activated_at DESC);
CREATE INDEX IF NOT EXISTS customer_notifications_workspace_date ON public.customer_notifications(workspace_id,created_at DESC);
REVOKE ALL ON TABLE public.workspace_payment_controls,public.provisional_credit_entitlements,public.customer_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.workspace_payment_controls,public.provisional_credit_entitlements,public.customer_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.sync_provisional_entitlement_from_bucket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.provisional_order_id IS NOT NULL THEN
  UPDATE provisional_credit_entitlements SET credits_remaining=NEW.remaining_credits,
   credits_consumed=GREATEST(0,credits_granted-NEW.remaining_credits),updated_at=now()
  WHERE order_id=NEW.provisional_order_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_provisional_entitlement_bucket ON public.credit_buckets;
CREATE TRIGGER sync_provisional_entitlement_bucket AFTER UPDATE OF remaining_credits ON public.credit_buckets
 FOR EACH ROW EXECUTE FUNCTION public.sync_provisional_entitlement_from_bucket();

CREATE OR REPLACE FUNCTION public.create_qr_order_atomic(
 p_workspace_id UUID,p_user_id UUID,p_order_id UUID,p_plan_id TEXT,p_referral_code TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_amount NUMERIC(10,2);v_credits INT;v_purchase TEXT;v_days INT;v_name TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_qr_workspace_'||p_workspace_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM workspaces WHERE id=p_workspace_id AND owner_id=p_user_id) THEN
  RETURN jsonb_build_object('success',false,'error','ORDER_OWNER_REQUIRED');
 END IF;
 IF EXISTS(SELECT 1 FROM workspace_payment_controls WHERE workspace_id=p_workspace_id AND hold_status='PAYMENT_HOLD') THEN
  RETURN jsonb_build_object('success',false,'error','ACCOUNT_PAYMENT_HOLD');
 END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE workspace_id=p_workspace_id AND gateway_provider='qr_manual' AND status='PENDING'
   AND payment_state IN('PAYMENT_UNVERIFIED','PAYMENT_EVIDENCE_SUBMITTED','CREDITS_PROVISIONALLY_GRANTED','PROVISIONALLY_ACTIVE')) THEN
  RETURN jsonb_build_object('success',false,'error','UNRESOLVED_QR_ORDER_EXISTS');
 END IF;
 CASE p_plan_id
  WHEN 'plan_starter' THEN v_amount:=49;v_credits:=500;v_purchase:='SUBSCRIPTION';v_days:=NULL;v_name:='Starter Creator';
  WHEN 'plan_pro' THEN v_amount:=129;v_credits:=2000;v_purchase:='SUBSCRIPTION';v_days:=NULL;v_name:='Pro Creator';
  WHEN 'plan_agency' THEN v_amount:=399;v_credits:=8000;v_purchase:='SUBSCRIPTION';v_days:=NULL;v_name:='Agency Studio';
  WHEN 'topup_mini' THEN v_amount:=15;v_credits:=100;v_purchase:='TOP_UP';v_days:=180;v_name:='Mini';
  WHEN 'topup_plus' THEN v_amount:=34;v_credits:=300;v_purchase:='TOP_UP';v_days:=180;v_name:='Plus';
  WHEN 'topup_max' THEN v_amount:=55;v_credits:=500;v_purchase:='TOP_UP';v_days:=180;v_name:='Max';
  ELSE RETURN jsonb_build_object('success',false,'error','INVALID_PLAN');
 END CASE;
 IF v_purchase='TOP_UP' AND NOT EXISTS(SELECT 1 FROM subscriptions WHERE workspace_id=p_workspace_id AND status='active' AND current_period_end>now()) THEN
  RETURN jsonb_build_object('success',false,'error','TOPUP_REQUIRES_ACTIVE_PAID_SUBSCRIPTION');
 END IF;
 INSERT INTO orders(id,workspace_id,user_id,plan_id,amount_myr,credits_granted,status,gateway_provider,gateway_reference,payment_method,referral_code,metadata,payment_state)
 VALUES(p_order_id,p_workspace_id,p_user_id,p_plan_id,v_amount,v_credits,'PENDING','qr_manual','AFM-'||upper(left(p_order_id::text,8)),'qr',nullif(trim(p_referral_code),''),
  jsonb_build_object('planName',v_name,'purchaseType',v_purchase,'creditValidityDays',v_days,'paymentAuthority','CUSTOMER_DECLARATION_UNVERIFIED','renewalType','manual_30_day'),
  'PAYMENT_UNVERIFIED');
 RETURN jsonb_build_object('success',true,'order_id',p_order_id,'amount_myr',v_amount,'credits_granted',v_credits,
  'reference_code','AFM-'||upper(left(p_order_id::text,8)),'purchase_type',v_purchase);
END $$;

CREATE OR REPLACE FUNCTION public.provision_qr_order_atomic(
 p_order_id UUID,p_receipt_sha256 TEXT,p_receipt_object_key TEXT,p_receipt_mime_type TEXT,p_receipt_size_bytes BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD;v_wallet RECORD;v_bucket UUID;v_balance INT;v_source TEXT;v_tier TEXT;
BEGIN
 IF p_receipt_sha256 !~ '^[a-f0-9]{64}$' OR coalesce(p_receipt_object_key,'')='' OR
    p_receipt_mime_type NOT IN('image/jpeg','image/png','image/webp','application/pdf') OR
    p_receipt_size_bytes<8 OR p_receipt_size_bytes>5242880 THEN
  RETURN jsonb_build_object('success',false,'error','INVALID_PAYMENT_EVIDENCE');
 END IF;
 SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.gateway_provider<>'qr_manual' THEN RETURN jsonb_build_object('success',false,'error','QR_ORDER_NOT_FOUND');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_qr_workspace_'||v_order.workspace_id::text,0));
 IF EXISTS(SELECT 1 FROM workspace_payment_controls WHERE workspace_id=v_order.workspace_id AND hold_status='PAYMENT_HOLD') THEN
  RETURN jsonb_build_object('success',false,'error','ACCOUNT_PAYMENT_HOLD');END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE id<>p_order_id AND workspace_id=v_order.workspace_id AND status='PENDING'
  AND payment_state IN('PAYMENT_EVIDENCE_SUBMITTED','CREDITS_PROVISIONALLY_GRANTED','PROVISIONALLY_ACTIVE')) THEN
  RETURN jsonb_build_object('success',false,'error','UNRESOLVED_QR_ORDER_EXISTS');END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE id<>p_order_id AND receipt_sha256=p_receipt_sha256) THEN
  RETURN jsonb_build_object('success',false,'error','RECEIPT_ALREADY_USED');END IF;
 IF v_order.payment_state IN('PROVISIONALLY_ACTIVE','PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED') THEN
  SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;
  RETURN jsonb_build_object('success',true,'idempotent_replay',true,'provisional_granted',true,'payment_state',v_order.payment_state,'balance',v_balance,'credits_granted',0);
 END IF;
 IF v_order.status<>'PENDING' OR v_order.payment_state NOT IN('PAYMENT_UNVERIFIED','PAYMENT_EVIDENCE_SUBMITTED') THEN
  RETURN jsonb_build_object('success',false,'error','ORDER_NOT_ELIGIBLE');END IF;
 IF NOT((v_order.plan_id='plan_starter' AND v_order.amount_myr=49 AND v_order.credits_granted=500)OR
        (v_order.plan_id='plan_pro' AND v_order.amount_myr=129 AND v_order.credits_granted=2000)OR
        (v_order.plan_id='plan_agency' AND v_order.amount_myr=399 AND v_order.credits_granted=8000)OR
        (v_order.plan_id='topup_mini' AND v_order.amount_myr=15 AND v_order.credits_granted=100)OR
        (v_order.plan_id='topup_plus' AND v_order.amount_myr=34 AND v_order.credits_granted=300)OR
        (v_order.plan_id='topup_max' AND v_order.amount_myr=55 AND v_order.credits_granted=500)) THEN
  RETURN jsonb_build_object('success',false,'error','ORDER_CATALOG_MISMATCH');
 END IF;
 SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=v_order.workspace_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','WALLET_NOT_FOUND');END IF;
 v_source:=CASE WHEN v_order.plan_id LIKE 'topup_%' THEN 'TOP_UP' ELSE 'SUBSCRIPTION' END;
 UPDATE credit_wallets SET balance=balance+v_order.credits_granted,lifetime_granted=lifetime_granted+v_order.credits_granted,updated_at=now()
  WHERE id=v_wallet.id RETURNING balance INTO v_balance;
 INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description,metadata)
 VALUES(v_order.workspace_id,v_wallet.id,v_order.credits_granted,'GRANT',v_source,v_order.id,'ord_qr_instant_'||v_order.id::text,
  'Kredit provisional QR akses penuh: '||v_order.plan_id,jsonb_build_object('revenue_verified',false,'payment_state','PROVISIONALLY_ACTIVE'));
 INSERT INTO credit_buckets(workspace_id,wallet_id,order_id,source_type,granted_credits,remaining_credits,expires_at,provisional_order_id)
 VALUES(v_order.workspace_id,v_wallet.id,v_order.id,v_source,v_order.credits_granted,v_order.credits_granted,
  CASE WHEN v_source='TOP_UP' THEN now()+interval '180 days' ELSE NULL END,v_order.id) RETURNING id INTO v_bucket;
 INSERT INTO provisional_credit_entitlements(order_id,workspace_id,bucket_id,state,credits_granted,credits_remaining,amount_myr)
 VALUES(v_order.id,v_order.workspace_id,v_bucket,'PROVISIONALLY_ACTIVE',v_order.credits_granted,v_order.credits_granted,v_order.amount_myr);
 IF v_source='SUBSCRIPTION' THEN
  v_tier:=CASE v_order.plan_id WHEN 'plan_agency' THEN 'agency' WHEN 'plan_pro' THEN 'pro' ELSE 'starter' END;
  UPDATE profiles SET tier=v_tier WHERE id=v_order.user_id;
  INSERT INTO subscriptions(workspace_id,user_id,plan_id,tier,status,current_period_start,current_period_end,updated_at)
  VALUES(v_order.workspace_id,v_order.user_id,v_order.plan_id,v_tier,'active',now(),now()+interval '30 days',now())
  ON CONFLICT(workspace_id) DO UPDATE SET plan_id=excluded.plan_id,tier=excluded.tier,status='active',current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=now();
 END IF;
 UPDATE orders SET payment_state='PROVISIONALLY_ACTIVE',receipt_sha256=p_receipt_sha256,receipt_object_key=p_receipt_object_key,
  receipt_mime_type=p_receipt_mime_type,receipt_size_bytes=p_receipt_size_bytes,evidence_submitted_at=now(),provisional_granted_at=now(),
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('provisional_credits',v_order.credits_granted,'bank_verified',false,'full_credit_access',true)
 WHERE id=p_order_id;
 INSERT INTO customer_notifications(workspace_id,user_id,title,message,notification_type,related_order_id)
 VALUES(v_order.workspace_id,v_order.user_id,'Kredit pakej telah diaktifkan','Terima kasih! Kredit pakej anda telah diaktifkan dan boleh digunakan sekarang. Pembayaran anda masih dalam proses pengesahan.','PAYMENT_PROVISIONAL_ACTIVE',v_order.id);
 INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
 VALUES('qr-instant-activation','QR_PROVISIONALLY_ACTIVE','ORDER',v_order.id::text,'WORKSPACE',v_order.workspace_id::text,
  jsonb_build_object('amount_myr',v_order.amount_myr,'credits',v_order.credits_granted,'receipt_sha256',p_receipt_sha256,'bank_verified',false));
 RETURN jsonb_build_object('success',true,'provisional_granted',true,'payment_state','PROVISIONALLY_ACTIVE','balance',v_balance,'credits_granted',v_order.credits_granted);
END $$;

CREATE OR REPLACE FUNCTION public.verify_qr_order_payment_atomic(p_order_id UUID,p_bank_reference TEXT,p_admin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD;v_ent RECORD;v_affiliate RECORD;v_comm NUMERIC(10,2);v_balance INT;
BEGIN
 IF nullif(trim(p_bank_reference),'') IS NULL THEN RETURN jsonb_build_object('success',false,'error','BANK_REFERENCE_REQUIRED');END IF;
 SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.gateway_provider<>'qr_manual' THEN RETURN jsonb_build_object('success',false,'error','QR_ORDER_NOT_FOUND');END IF;
 IF v_order.payment_state IN('PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED') THEN SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;RETURN jsonb_build_object('success',true,'idempotent_replay',true,'balance',v_balance,'payment_state','PAYMENT_CONFIRMED');END IF;
 IF v_order.payment_state<>'PROVISIONALLY_ACTIVE' THEN RETURN jsonb_build_object('success',false,'error','PROVISIONALLY_ACTIVE_ORDER_REQUIRED');END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE id<>p_order_id AND status='PAID' AND gateway_reference=p_bank_reference) THEN RETURN jsonb_build_object('success',false,'error','BANK_REFERENCE_ALREADY_USED');END IF;
 SELECT * INTO v_ent FROM provisional_credit_entitlements WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_ent.state<>'PROVISIONALLY_ACTIVE' THEN RETURN jsonb_build_object('success',false,'error','PROVISIONAL_ENTITLEMENT_NOT_FOUND');END IF;
 UPDATE orders SET status='PAID',payment_state='PAYMENT_CONFIRMED',gateway_reference=p_bank_reference,paid_at=now(),bank_verified_at=now(),
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('bank_verified_by',p_admin,'bank_verified',true) WHERE id=p_order_id;
 UPDATE provisional_credit_entitlements SET state='PAYMENT_CONFIRMED',confirmed_at=now(),reviewed_by=p_admin,updated_at=now() WHERE order_id=p_order_id;
 IF v_order.referral_code IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders WHERE workspace_id=v_order.workspace_id AND status='PAID' AND id<>v_order.id) THEN
  SELECT * INTO v_affiliate FROM affiliate_partners WHERE referral_code=v_order.referral_code AND status='APPROVED' AND user_id<>v_order.user_id;
  IF FOUND AND v_order.plan_id NOT LIKE 'topup_%' THEN v_comm:=round(v_order.amount_myr*0.10,2);
   INSERT INTO affiliate_commissions(affiliate_id,order_id,workspace_id,amount_myr,rate_percentage,status,available_at)
   VALUES(v_affiliate.id,v_order.id,v_order.workspace_id,v_comm,10.00,'PENDING',now()+interval '14 days') ON CONFLICT(order_id) DO NOTHING;END IF;
 END IF;
 INSERT INTO customer_notifications(workspace_id,user_id,title,message,notification_type,related_order_id)
 VALUES(v_order.workspace_id,v_order.user_id,'Pembayaran disahkan','Pembayaran anda telah disahkan. Akaun dan kredit anda kekal aktif.','PAYMENT_CONFIRMED',v_order.id);
 INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
 VALUES(p_admin,'QR_PAYMENT_CONFIRMED','ORDER',v_order.id::text,'WORKSPACE',v_order.workspace_id::text,jsonb_build_object('bank_reference',p_bank_reference,'credits_regranted',false));
 SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;
 RETURN jsonb_build_object('success',true,'payment_state','PAYMENT_CONFIRMED','balance',v_balance,'credits_granted',0);
END $$;

CREATE OR REPLACE FUNCTION public.reject_qr_provisional_order_atomic(p_order_id UUID,p_admin TEXT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD;v_job RECORD;v_cancelled INT:=0;
BEGIN
 IF length(trim(coalesce(p_reason,'')))<8 THEN RETURN jsonb_build_object('success',false,'error','REJECTION_REASON_REQUIRED');END IF;
 SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.gateway_provider<>'qr_manual' THEN RETURN jsonb_build_object('success',false,'error','QR_ORDER_NOT_FOUND');END IF;
 IF v_order.payment_state='PAYMENT_REJECTED' THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'payment_hold',true);END IF;
 IF v_order.payment_state<>'PROVISIONALLY_ACTIVE' THEN RETURN jsonb_build_object('success',false,'error','PROVISIONALLY_ACTIVE_ORDER_REQUIRED');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_nexabot_global_queue',0));
 INSERT INTO workspace_payment_controls(workspace_id,hold_status,hold_order_id,hold_reason,held_at,held_by,updated_at)
 VALUES(v_order.workspace_id,'PAYMENT_HOLD',v_order.id,trim(p_reason),now(),p_admin,now())
 ON CONFLICT(workspace_id) DO UPDATE SET hold_status='PAYMENT_HOLD',hold_order_id=excluded.hold_order_id,hold_reason=excluded.hold_reason,held_at=now(),held_by=p_admin,updated_at=now();
 FOR v_job IN SELECT * FROM video_jobs WHERE workspace_id=v_order.workspace_id AND provider='nexabot'
  AND (status='QUEUED' OR(status='SUBMITTING' AND provider_task_id IS NULL AND submission_started_at IS NULL)) FOR UPDATE LOOP
  PERFORM release_credits_atomic(v_order.workspace_id,v_job.id,'rel_payment_hold_'||v_job.id::text,'Kredit dipulangkan kerana akaun dibekukan sementara untuk semakan bayaran.');
  UPDATE video_jobs SET status='CANCELLED',next_dispatch_at=NULL,dispatch_lease_until=NULL,dispatch_token=NULL,
   raw_status='PAYMENT_HOLD_CANCELLED',error_message='Tugasan dibatalkan dan kredit dipulangkan kerana akaun sedang melalui semakan bayaran.',updated_at=now() WHERE id=v_job.id;
  v_cancelled:=v_cancelled+1;
 END LOOP;
 UPDATE orders SET status='CANCELLED',payment_state='PAYMENT_REJECTED',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
  'payment_rejected_by',p_admin,'payment_rejected_at',now(),'payment_rejection_reason',trim(p_reason),'historical_credits_deleted',false) WHERE id=p_order_id;
 UPDATE provisional_credit_entitlements SET state='PAYMENT_REJECTED',rejected_at=now(),reviewed_by=p_admin,rejection_reason=trim(p_reason),updated_at=now() WHERE order_id=p_order_id;
 INSERT INTO customer_notifications(workspace_id,user_id,title,message,notification_type,related_order_id)
 VALUES(v_order.workspace_id,v_order.user_id,'Pengesahan pembayaran diperlukan','Pembayaran anda belum dapat disahkan. Penggunaan kredit akaun anda telah dibekukan sementara. Sila hubungi sokongan atau kemukakan maklumat pembayaran yang betul untuk menyelesaikan masalah ini.','PAYMENT_REJECTED',v_order.id);
 INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
 VALUES(p_admin,'QR_PAYMENT_REJECTED_HOLD_APPLIED','ORDER',v_order.id::text,'WORKSPACE',v_order.workspace_id::text,
  jsonb_build_object('reason',trim(p_reason),'queued_jobs_cancelled',v_cancelled,'credits_deleted',0));
 RETURN jsonb_build_object('success',true,'payment_state','PAYMENT_REJECTED','payment_hold',true,'queued_jobs_cancelled',v_cancelled,'credits_revoked',0);
END $$;

CREATE OR REPLACE FUNCTION public.reactivate_workspace_payment_atomic(p_workspace_id UUID,p_admin TEXT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_control RECORD;v_user UUID;
BEGIN
 IF length(trim(coalesce(p_reason,'')))<8 THEN RETURN jsonb_build_object('success',false,'error','REACTIVATION_REASON_REQUIRED');END IF;
 SELECT * INTO v_control FROM workspace_payment_controls WHERE workspace_id=p_workspace_id FOR UPDATE;
 IF NOT FOUND OR v_control.hold_status='ACTIVE' THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'payment_hold',false);END IF;
 UPDATE workspace_payment_controls SET hold_status='ACTIVE',hold_reason=NULL,reactivated_at=now(),reactivated_by=p_admin,updated_at=now() WHERE workspace_id=p_workspace_id;
 SELECT owner_id INTO v_user FROM workspaces WHERE id=p_workspace_id;
 INSERT INTO customer_notifications(workspace_id,user_id,title,message,notification_type,related_order_id)
 VALUES(p_workspace_id,v_user,'Akaun diaktifkan semula','Semakan pembayaran telah diselesaikan. Penggunaan kredit akaun anda telah diaktifkan semula.','PAYMENT_HOLD_RELEASED',v_control.hold_order_id);
 INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
 VALUES(p_admin,'WORKSPACE_PAYMENT_HOLD_RELEASED','WORKSPACE',p_workspace_id::text,'ORDER',coalesce(v_control.hold_order_id::text,''),jsonb_build_object('reason',trim(p_reason)));
 RETURN jsonb_build_object('success',true,'payment_hold',false);
END $$;

-- V7.2 admission wrapper now fails closed for held workspaces before reserving credits.
CREATE OR REPLACE FUNCTION public.admit_nexabot_job_to_queue_atomic(
 p_workspace_id UUID,p_user_id UUID,p_job_id UUID,p_client_request_id VARCHAR,p_preset_id VARCHAR,
 p_preset_version INT,p_provider VARCHAR,p_duration_seconds INT,p_required_credits INT,p_max_concurrency INT,
 p_compiled_prompt TEXT,p_input_options JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result JSONB;v_sequence BIGINT;
BEGIN
 IF EXISTS(SELECT 1 FROM workspace_payment_controls WHERE workspace_id=p_workspace_id AND hold_status='PAYMENT_HOLD') THEN
  RETURN jsonb_build_object('success',false,'payment_hold',true,'error','Penggunaan kredit akaun dibekukan sementara kerana pembayaran belum dapat disahkan.');END IF;
 PERFORM expire_credit_buckets_atomic(p_workspace_id);
 SELECT public.admit_video_job_atomic(p_workspace_id,p_user_id,p_job_id,p_client_request_id,p_preset_id,p_preset_version,p_provider,p_duration_seconds,p_required_credits,p_max_concurrency,p_compiled_prompt,p_input_options) INTO v_result;
 IF coalesce((v_result->>'success')::boolean,false) IS NOT TRUE OR coalesce((v_result->>'is_duplicate')::boolean,false) IS TRUE THEN RETURN v_result;END IF;
 PERFORM allocate_job_credit_buckets_atomic(p_workspace_id,p_job_id,p_required_credits);
 IF p_provider='nexabot' THEN v_sequence:=nextval('public.video_job_queue_sequence');UPDATE video_jobs SET status='QUEUED',queue_sequence=v_sequence,enqueued_at=now(),next_dispatch_at=now(),provider_model_id='376',raw_status='QUEUE_WAITING',updated_at=now() WHERE id=p_job_id;v_result:=v_result||jsonb_build_object('status','QUEUED','queue_sequence',v_sequence);END IF;
 RETURN v_result;
END $$;

-- Queue claims are also fail-closed for held workspaces across all Workers.
CREATE OR REPLACE FUNCTION public.claim_next_nexabot_job_atomic(p_max_active INT DEFAULT 3,p_lease_seconds INT DEFAULT 180)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_active INT;v_job RECORD;v_token UUID;v_circuit JSONB;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_nexabot_global_queue',0));
 SELECT value INTO v_circuit FROM system_settings WHERE key='nexabot_circuit';
 IF nullif(v_circuit->>'openUntil','') IS NOT NULL AND(v_circuit->>'openUntil')::timestamptz>now() THEN RETURN jsonb_build_object('success',true,'claimed',false,'circuit_open',true);END IF;
 SELECT count(*) INTO v_active FROM video_jobs WHERE provider='nexabot' AND((status='PROCESSING' AND provider_task_id IS NOT NULL)OR(status='SUBMITTING' AND dispatch_lease_until>now()));
 IF v_active>=least(greatest(p_max_active,1),3) THEN RETURN jsonb_build_object('success',true,'claimed',false,'capacity_full',true,'active_count',v_active,'max_active',3);END IF;
 SELECT q.* INTO v_job FROM(SELECT j.*,coalesce((SELECT max(x.provider_dispatched_at) FROM video_jobs x WHERE x.workspace_id=j.workspace_id AND x.provider='nexabot'),timestamptz 'epoch') workspace_last_dispatch
  FROM video_jobs j WHERE j.provider='nexabot' AND j.status='QUEUED' AND coalesce(j.next_dispatch_at,j.enqueued_at,j.created_at)<=now()
   AND NOT EXISTS(SELECT 1 FROM workspace_payment_controls c WHERE c.workspace_id=j.workspace_id AND c.hold_status='PAYMENT_HOLD')
  ORDER BY workspace_last_dispatch,j.enqueued_at,j.queue_sequence FOR UPDATE SKIP LOCKED LIMIT 1)q;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',true,'claimed',false,'active_count',v_active,'max_active',3);END IF;
 v_token:=gen_random_uuid();UPDATE video_jobs SET status='SUBMITTING',dispatch_token=v_token,dispatch_lease_until=now()+make_interval(secs=>least(greatest(p_lease_seconds,30),600)),dispatch_attempt_count=dispatch_attempt_count+1,provider_dispatched_at=now(),submission_uncertain=false,submission_started_at=NULL,raw_status='DISPATCH_CLAIMED',updated_at=now() WHERE id=v_job.id;
 RETURN jsonb_build_object('success',true,'claimed',true,'job_id',v_job.id,'dispatch_token',v_token,'active_count',v_active+1,'max_active',3,'dispatch_attempt_count',v_job.dispatch_attempt_count+1);
END $$;

CREATE OR REPLACE VIEW public.provisional_payment_exposure AS
SELECT e.order_id,e.workspace_id,o.user_id,o.plan_id,o.amount_myr,o.gateway_reference,o.receipt_object_key,o.evidence_submitted_at,
 e.state,e.credits_granted,e.credits_consumed,e.credits_remaining,c.hold_status,
 (SELECT count(DISTINCT a.job_id) FROM credit_reservation_allocations a
   WHERE a.bucket_id=e.bucket_id AND a.status='SETTLED') AS jobs_generated,
 (SELECT coalesce(sum(pc.estimated_myr_cost),0)
   FROM(SELECT DISTINCT a.job_id FROM credit_reservation_allocations a
        WHERE a.bucket_id=e.bucket_id AND a.status='SETTLED') used_jobs
   JOIN provider_job_costs pc ON pc.job_id=used_jobs.job_id) AS estimated_provider_cost_myr
FROM provisional_credit_entitlements e JOIN orders o ON o.id=e.order_id
LEFT JOIN workspace_payment_controls c ON c.workspace_id=e.workspace_id;
REVOKE ALL ON public.provisional_payment_exposure FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.provisional_payment_exposure TO service_role;

REVOKE ALL ON FUNCTION public.create_qr_order_atomic(UUID,UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.verify_qr_order_payment_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reject_qr_provisional_order_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reactivate_workspace_payment_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_qr_order_atomic(UUID,UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_qr_order_payment_atomic(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_qr_provisional_order_atomic(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_workspace_payment_atomic(UUID,TEXT,TEXT) TO service_role;

UPDATE system_settings SET value=value||jsonb_build_object('instantFullAccessEnabled',true,'maxAutoOrderMyr',399,'fullCreditAccess',true),updated_at=now()
WHERE key='qr_checkout_config';
COMMIT;
