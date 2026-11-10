-- AffiMatik V7.2 pricing and ledger-backed credit buckets.
-- Existing wallet balances remain legacy/unbucketed and are never reclassified.
BEGIN;
CREATE TABLE IF NOT EXISTS public.credit_buckets(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 wallet_id UUID NOT NULL REFERENCES credit_wallets(id) ON DELETE CASCADE,order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
 source_type TEXT NOT NULL CHECK(source_type IN('SUBSCRIPTION','TOP_UP')),
 granted_credits INT NOT NULL CHECK(granted_credits>0),remaining_credits INT NOT NULL CHECK(remaining_credits>=0),
 reserved_credits INT NOT NULL DEFAULT 0 CHECK(reserved_credits>=0 AND reserved_credits<=remaining_credits),
 expires_at TIMESTAMPTZ,status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','DEPLETED','EXPIRED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(order_id)
);
CREATE TABLE IF NOT EXISTS public.credit_reservation_allocations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,bucket_id UUID REFERENCES credit_buckets(id) ON DELETE RESTRICT,
 source_type TEXT NOT NULL CHECK(source_type IN('SUBSCRIPTION','TOP_UP','LEGACY')),
 amount INT NOT NULL CHECK(amount>0),status TEXT NOT NULL DEFAULT 'RESERVED' CHECK(status IN('RESERVED','SETTLED','RELEASED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(job_id,bucket_id,source_type)
);
CREATE INDEX IF NOT EXISTS credit_buckets_spend_order ON credit_buckets(workspace_id,status,expires_at,created_at);
REVOKE ALL ON TABLE public.credit_buckets,public.credit_reservation_allocations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.credit_buckets,public.credit_reservation_allocations TO service_role;

CREATE OR REPLACE FUNCTION public.expire_credit_buckets_atomic(p_workspace_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_bucket RECORD; v_expire INT; v_total INT:=0;
BEGIN
 FOR v_bucket IN SELECT * FROM credit_buckets WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<=now()
   AND (p_workspace_id IS NULL OR workspace_id=p_workspace_id) FOR UPDATE SKIP LOCKED LOOP
   v_expire:=GREATEST(0,v_bucket.remaining_credits-v_bucket.reserved_credits);
   IF v_expire>0 THEN
     UPDATE credit_wallets SET balance=GREATEST(reserved_balance,balance-v_expire),updated_at=now() WHERE id=v_bucket.wallet_id;
     UPDATE credit_buckets SET remaining_credits=reserved_credits,status=CASE WHEN reserved_credits=0 THEN 'EXPIRED' ELSE 'ACTIVE' END,updated_at=now() WHERE id=v_bucket.id;
     v_total:=v_total+v_expire;
   ELSIF v_bucket.reserved_credits=0 THEN UPDATE credit_buckets SET status='EXPIRED',updated_at=now() WHERE id=v_bucket.id; END IF;
 END LOOP;
 RETURN jsonb_build_object('success',true,'expired_credits',v_total);
END $$;

CREATE OR REPLACE FUNCTION public.allocate_job_credit_buckets_atomic(p_workspace_id UUID,p_job_id UUID,p_amount INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_bucket RECORD;v_need INT:=p_amount;v_take INT;
BEGIN
 IF EXISTS(SELECT 1 FROM credit_reservation_allocations WHERE job_id=p_job_id) THEN RETURN jsonb_build_object('success',true,'idempotent',true); END IF;
 FOR v_bucket IN SELECT * FROM credit_buckets WHERE workspace_id=p_workspace_id AND status='ACTIVE'
   AND remaining_credits>reserved_credits AND (expires_at IS NULL OR expires_at>now())
   ORDER BY expires_at ASC NULLS LAST,created_at ASC FOR UPDATE LOOP
   EXIT WHEN v_need<=0; v_take:=LEAST(v_need,v_bucket.remaining_credits-v_bucket.reserved_credits);
   UPDATE credit_buckets SET reserved_credits=reserved_credits+v_take,updated_at=now() WHERE id=v_bucket.id;
   INSERT INTO credit_reservation_allocations(job_id,workspace_id,bucket_id,source_type,amount)
   VALUES(p_job_id,p_workspace_id,v_bucket.id,v_bucket.source_type,v_take);
   v_need:=v_need-v_take;
 END LOOP;
 IF v_need>0 THEN INSERT INTO credit_reservation_allocations(job_id,workspace_id,bucket_id,source_type,amount)
   VALUES(p_job_id,p_workspace_id,NULL,'LEGACY',v_need); END IF;
 RETURN jsonb_build_object('success',true,'allocated',p_amount,'legacy_amount',v_need);
END $$;

CREATE OR REPLACE FUNCTION public.admit_nexabot_job_to_queue_atomic(
 p_workspace_id UUID,p_user_id UUID,p_job_id UUID,p_client_request_id VARCHAR,p_preset_id VARCHAR,
 p_preset_version INT,p_provider VARCHAR,p_duration_seconds INT,p_required_credits INT,p_max_concurrency INT,
 p_compiled_prompt TEXT,p_input_options JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result JSONB;v_sequence BIGINT;
BEGIN
 PERFORM expire_credit_buckets_atomic(p_workspace_id);
 SELECT public.admit_video_job_atomic(p_workspace_id,p_user_id,p_job_id,p_client_request_id,p_preset_id,p_preset_version,
   p_provider,p_duration_seconds,p_required_credits,p_max_concurrency,p_compiled_prompt,p_input_options) INTO v_result;
 IF COALESCE((v_result->>'success')::boolean,false) IS NOT TRUE OR COALESCE((v_result->>'is_duplicate')::boolean,false) IS TRUE THEN RETURN v_result; END IF;
 PERFORM allocate_job_credit_buckets_atomic(p_workspace_id,p_job_id,p_required_credits);
 IF p_provider='nexabot' THEN v_sequence:=nextval('public.video_job_queue_sequence');
   UPDATE video_jobs SET status='QUEUED',queue_sequence=v_sequence,enqueued_at=now(),next_dispatch_at=now(),provider_model_id='376',raw_status='QUEUE_WAITING',updated_at=now() WHERE id=p_job_id;
   v_result:=v_result||jsonb_build_object('status','QUEUED','queue_sequence',v_sequence);
 END IF;
 RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.settle_credits_atomic(p_workspace_id UUID,p_job_id UUID,p_amount INT,p_idempotency_key VARCHAR,p_description TEXT DEFAULT 'Settlement for completed video job')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_wallet RECORD;v_res RECORD;v_alloc RECORD;
BEGIN
 IF EXISTS(SELECT 1 FROM credit_ledger WHERE idempotency_key=p_idempotency_key) THEN RETURN jsonb_build_object('success',true,'idempotent',true); END IF;
 SELECT * INTO v_res FROM credit_reservations WHERE job_id=p_job_id AND workspace_id=p_workspace_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Tiada rekod tempahan kredit ditemui untuk tugasan ini.'); END IF;
 IF v_res.status='SETTLED' THEN RETURN jsonb_build_object('success',true,'idempotent',true); END IF;
 IF v_res.status='RELEASED' THEN RETURN jsonb_build_object('success',false,'error','Tempahan kredit ini telah dilepaskan/dibatalkan dan tidak boleh diselesaikan.'); END IF;
 IF v_res.status<>'PENDING' OR v_res.amount<>p_amount THEN RETURN jsonb_build_object('success',false,'error','Jumlah penyelesaian tidak sepadan dengan tempahan asal.'); END IF;
 SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=p_workspace_id FOR UPDATE;
 IF NOT FOUND OR v_wallet.balance<p_amount OR v_wallet.reserved_balance<p_amount THEN RETURN jsonb_build_object('success',false,'error','WALLET_INTEGRITY_FAILURE'); END IF;
 FOR v_alloc IN SELECT * FROM credit_reservation_allocations WHERE job_id=p_job_id AND status='RESERVED' FOR UPDATE LOOP
   IF v_alloc.bucket_id IS NOT NULL THEN UPDATE credit_buckets SET remaining_credits=remaining_credits-v_alloc.amount,
     reserved_credits=reserved_credits-v_alloc.amount,status=CASE WHEN remaining_credits-v_alloc.amount=0 THEN 'DEPLETED' ELSE status END,updated_at=now() WHERE id=v_alloc.bucket_id; END IF;
 END LOOP;
 UPDATE credit_reservation_allocations SET status='SETTLED',updated_at=now() WHERE job_id=p_job_id AND status='RESERVED';
 UPDATE credit_wallets SET balance=balance-p_amount,reserved_balance=reserved_balance-p_amount,lifetime_spent=lifetime_spent+p_amount,updated_at=now() WHERE id=v_wallet.id;
 UPDATE credit_reservations SET status='SETTLED',settled_at=now() WHERE job_id=p_job_id;
 INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description)
 VALUES(p_workspace_id,v_wallet.id,-p_amount,'SETTLE','VIDEO_JOB',p_job_id,p_idempotency_key,p_description);
 RETURN jsonb_build_object('success',true,'settled_amount',p_amount);
END $$;

CREATE OR REPLACE FUNCTION public.release_credits_atomic(p_workspace_id UUID,p_job_id UUID,p_idempotency_key VARCHAR,p_description TEXT DEFAULT 'Release reservation for failed job')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_wallet RECORD;v_res RECORD;v_alloc RECORD;v_expired INT:=0;
BEGIN
 IF EXISTS(SELECT 1 FROM credit_ledger WHERE idempotency_key=p_idempotency_key) THEN RETURN jsonb_build_object('success',true,'idempotent',true); END IF;
 SELECT * INTO v_res FROM credit_reservations WHERE job_id=p_job_id AND workspace_id=p_workspace_id FOR UPDATE;
 IF NOT FOUND OR v_res.status<>'PENDING' THEN RETURN jsonb_build_object('success',true,'message','NO_ACTIVE_RESERVATION'); END IF;
 SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=p_workspace_id FOR UPDATE;
 FOR v_alloc IN SELECT a.*,b.expires_at FROM credit_reservation_allocations a LEFT JOIN credit_buckets b ON b.id=a.bucket_id
   WHERE a.job_id=p_job_id AND a.status='RESERVED' FOR UPDATE OF a LOOP
   IF v_alloc.bucket_id IS NOT NULL THEN
     IF v_alloc.expires_at IS NOT NULL AND v_alloc.expires_at<=now() THEN
       UPDATE credit_buckets SET remaining_credits=remaining_credits-v_alloc.amount,reserved_credits=reserved_credits-v_alloc.amount,
         status=CASE WHEN remaining_credits-v_alloc.amount=0 THEN 'EXPIRED' ELSE status END,updated_at=now() WHERE id=v_alloc.bucket_id;
       v_expired:=v_expired+v_alloc.amount;
     ELSE UPDATE credit_buckets SET reserved_credits=reserved_credits-v_alloc.amount,updated_at=now() WHERE id=v_alloc.bucket_id; END IF;
   END IF;
 END LOOP;
 UPDATE credit_reservation_allocations SET status='RELEASED',updated_at=now() WHERE job_id=p_job_id AND status='RESERVED';
 UPDATE credit_wallets SET balance=balance-v_expired,reserved_balance=GREATEST(0,reserved_balance-v_res.amount),updated_at=now() WHERE id=v_wallet.id;
 UPDATE credit_reservations SET status='RELEASED' WHERE job_id=p_job_id;
 INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description,metadata)
 VALUES(p_workspace_id,v_wallet.id,v_res.amount-v_expired,'RELEASE','VIDEO_JOB',p_job_id,p_idempotency_key,p_description,jsonb_build_object('expired_while_reserved',v_expired));
 RETURN jsonb_build_object('success',true,'released_amount',v_res.amount-v_expired,'expired_amount',v_expired);
END $$;

CREATE OR REPLACE FUNCTION public.provision_qr_order_atomic(p_order_id UUID,p_receipt_sha256 TEXT,p_receipt_object_key TEXT,p_receipt_mime_type TEXT,p_receipt_size_bytes BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD;
BEGIN
 IF p_receipt_sha256 !~ '^[a-f0-9]{64}$' OR COALESCE(p_receipt_object_key,'')='' OR p_receipt_size_bytes<1 OR p_receipt_size_bytes>5242880 THEN RETURN jsonb_build_object('success',false,'error','INVALID_PAYMENT_EVIDENCE'); END IF;
 SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.gateway_provider<>'qr_manual' THEN RETURN jsonb_build_object('success',false,'error','QR_ORDER_NOT_FOUND'); END IF;
 IF v_order.payment_state='BANK_PAYMENT_VERIFIED' THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'payment_state',v_order.payment_state); END IF;
 IF v_order.receipt_sha256=p_receipt_sha256 AND v_order.payment_state IN('PAYMENT_EVIDENCE_SUBMITTED','PAYMENT_UNVERIFIED') THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'provisional_granted',false,'payment_state',v_order.payment_state); END IF;
 IF v_order.status<>'PENDING' OR v_order.receipt_sha256 IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error','ORDER_ALREADY_SUBMITTED'); END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE receipt_sha256=p_receipt_sha256 AND id<>p_order_id) THEN RETURN jsonb_build_object('success',false,'error','RECEIPT_ALREADY_USED'); END IF;
 UPDATE orders SET payment_state='PAYMENT_EVIDENCE_SUBMITTED',receipt_sha256=p_receipt_sha256,receipt_object_key=p_receipt_object_key,
   receipt_mime_type=p_receipt_mime_type,receipt_size_bytes=p_receipt_size_bytes,evidence_submitted_at=now(),
   metadata=COALESCE(metadata,'{}'::jsonb)||'{"payment_evidence_authority":"UNVERIFIED_CUSTOMER_UPLOAD","automatic_credit_grant":false}'::jsonb WHERE id=p_order_id;
 RETURN jsonb_build_object('success',true,'provisional_granted',false,'order_id',p_order_id,'payment_state','PAYMENT_EVIDENCE_SUBMITTED','requires_bank_verification',true);
END $$;

CREATE OR REPLACE FUNCTION public.settle_verified_order_v72_atomic(p_order_id UUID,p_bank_reference TEXT,p_admin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD;v_wallet RECORD;v_is_topup BOOLEAN;v_sub RECORD;v_tier TEXT;v_balance INT;v_aff RECORD;v_comm NUMERIC(10,2);v_ref_type TEXT;
BEGIN
 IF nullif(trim(p_bank_reference),'') IS NULL THEN RETURN jsonb_build_object('success',false,'error','BANK_REFERENCE_REQUIRED'); END IF;
 SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','ORDER_NOT_FOUND'); END IF;
 IF v_order.status IN('REFUNDED','CANCELLED','FAILED') THEN RETURN jsonb_build_object('success',false,'error','ORDER_NOT_SETTLEABLE'); END IF;
 IF v_order.status='PAID' AND v_order.payment_state='BANK_PAYMENT_VERIFIED' THEN SELECT balance INTO v_balance FROM credit_wallets WHERE workspace_id=v_order.workspace_id;RETURN jsonb_build_object('success',true,'idempotent_replay',true,'balance',v_balance); END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE id<>p_order_id AND status='PAID' AND gateway_reference=p_bank_reference) THEN RETURN jsonb_build_object('success',false,'error','BANK_REFERENCE_ALREADY_USED'); END IF;
 v_is_topup:=v_order.plan_id LIKE 'topup_%';
 IF v_is_topup THEN SELECT * INTO v_sub FROM subscriptions WHERE workspace_id=v_order.workspace_id AND status='active' AND current_period_end>now() FOR UPDATE;
   IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','TOPUP_REQUIRES_ACTIVE_PAID_SUBSCRIPTION'); END IF;
 END IF;
 SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=v_order.workspace_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','WALLET_NOT_FOUND'); END IF;
 UPDATE credit_wallets SET balance=balance+v_order.credits_granted,lifetime_granted=lifetime_granted+v_order.credits_granted,updated_at=now() WHERE id=v_wallet.id RETURNING balance INTO v_balance;
 v_ref_type:=CASE WHEN v_is_topup THEN 'TOP_UP' ELSE 'SUBSCRIPTION' END;
 INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description,metadata)
 VALUES(v_order.workspace_id,v_wallet.id,v_order.credits_granted,'GRANT',v_ref_type,v_order.id,'ord_v72_verified_'||v_order.id::text,
   CASE WHEN v_is_topup THEN 'Verified 180-day top-up credits' ELSE 'Verified monthly plan credits' END,jsonb_build_object('bank_reference',p_bank_reference)) ON CONFLICT(idempotency_key) DO NOTHING;
 INSERT INTO credit_buckets(workspace_id,wallet_id,order_id,source_type,granted_credits,remaining_credits,expires_at)
 VALUES(v_order.workspace_id,v_wallet.id,v_order.id,CASE WHEN v_is_topup THEN 'TOP_UP' ELSE 'SUBSCRIPTION' END,v_order.credits_granted,v_order.credits_granted,
   CASE WHEN v_is_topup THEN now()+interval '180 days' ELSE NULL END) ON CONFLICT(order_id) DO NOTHING;
 UPDATE orders SET status='PAID',payment_state='BANK_PAYMENT_VERIFIED',gateway_reference=p_bank_reference,paid_at=now(),bank_verified_at=now(),
   metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('bank_verified_by',p_admin,'bank_verified',true,'purchase_type',v_ref_type) WHERE id=p_order_id;
 IF NOT v_is_topup THEN v_tier:=CASE WHEN v_order.plan_id='plan_agency' THEN 'agency' WHEN v_order.plan_id='plan_pro' THEN 'pro' ELSE 'starter' END;
   UPDATE profiles SET tier=v_tier WHERE id=v_order.user_id;
   INSERT INTO subscriptions(workspace_id,user_id,plan_id,tier,status,current_period_start,current_period_end,updated_at)
   VALUES(v_order.workspace_id,v_order.user_id,v_order.plan_id,v_tier,'active',now(),now()+interval '30 days',now())
   ON CONFLICT(workspace_id) DO UPDATE SET plan_id=excluded.plan_id,tier=excluded.tier,status='active',current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=now();
   IF v_order.referral_code IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.workspace_id=v_order.workspace_id AND o.status='PAID' AND o.id<>v_order.id AND o.plan_id LIKE 'plan_%') THEN
     SELECT * INTO v_aff FROM affiliate_partners WHERE referral_code=v_order.referral_code AND status='APPROVED' AND user_id<>v_order.user_id;
     IF FOUND THEN v_comm:=round(v_order.amount_myr*0.10,2);INSERT INTO affiliate_commissions(affiliate_id,order_id,workspace_id,amount_myr,rate_percentage,status,available_at)
       VALUES(v_aff.id,v_order.id,v_order.workspace_id,v_comm,10,'PENDING',now()+interval '14 days') ON CONFLICT(order_id) DO NOTHING;END IF;
   END IF;
 END IF;
 INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details) VALUES(p_admin,'V72_BANK_PAYMENT_VERIFIED','ORDER',p_order_id::text,'ORDER',p_order_id::text,jsonb_build_object('purchase_type',v_ref_type,'credits',v_order.credits_granted));
 RETURN jsonb_build_object('success',true,'order_id',p_order_id,'payment_state','BANK_PAYMENT_VERIFIED','balance',v_balance,'credits_granted',v_order.credits_granted,'purchase_type',v_ref_type);
END $$;

CREATE OR REPLACE FUNCTION public.verify_qr_order_payment_atomic(p_order_id UUID,p_bank_reference TEXT,p_admin TEXT)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT settle_verified_order_v72_atomic(p_order_id,p_bank_reference,p_admin); $$;
CREATE OR REPLACE FUNCTION public.settle_order_payment_atomic(p_order_id UUID,p_gateway_reference VARCHAR DEFAULT NULL,p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT settle_verified_order_v72_atomic(p_order_id,COALESCE(p_gateway_reference,'verified-'||p_order_id::text),COALESCE(p_metadata->>'verifiedByAdmin','service-role')); $$;

REVOKE ALL ON FUNCTION public.expire_credit_buckets_atomic(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.allocate_job_credit_buckets_atomic(UUID,UUID,INT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.settle_verified_order_v72_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_credit_buckets_atomic(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.allocate_job_credit_buckets_atomic(UUID,UUID,INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_verified_order_v72_atomic(UUID,TEXT,TEXT) TO service_role;
COMMIT;
