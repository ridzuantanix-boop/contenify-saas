import type { NextRequest } from 'next/server';

export const FOMO_CAMPAIGN_CODE = 'fomo_v1';
export const FOMO_VISITOR_COOKIE = 'affimatik_visitor';

export type FomoOfferState = {
  enabled: boolean;
  reason?: string;
  campaign_id?: string;
  campaign_code?: string;
  cohort?: 'OFFER' | 'CONTROL';
  server_now?: string;
  offer_expires_at?: string;
  campaign_ends_at?: string;
  base_credits?: number;
  bonus_credits?: number;
  total_credits?: number;
  amount_myr?: number;
  payment_reservation_hours?: number;
  claim?: { id: string; status: string; paymentExpiresAt: string; orderId?: string | null } | null;
};

function database() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('FOMO_DATABASE_UNAVAILABLE');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

export function fomoFeatureEnabled() {
  return process.env.FOMO_BONUS_V1_ENABLED === 'true';
}

export function visitorIdFromRequest(req: NextRequest) {
  const supplied = req.cookies.get(FOMO_VISITOR_COOKIE)?.value || '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export async function fomoRpc<T extends Record<string, unknown>>(name: string, body: Record<string, unknown>): Promise<T> {
  const { base, headers } = database();
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(`FOMO_RPC_${name}_HTTP_${response.status}`);
  return result;
}

export async function initializeFomoOffer(visitorId: string, userId?: string, utm: Record<string, string> = {}): Promise<FomoOfferState> {
  if (!fomoFeatureEnabled()) return { enabled: false, reason: 'FEATURE_OFF' };
  const state = await fomoRpc<FomoOfferState>('initialize_fomo_offer_v1', {
    p_visitor_id: visitorId,
    p_user_id: userId || null,
    p_utm: utm,
  });
  if (!state.enabled) return state;
  const { base, headers } = database();
  const response = await fetch(`${base}/rest/v1/fomo_bonus_claims?visitor_id=eq.${encodeURIComponent(visitorId)}&select=id,status,payment_expires_at,order_id&order=created_at.desc&limit=1`, { headers, cache: 'no-store' });
  if (response.ok) {
    const rows = await response.json() as Array<{ id: string; status: string; payment_expires_at: string; order_id?: string | null }>;
    state.claim = rows[0] ? { id: rows[0].id, status: rows[0].status, paymentExpiresAt: rows[0].payment_expires_at, orderId: rows[0].order_id } : null;
  }
  return state;
}

export async function claimFomoOffer(visitorId: string, userId?: string) {
  if (!fomoFeatureEnabled()) return { success: false, error: 'FEATURE_OFF' };
  return fomoRpc<Record<string, unknown>>('claim_fomo_bonus_v1', { p_visitor_id: visitorId, p_user_id: userId || null });
}

export async function recordFomoEvent(input: {
  visitorId: string;
  eventName: string;
  dedupeKey: string;
  campaignId?: string;
  userId?: string;
  workspaceId?: string;
  claimId?: string;
  orderId?: string;
  source?: 'web' | 'server';
  metadata?: Record<string, string | number | boolean | null>;
}) {
  if (!fomoFeatureEnabled()) return false;
  const { base, headers } = database();
  const allowed = Object.fromEntries(Object.entries(input.metadata || {}).filter(([key, value]) =>
    /^(placement|utmCampaign|utmContent|emailStatus|phoneCountry|reason)$/.test(key)
    && (value === null || ['string', 'number', 'boolean'].includes(typeof value))));
  const response = await fetch(`${base}/rest/v1/fomo_offer_events`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      campaign_id: input.campaignId || null,
      visitor_id: input.visitorId,
      user_id: input.userId || null,
      workspace_id: input.workspaceId || null,
      claim_id: input.claimId || null,
      order_id: input.orderId || null,
      event_name: input.eventName,
      dedupe_key: input.dedupeKey.slice(0, 180),
      source: input.source || 'web',
      metadata: allowed,
    }),
  });
  return response.ok || response.status === 409;
}

