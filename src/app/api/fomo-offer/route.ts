import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { claimFomoOffer, FOMO_VISITOR_COOKIE, initializeFomoOffer, recordFomoEvent, visitorIdFromRequest } from '@/lib/billing/fomo-bonus';

function setVisitorCookie(response: NextResponse, visitorId: string, supplied: string | undefined) {
  if (visitorId !== supplied) response.cookies.set(FOMO_VISITOR_COOKIE, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 180 * 24 * 60 * 60 });
}

export async function GET(req: NextRequest) {
  const visitorId = visitorIdFromRequest(req);
  const supplied = req.cookies.get(FOMO_VISITOR_COOKIE)?.value;
  const session = await getSessionFromRequest(req).catch(() => null);
  const utm = {
    utmCampaign: req.cookies.get('affimatik_campaign')?.value?.slice(0, 100) || '',
    utmContent: req.cookies.get('affimatik_content')?.value?.slice(0, 100) || '',
  };
  try {
    const state = await initializeFomoOffer(visitorId, session?.userId, utm);
    if (state.enabled && state.cohort === 'OFFER' && state.campaign_id) {
      await recordFomoEvent({ visitorId, userId: session?.userId, workspaceId: session?.workspaceId, campaignId: state.campaign_id, eventName: 'fomo_offer_view', dedupeKey: `offer_view:${state.campaign_id}:${visitorId}`, metadata: { placement: 'salespage', ...utm } }).catch(() => false);
    }
    const response = NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
    setVisitorCookie(response, visitorId, supplied);
    return response;
  } catch {
    const response = NextResponse.json({ enabled: false, reason: 'OFFER_UNAVAILABLE' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    setVisitorCookie(response, visitorId, supplied);
    return response;
  }
}

export async function POST(req: NextRequest) {
  const visitorId = visitorIdFromRequest(req);
  const supplied = req.cookies.get(FOMO_VISITOR_COOKIE)?.value;
  const session = await getSessionFromRequest(req).catch(() => null);
  const body = await req.json().catch(() => ({})) as { action?: string };
  if (body.action !== 'claim') return NextResponse.json({ error: 'Tindakan tidak sah.' }, { status: 400 });
  try {
    const state = await initializeFomoOffer(visitorId, session?.userId);
    if (!state.enabled || state.cohort !== 'OFFER') return NextResponse.json({ error: 'Tawaran tidak tersedia untuk sesi ini.', code: state.reason || 'NOT_ELIGIBLE' }, { status: 409 });
    await recordFomoEvent({ visitorId, userId: session?.userId, workspaceId: session?.workspaceId, campaignId: state.campaign_id, eventName: 'fomo_claim_click', dedupeKey: `claim_click:${state.campaign_id}:${visitorId}`, metadata: { placement: 'salespage' } }).catch(() => false);
    const result = await claimFomoOffer(visitorId, session?.userId);
    if (result.success !== true) return NextResponse.json({ error: result.error || 'Bonus tidak dapat diclaim.', code: result.error }, { status: 409 });
    const response = NextResponse.json(result);
    setVisitorCookie(response, visitorId, supplied);
    return response;
  } catch {
    return NextResponse.json({ error: 'Bonus tidak dapat diclaim sekarang.' }, { status: 503 });
  }
}
