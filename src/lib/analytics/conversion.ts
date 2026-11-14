export const CONVERSION_EVENTS = [
  'landing_view',
  'demo_play',
  'launch_cta_click',
  'registration_started',
  'registration_completed',
  'email_verified',
  'launch_checkout_started',
  'qr_evidence_submitted',
  'credits_provisionally_activated',
  'payment_bank_verified',
  'first_video_completed',
] as const;

export type ConversionEvent = (typeof CONVERSION_EVENTS)[number];

export const CLIENT_CONVERSION_EVENTS = new Set<ConversionEvent>([
  'landing_view',
  'demo_play',
  'launch_cta_click',
  'registration_started',
  'registration_completed',
  'email_verified',
  'launch_checkout_started',
]);

type SafeMetadata = Record<string, string | number | boolean | null>;

function safeMetadata(metadata: SafeMetadata = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) =>
    /^(placement|demoId|planId|source|provider|styleId)$/.test(key)
    && (value === null || ['string', 'number', 'boolean'].includes(typeof value))));
}

export function trackConversion(eventName: ConversionEvent, dedupeKey: string, metadata: SafeMetadata = {}) {
  if (typeof window === 'undefined' || !CLIENT_CONVERSION_EVENTS.has(eventName)) return;
  const normalizedKey = dedupeKey.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120);
  const storageKey = `affimatik:event:${eventName}:${normalizedKey}`;
  if (window.sessionStorage.getItem(storageKey)) return;
  window.sessionStorage.setItem(storageKey, 'pending');
  const payload = JSON.stringify({ eventName, dedupeKey: normalizedKey, metadata: safeMetadata(metadata) });
  void fetch('/api/analytics/conversion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).then(response => {
    if (response.ok) window.sessionStorage.setItem(storageKey, 'sent');
    else window.sessionStorage.removeItem(storageKey);
  }).catch(() => window.sessionStorage.removeItem(storageKey));
}

export async function recordServerConversion(input: {
  eventName: Exclude<ConversionEvent, 'landing_view' | 'demo_play' | 'launch_cta_click' | 'registration_started' | 'registration_completed' | 'email_verified' | 'launch_checkout_started'>;
  dedupeKey: string;
  userId?: string;
  workspaceId?: string;
  metadata?: SafeMetadata;
}) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return false;
  const response = await fetch(`${base}/rest/v1/conversion_events`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({
      event_name: input.eventName,
      event_id: crypto.randomUUID(),
      dedupe_key: input.dedupeKey.slice(0, 160),
      user_id: input.userId || null,
      workspace_id: input.workspaceId || null,
      source: 'server',
      metadata: safeMetadata(input.metadata),
    }),
  });
  return response.ok;
}
