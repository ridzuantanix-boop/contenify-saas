import { NextRequest, NextResponse } from 'next/server';
import { CLIENT_CONVERSION_EVENTS, ConversionEvent } from '@/lib/analytics/conversion';
import { getSessionFromRequest } from '@/lib/auth/session';

const ALLOWED_META = new Set(['placement', 'demoId', 'planId', 'source', 'provider', 'styleId']);

function safeRefererPath(referer: string | null) {
  if (!referer) return null;
  try {
    return new URL(referer).pathname.slice(0, 255);
  } catch {
    return null;
  }
}

function attributionFromReferer(req: NextRequest, key: 'utm_campaign' | 'utm_content') {
  try {
    const url = new URL(req.headers.get('referer') || '');
    if (url.origin !== new URL(req.url).origin || url.pathname !== '/') return '';
    const value = url.searchParams.get(key) || '';
    return /^[a-zA-Z0-9_.-]{1,100}$/.test(value) ? value : '';
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const eventName = String(body.eventName || '') as ConversionEvent;
  const dedupeKey = String(body.dedupeKey || '');
  if (!CLIENT_CONVERSION_EVENTS.has(eventName) || !/^[a-zA-Z0-9:_-]{1,120}$/.test(dedupeKey)) {
    return NextResponse.json({ error: 'Event tidak sah.' }, { status: 400 });
  }
  const suppliedMeta = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {};
  const metadata = Object.fromEntries(Object.entries(suppliedMeta).filter(([key, value]) =>
    ALLOWED_META.has(key) && (value === null || ['string', 'number', 'boolean'].includes(typeof value))));
  const taggedCampaign = attributionFromReferer(req, 'utm_campaign');
  const taggedContent = attributionFromReferer(req, 'utm_content');
  const previousCampaign = req.cookies.get('affimatik_campaign')?.value || '';
  const previousContent = req.cookies.get('affimatik_content')?.value || '';
  const campaign = taggedCampaign || (/^[a-zA-Z0-9_.-]{1,100}$/.test(previousCampaign) ? previousCampaign : '');
  const content = taggedContent || (!taggedCampaign && /^[a-zA-Z0-9_.-]{1,100}$/.test(previousContent) ? previousContent : '');
  if (campaign) metadata.utmCampaign = campaign;
  if (content) metadata.utmContent = content;
  const session = await getSessionFromRequest(req).catch(() => null);
  const suppliedVisitor = req.cookies.get('affimatik_visitor')?.value || '';
  const visitorId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suppliedVisitor) ? suppliedVisitor : crypto.randomUUID();
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return NextResponse.json({ recorded: false }, { status: 202 });
  const response = await fetch(`${base}/rest/v1/conversion_events`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      event_name: eventName,
      event_id: crypto.randomUUID(),
      dedupe_key: `${visitorId}:${dedupeKey}`,
      visitor_id: visitorId,
      user_id: session?.userId || null,
      workspace_id: session?.workspaceId || null,
      source: 'web',
      path: safeRefererPath(req.headers.get('referer')),
      metadata,
    }),
  });
  if (!response.ok && response.status !== 409) return NextResponse.json({ recorded: false }, { status: 202 });
  const result = NextResponse.json({ recorded: true }, { status: 201 });
  if (visitorId !== suppliedVisitor) result.cookies.set('affimatik_visitor', visitorId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 180 * 24 * 60 * 60 });
  if (taggedCampaign && eventName === 'landing_view') result.cookies.set('affimatik_campaign', taggedCampaign, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });
  if (taggedContent && eventName === 'landing_view') result.cookies.set('affimatik_content', taggedContent, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });
  if (taggedCampaign && !taggedContent && eventName === 'landing_view') result.cookies.delete('affimatik_content');
  return result;
}
