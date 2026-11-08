-- Refunds revoke unspent purchased credits and hold further generation for any shortfall.
-- Existing balances and prior refunds are left intact; no historical data is rewritten.
BEGIN;

CREATE TABLE IF NOT EXISTS public.credit_refund_debts (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  original_credits INT NOT NULL CHECK (original_credits > 0),
  outstanding_credits INT NOT NULL CHECK (outstanding_credits >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recovered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS credit_refund_debts_workspace ON public.credit_refund_debts(workspace_id) WHERE outstanding_credits > 0;
ALTER TABLE public.credit_refund_debts ENABLE ROW LEVEL SECURITY;
-- A bank/gateway reference may settle only one order. Existing duplicates must be
-- reconciled before this migration; it deliberately refuses to rewrite history.
CREATE UNIQUE INDEX IF NOT EXISTS paid_orders_gateway_reference_once
ON public.orders(gateway_reference) WHERE status='PAID' AND gateway_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reverse_affiliate_commission_atomic(p_order_id UUID, p_admin TEXT, p_reason TEXT, p_refund_reference TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order RECORD; v_commission RECORD; v_wallet RECORD; v_revoke INT; v_shortfall INT;
BEGIN
  IF nullif(trim(p_refund_reference),'') IS NULL OR nullif(trim(p_reason),'') IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Verified refund reference and reason required');
  END IF;
  SELECT * INTO v_order FROM orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status NOT IN ('PAID','REFUNDED') THEN
    RETURN jsonb_build_object('success',false,'error','Paid order not found');
  END IF;
  IF v_order.status='REFUNDED' THEN
    RETURN jsonb_build_object('success',true,'idempotent_replay',true,'order_id',p_order_id);
  END IF;
  SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=v_order.workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet missing for paid order %',p_order_id; END IF;
  v_revoke := LEAST(v_order.credits_granted,GREATEST(0,v_wallet.balance-v_wallet.reserved_balance));
  v_shortfall := v_order.credits_granted-v_revoke;
  IF v_revoke > 0 THEN
    UPDATE credit_wallets SET balance=balance-v_revoke,updated_at=now() WHERE id=v_wallet.id;
    INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description)
    VALUES(v_order.workspace_id,v_wallet.id,-v_revoke,'MANUAL_ADJUSTMENT','SUBSCRIPTION',p_order_id,
      'ord_refund_'||p_order_id::text,'Purchased credits revoked after verified refund');
  END IF;
  IF v_shortfall > 0 THEN
    INSERT INTO credit_refund_debts(order_id,workspace_id,original_credits,outstanding_credits)
    VALUES(p_order_id,v_order.workspace_id,v_order.credits_granted,v_shortfall);
  END IF;
  SELECT * INTO v_commission FROM affiliate_commissions WHERE order_id=p_order_id FOR UPDATE;
  IF v_commission.status='PAID' THEN
    INSERT INTO affiliate_clawbacks(affiliate_id,order_id,amount_myr)
    VALUES(v_commission.affiliate_id,p_order_id,v_commission.amount_myr) ON CONFLICT(order_id) DO NOTHING;
  END IF;
  UPDATE orders SET status='REFUNDED',metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object(
    'refund_reason',p_reason,'refund_reference',p_refund_reference,'refund_recorded_by',p_admin,'refunded_at',now(),
    'credits_revoked',v_revoke,'credit_debt',v_shortfall) WHERE id=p_order_id;
  IF v_commission.id IS NOT NULL AND v_commission.status<>'PAID' THEN
    UPDATE affiliate_commissions SET status='REVERSED' WHERE id=v_commission.id AND status<>'REVERSED';
    IF v_commission.payout_request_id IS NOT NULL THEN
      UPDATE affiliate_payout_requests SET status='CANCELLED',reviewed_at=now(),reviewed_by=p_admin
      WHERE id=v_commission.payout_request_id AND status IN ('REQUESTED','APPROVED');
      UPDATE affiliate_commissions SET payout_request_id=NULL,status='APPROVED'
      WHERE payout_request_id=v_commission.payout_request_id AND id<>v_commission.id AND status='PAYABLE';
    END IF;
  END IF;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
  VALUES(p_admin,'ORDER_REFUND','ORDER',p_order_id::text,'ORDER',p_order_id::text,
    jsonb_build_object('reason',p_reason,'reference',p_refund_reference,'commission_id',v_commission.id,
      'credits_revoked',v_revoke,'credit_debt',v_shortfall));
  RETURN jsonb_build_object('success',true,'order_id',p_order_id,'credits_revoked',v_revoke,'credit_debt',v_shortfall,
    'commission_reversed',v_commission.id IS NOT NULL AND v_commission.status<>'PAID','clawback_open',v_commission.status='PAID');
END $$;
REVOKE ALL ON FUNCTION public.reverse_affiliate_commission_atomic(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_affiliate_commission_atomic(UUID,TEXT,TEXT,TEXT) TO service_role;

-- Patch only the reviewed function bodies, failing migration if production differs.
DO $guard$
DECLARE v_sql TEXT; v_old TEXT;
BEGIN
  SELECT pg_get_functiondef('public.settle_order_payment_atomic(uuid,character varying,jsonb)'::regprocedure) INTO v_sql;
  v_old := 'IF v_order.status = ''PAID'' THEN';
  IF position(v_old IN v_sql)=0 THEN RAISE EXCEPTION 'Settlement function changed; review required'; END IF;
  IF position('Order is not pending' IN v_sql)=0 THEN
    v_sql := replace(v_sql,v_old,'IF v_order.status NOT IN (''PENDING'',''PAID'') THEN RETURN jsonb_build_object(''success'',false,''error'',''Order is not pending''); END IF;'||E'\n    '||v_old);
  END IF;
  IF position('10 + v_order.credits_granted' IN v_sql)>0 AND position('v_wallet.id, 10, ''GRANT''' IN v_sql)>0 THEN
    v_sql := replace(v_sql,'10 + v_order.credits_granted','20 + v_order.credits_granted');
    v_sql := replace(v_sql,'v_wallet.id, 10, ''GRANT''','v_wallet.id, 20, ''GRANT''');
  ELSIF position('20 + v_order.credits_granted' IN v_sql)=0 OR position('v_wallet.id, 20, ''GRANT''' IN v_sql)=0 THEN
    RAISE EXCEPTION 'Fallback welcome grant changed; review required';
  END IF;
  EXECUTE v_sql;

  SELECT pg_get_functiondef('public.admit_video_job_atomic(uuid,uuid,uuid,character varying,character varying,integer,character varying,integer,integer,integer,text,jsonb)'::regprocedure) INTO v_sql;
  v_old := 'v_available := v_wallet.balance - v_wallet.reserved_balance;';
  IF position(v_old IN v_sql)=0 THEN RAISE EXCEPTION 'Job admission function changed; review required'; END IF;
  IF position('Refund credit debt must be settled before new generation' IN v_sql)=0 THEN
    v_sql := replace(v_sql,v_old,
      'IF EXISTS (SELECT 1 FROM credit_refund_debts WHERE workspace_id=p_workspace_id AND outstanding_credits>0) THEN RETURN jsonb_build_object(''success'',false,''error'',''Refund credit debt must be settled before new generation''); END IF;'||E'\n    '||v_old);
  END IF;
  EXECUTE v_sql;
END $guard$;

CREATE OR REPLACE FUNCTION public.recover_credit_refund_debt_atomic(p_order_id UUID,p_admin TEXT,p_reference TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_debt RECORD; v_wallet RECORD;
BEGIN
  IF nullif(trim(p_reference),'') IS NULL THEN RETURN jsonb_build_object('success',false,'error','Recovery reference required'); END IF;
  SELECT * INTO v_debt FROM credit_refund_debts WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Debt not found'); END IF;
  IF v_debt.outstanding_credits=0 THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true); END IF;
  SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=v_debt.workspace_id FOR UPDATE;
  IF v_wallet.balance-v_wallet.reserved_balance < v_debt.outstanding_credits THEN
    RETURN jsonb_build_object('success',false,'error','Insufficient unreserved balance to recover debt');
  END IF;
  UPDATE credit_wallets SET balance=balance-v_debt.outstanding_credits,updated_at=now() WHERE id=v_wallet.id;
  INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description)
  VALUES(v_debt.workspace_id,v_wallet.id,-v_debt.outstanding_credits,'MANUAL_ADJUSTMENT','SUBSCRIPTION',p_order_id,
    'ord_refund_debt_'||p_order_id::text,'Refund credit debt recovered');
  UPDATE credit_refund_debts SET outstanding_credits=0,recovered_at=now() WHERE order_id=p_order_id;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
  VALUES(p_admin,'CREDIT_REFUND_DEBT_RECOVERED','ORDER',p_order_id::text,'ORDER',p_order_id::text,
    jsonb_build_object('reference',p_reference,'credits',v_debt.outstanding_credits));
  RETURN jsonb_build_object('success',true,'credits_recovered',v_debt.outstanding_credits);
END $$;
REVOKE ALL ON FUNCTION public.recover_credit_refund_debt_atomic(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_credit_refund_debt_atomic(UUID,TEXT,TEXT) TO service_role;
COMMIT;
