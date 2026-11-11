-- AffiMatik Final Commercial Release: one-time RM19 Launch Pack.
-- Additive catalogue extension; existing wallets, orders and subscriptions are untouched.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS orders_launch_pack_once_per_customer
 ON public.orders(user_id)
 WHERE plan_id='launch_pack' AND provisional_granted_at IS NOT NULL;

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
 IF p_plan_id='launch_pack' AND EXISTS(SELECT 1 FROM orders WHERE user_id=p_user_id AND plan_id='launch_pack' AND provisional_granted_at IS NOT NULL) THEN
  RETURN jsonb_build_object('success',false,'error','LAUNCH_PACK_ALREADY_PURCHASED');
 END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE workspace_id=p_workspace_id AND gateway_provider='qr_manual' AND status='PENDING'
   AND payment_state IN('PAYMENT_UNVERIFIED','PAYMENT_EVIDENCE_SUBMITTED','CREDITS_PROVISIONALLY_GRANTED','PROVISIONALLY_ACTIVE')) THEN
  RETURN jsonb_build_object('success',false,'error','UNRESOLVED_QR_ORDER_EXISTS');
 END IF;
 CASE p_plan_id
  WHEN 'launch_pack' THEN v_amount:=19;v_credits:=150;v_purchase:='LAUNCH_PACK';v_days:=180;v_name:='Launch Pack';
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
  jsonb_build_object('planName',v_name,'purchaseType',v_purchase,'creditValidityDays',v_days,'paymentAuthority','CUSTOMER_DECLARATION_UNVERIFIED','renewalType',CASE WHEN v_purchase='SUBSCRIPTION' THEN 'manual_30_day' ELSE 'none' END),
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
 IF v_order.plan_id='launch_pack' AND EXISTS(SELECT 1 FROM orders WHERE id<>p_order_id AND user_id=v_order.user_id AND plan_id='launch_pack' AND provisional_granted_at IS NOT NULL) THEN
  RETURN jsonb_build_object('success',false,'error','LAUNCH_PACK_ALREADY_PURCHASED');END IF;
 IF NOT((v_order.plan_id='launch_pack' AND v_order.amount_myr=19 AND v_order.credits_granted=150)OR
        (v_order.plan_id='plan_starter' AND v_order.amount_myr=49 AND v_order.credits_granted=500)OR
        (v_order.plan_id='plan_pro' AND v_order.amount_myr=129 AND v_order.credits_granted=2000)OR
        (v_order.plan_id='plan_agency' AND v_order.amount_myr=399 AND v_order.credits_granted=8000)OR
        (v_order.plan_id='topup_mini' AND v_order.amount_myr=15 AND v_order.credits_granted=100)OR
        (v_order.plan_id='topup_plus' AND v_order.amount_myr=34 AND v_order.credits_granted=300)OR
        (v_order.plan_id='topup_max' AND v_order.amount_myr=55 AND v_order.credits_granted=500)) THEN
  RETURN jsonb_build_object('success',false,'error','ORDER_CATALOG_MISMATCH');
 END IF;
 SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=v_order.workspace_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','WALLET_NOT_FOUND');END IF;
 v_source:=CASE WHEN v_order.plan_id LIKE 'topup_%' OR v_order.plan_id='launch_pack' THEN 'TOP_UP' ELSE 'SUBSCRIPTION' END;
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

REVOKE ALL ON FUNCTION public.create_qr_order_atomic(UUID,UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_qr_order_atomic(UUID,UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) TO service_role;

COMMIT;
