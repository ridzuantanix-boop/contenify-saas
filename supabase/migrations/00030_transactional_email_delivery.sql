-- Durable, idempotent delivery state for transactional customer email.
-- Dashboard notifications remain authoritative and available even when email is down.
BEGIN;

ALTER TABLE public.customer_notifications
  ADD COLUMN IF NOT EXISTS email_attempts INT NOT NULL DEFAULT 0 CHECK (email_attempts >= 0),
  ADD COLUMN IF NOT EXISTS email_next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS email_last_error TEXT,
  ADD COLUMN IF NOT EXISTS email_dedupe_key TEXT;

ALTER TABLE public.customer_notifications
  DROP CONSTRAINT IF EXISTS customer_notifications_email_status_check;
ALTER TABLE public.customer_notifications
  ADD CONSTRAINT customer_notifications_email_status_check
  CHECK (email_status IN ('PENDING','SENDING','SENT','FAILED','NOT_CONFIGURED'));

CREATE UNIQUE INDEX IF NOT EXISTS customer_notifications_email_dedupe_unique
  ON public.customer_notifications(email_dedupe_key)
  WHERE email_dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_notifications_email_due
  ON public.customer_notifications(email_status,email_next_attempt_at,created_at)
  WHERE email_status IN ('PENDING','SENDING','FAILED','NOT_CONFIGURED');

CREATE OR REPLACE FUNCTION public.set_customer_notification_email_dedupe_key()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.related_order_id IS NOT NULL
     AND NEW.notification_type IN (
       'PAYMENT_DECLARATION_RECEIVED','PAYMENT_PROVISIONAL_ACTIVE','PAYMENT_CONFIRMED',
       'PAYMENT_REJECTED','PAYMENT_HOLD_RELEASED'
     ) THEN
    NEW.email_dedupe_key := NEW.notification_type || '/' || NEW.related_order_id::text;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customer_notification_email_dedupe ON public.customer_notifications;
CREATE TRIGGER customer_notification_email_dedupe
  BEFORE INSERT OR UPDATE OF related_order_id,notification_type
  ON public.customer_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_notification_email_dedupe_key();

CREATE OR REPLACE FUNCTION public.claim_customer_notification_emails(
  p_limit INT DEFAULT 20,
  p_lease_seconds INT DEFAULT 300
) RETURNS SETOF public.customer_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.customer_notifications
    WHERE notification_type IN (
      'PAYMENT_DECLARATION_RECEIVED','PAYMENT_PROVISIONAL_ACTIVE','PAYMENT_CONFIRMED',
      'PAYMENT_REJECTED','PAYMENT_HOLD_RELEASED'
    )
      AND email_status IN ('PENDING','SENDING','FAILED','NOT_CONFIGURED')
      AND email_attempts < 5
      AND COALESCE(email_next_attempt_at,created_at) <= now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit,1),100)
  )
  UPDATE public.customer_notifications n
  SET email_status='SENDING',
      email_attempts=n.email_attempts+1,
      email_last_attempt_at=now(),
      email_next_attempt_at=now()+make_interval(secs=>LEAST(GREATEST(p_lease_seconds,60),1800)),
      email_last_error=NULL
  FROM candidates c
  WHERE n.id=c.id
  RETURNING n.*;
END $$;

CREATE OR REPLACE FUNCTION public.finish_customer_notification_email(
  p_notification_id UUID,
  p_status TEXT,
  p_provider_id TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_next_attempt_at TIMESTAMPTZ DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_status NOT IN ('SENT','FAILED','NOT_CONFIGURED') THEN
    RAISE EXCEPTION 'INVALID_EMAIL_STATUS';
  END IF;
  UPDATE public.customer_notifications
  SET email_status=p_status,
      email_provider_id=left(nullif(p_provider_id,''),255),
      email_last_error=left(nullif(p_error,''),500),
      email_next_attempt_at=CASE WHEN p_status='SENT' THEN NULL ELSE p_next_attempt_at END
  WHERE id=p_notification_id;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.claim_customer_notification_emails(INT,INT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_customer_notification_email(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_notification_emails(INT,INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_customer_notification_email(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO service_role;

COMMIT;
