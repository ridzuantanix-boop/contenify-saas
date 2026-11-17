-- Opt-in, first-party interaction coordinates for the public AffiMatik sales page.
-- No text, form values, IP addresses or account identifiers are stored.
CREATE TABLE IF NOT EXISTS public.salespage_heatmap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  event_seq SMALLINT NOT NULL CHECK (event_seq BETWEEN 1 AND 40),
  kind TEXT NOT NULL CHECK (kind IN ('click', 'scroll')),
  device TEXT NOT NULL CHECK (device IN ('mobile', 'desktop')),
  x_pct NUMERIC(6,5) CHECK (x_pct BETWEEN 0 AND 1),
  y_pct NUMERIC(6,5) CHECK (y_pct BETWEEN 0 AND 1),
  scroll_pct SMALLINT CHECK (scroll_pct IN (25, 50, 75, 90, 100)),
  target_type TEXT CHECK (target_type IN ('link', 'button', 'video', 'other')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, event_seq),
  CHECK ((kind = 'click' AND x_pct IS NOT NULL AND y_pct IS NOT NULL AND scroll_pct IS NULL)
      OR (kind = 'scroll' AND scroll_pct IS NOT NULL AND x_pct IS NULL AND y_pct IS NULL))
);
CREATE INDEX IF NOT EXISTS salespage_heatmap_events_recent
  ON public.salespage_heatmap_events (occurred_at DESC, device);
ALTER TABLE public.salespage_heatmap_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.salespage_heatmap_events FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.salespage_heatmap_events TO service_role;