export async function reserveFomoAssistance(input: {
  visitorId: string; dedupeKey: string; campaignId?: string; userId?: string;
  workspaceId?: string; claimId?: string; testRequest: boolean; phoneCountry: string;
}) {
  const { base, headers } = database();
  const response = await fetch(`${base}/rest/v1/fomo_offer_events?select=dedupe_key`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      campaign_id: input.campaignId || null, visitor_id: input.visitorId,
      user_id: input.userId || null, workspace_id: input.workspaceId || null,
      claim_id: input.claimId || null, event_name: 'fomo_whatsapp_request',
      dedupe_key: input.dedupeKey, source: 'server',
      metadata: { emailStatus: 'PENDING', phoneCountry: input.phoneCountry,
        ...(input.testRequest ? { reason: 'production_test' } : {}) },
    }),
  });
  if (!response.ok) throw new Error(`FOMO_ASSIST_RESERVATION_HTTP_${response.status}`);
  const rows = await response.json() as Array<{ dedupe_key: string }>;
  return rows.length === 1;
}

export async function updateFomoAssistanceEmailStatus(dedupeKey: string, emailStatus: string, testRequest: boolean, phoneCountry: string) {
  const { base, headers } = database();
  const response = await fetch(`${base}/rest/v1/fomo_offer_events?dedupe_key=eq.${encodeURIComponent(dedupeKey)}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ metadata: { emailStatus, phoneCountry,
      ...(testRequest ? { reason: 'production_test' } : {}) } }),
  });
  if (!response.ok) throw new Error(`FOMO_ASSIST_STATUS_HTTP_${response.status}`);
}

export async function eligibleClaimForCheckout(visitorId: string, userId: string) {
  if (!fomoFeatureEnabled()) return null;
  const state = await initializeFomoOffer(visitorId, userId);
  if (!state.enabled || state.cohort !== 'OFFER' || !state.claim) return null;
  if (!['CLAIMED', 'ORDER_LINKED'].includes(state.claim.status) || new Date(state.claim.paymentExpiresAt).getTime() <= Date.now()) return null;
  return state.claim;
}

export async function getFomoAdminReport() {
  const { base, headers } = database();
  const [campaignResponse, eventResponse, claimResponse] = await Promise.all([
    fetch(`${base}/rest/v1/fomo_campaigns?code=eq.fomo_v1&select=*&limit=1`, { headers, cache: 'no-store' }),
    fetch(`${base}/rest/v1/fomo_offer_events?select=event_name,metadata&order=occurred_at.desc&limit=50000`, { headers, cache: 'no-store' }),
    fetch(`${base}/rest/v1/fomo_bonus_claims?select=status,bonus_credits,base_credits,amount_myr,payment_expires_at&limit=50000`, { headers, cache: 'no-store' }),
  ]);
  if (!campaignResponse.ok || !eventResponse.ok || !claimResponse.ok) throw new Error('FOMO_REPORT_UNAVAILABLE');
  const campaign = (await campaignResponse.json() as Array<Record<string, unknown>>)[0] || null;
  const events = await eventResponse.json() as Array<{ event_name: string; metadata?: { reason?: string } }>;
  const claims = await claimResponse.json() as Array<{ status: string; bonus_credits: number; base_credits: number; amount_myr: number; payment_expires_at: string }>;
  const eventCounts = Object.fromEntries(['fomo_offer_view','fomo_claim_success','fomo_claim_expired','fomo_whatsapp_request','fomo_checkout_start','fomo_receipt_uploaded','fomo_bonus_granted','fomo_purchase_confirmed'].map(name => [name, events.filter(event => event.event_name === name && event.metadata?.reason !== 'production_test').length]));
  const granted = claims.filter(claim => ['GRANTED','PURCHASE_CONFIRMED'].includes(claim.status));
  return {
    featureFlag: fomoFeatureEnabled(), campaign, events: eventCounts,
    claims: claims.length,
    expiredClaims: claims.filter(claim => claim.status === 'EXPIRED' || (['CLAIMED','ORDER_LINKED'].includes(claim.status) && new Date(claim.payment_expires_at).getTime() <= Date.now())).length,
    confirmedPurchases: claims.filter(claim => claim.status === 'PURCHASE_CONFIRMED').length,
    bonusCreditsGranted: granted.reduce((sum, claim) => sum + Number(claim.bonus_credits || 0), 0),
    conservativeBonusLiabilityMyr: Math.round((granted.reduce((sum, claim) => sum + Number(claim.bonus_credits || 0), 0) / 10) * 0.15 * 100) / 100,
  };
}
