-- Privacy-conscious first-party sales funnel events. No email, password,
-- receipt content, WhatsApp number or payment credentials are stored here.
CREATE TABLE IF NOT EXISTS public.conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL CHECK (event_name IN (
    'landing_view','demo_play','launch_cta_click','registration_started','registration_completed',
    'email_verified','launch_checkout_started','qr_evidence_submitted','credits_provisionally_activated',
    'payment_bank_verified','first_video_completed'
  )),
  event_id UUID NOT NULL UNIQUE,
  dedupe_key TEXT NOT NULL,
  visitor_id UUID,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('web','server')),
  path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_name, dedupe_key)
);
CREATE INDEX IF NOT EXISTS conversion_events_occurred_at ON public.conversion_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS conversion_events_workspace ON public.conversion_events(workspace_id, occurred_at DESC) WHERE workspace_id IS NOT NULL;
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversion_events FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.conversion_events TO service_role;
