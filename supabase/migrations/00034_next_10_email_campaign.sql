-- AffiMatik THE NEXT 10: durable, consent-aware marketing email delivery.
BEGIN;

CREATE TABLE IF NOT EXISTS public.email_marketing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL UNIQUE CHECK (email_hash ~ '^[a-f0-9]{64}$'),
  marketing_enabled BOOLEAN NOT NULL DEFAULT true,
  unsubscribe_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  unsubscribed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'EXISTING_ACCOUNT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email_hash TEXT PRIMARY KEY CHECK (email_hash ~ '^[a-f0-9]{64}$'),
  reason TEXT NOT NULL CHECK (reason IN ('BOUNCE','COMPLAINT','PROVIDER','INVALID','MANUAL')),
  provider_source_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','TESTED','APPROVED','SENDING','PAUSED','COMPLETED','FAILED')),
  poster_path TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 0,
  excluded_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  suppressed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_hash TEXT NOT NULL CHECK (email_hash ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','EXCLUDED','ACCEPTED','DELIVERED','BOUNCED','SUPPRESSED','FAILED')),
  exclusion_reason TEXT,
  provider_email_id TEXT,
  batch_number INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,email_hash)
);
CREATE UNIQUE INDEX IF NOT EXISTS email_campaign_provider_id_unique
  ON public.email_campaign_recipients(provider_email_id) WHERE provider_email_id IS NOT NULL;

ALTER TABLE public.email_marketing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_marketing_preferences,public.email_suppressions,public.email_campaigns,public.email_campaign_recipients FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.email_marketing_preferences,public.email_suppressions,public.email_campaigns,public.email_campaign_recipients TO service_role;

CREATE OR REPLACE FUNCTION public.unsubscribe_marketing_email_v1(p_token UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id UUID;
BEGIN
  UPDATE email_marketing_preferences
     SET marketing_enabled=false,unsubscribed_at=coalesce(unsubscribed_at,now()),updated_at=now()
   WHERE unsubscribe_token=p_token
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','INVALID_TOKEN'); END IF;
  RETURN jsonb_build_object('success',true,'unsubscribed',true);
END $$;
REVOKE ALL ON FUNCTION public.unsubscribe_marketing_email_v1(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_marketing_email_v1(UUID) TO service_role;

COMMIT;
