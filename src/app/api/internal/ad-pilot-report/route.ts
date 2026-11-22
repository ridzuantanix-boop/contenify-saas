import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Event = { event_name: string; visitor_id: string | null; occurred_at: string; metadata?: { utmCampaign?: string; utmContent?: string } };
type Heat = { session_id: string; kind: string; device: string; x_pct: number | null; y_pct: number | null; scroll_pct: number | null; target_type: string | null; target_key?: string | null; page_variant?: string | null; occurred_at: string; campaign_key?: string | null };
type Order = { status: string; payment_state: string | null; amount_myr: number; created_at: string };

function equal(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

function myDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

async function readRows<T>(table: string, columns: string, from: string, to: string): Promise<{ rows: T[]; capped: boolean }> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('AffiMatik analytics database unavailable');
  const rows: T[] = [];
  for (let offset = 0; offset <= 50000; offset += 1000) {
    const query = new URLSearchParams({ select: columns, occurred_at: `gte.${from}`, and: `(occurred_at.lt.${to})`, order: 'occurred_at.asc', limit: '1000', offset: String(offset) });
    if (table === 'orders') {
      query.delete('occurred_at'); query.delete('and'); query.set('created_at', `gte.${from}`); query.set('and', `(created_at.lt.${to})`); query.set('order', 'created_at.asc');
    }
    const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`AffiMatik ${table} read failed (${response.status})`);
    const batch = await response.json() as T[];
    rows.push(...batch);
    if (batch.length < 1000) return { rows, capped: false };
  }
  return { rows, capped: true };
}

export function summarize(events: Event[], heat: Heat[], orders: Order[], includeCampaigns = true): any {
  const stages = ['landing_view', 'demo_play', 'launch_cta_click', 'registration_started', 'registration_completed', 'email_verified', 'launch_checkout_started', 'qr_evidence_submitted', 'payment_bank_verified'];
  const funnel = Object.fromEntries(stages.map(name => [name, { events: events.filter(row => row.event_name === name).length, visitors: new Set(events.filter(row => row.event_name === name).map(row => row.visitor_id).filter(Boolean)).size }]));
  const confirmed = orders.filter(row => row.status === 'PAID' && ['PAYMENT_CONFIRMED', 'BANK_PAYMENT_VERIFIED'].includes(row.payment_state || ''));
  const pending = orders.filter(row => !['PAYMENT_CONFIRMED', 'BANK_PAYMENT_VERIFIED'].includes(row.payment_state || ''));
  const days = new Map<string, { date: string; visitors: Set<string>; demo: Set<string>; cta: Set<string>; registrations: Set<string>; checkout: Set<string>; orders: number; verifiedOrders: number }>();
  const day = (date: string) => { const key = myDate(date); let row = days.get(key); if (!row) { row = { date: key, visitors: new Set(), demo: new Set(), cta: new Set(), registrations: new Set(), checkout: new Set(), orders: 0, verifiedOrders: 0 }; days.set(key, row); } return row; };
  for (const event of events) {
    const row = day(event.occurred_at);
    if (!event.visitor_id) continue;
    if (event.event_name === 'landing_view') row.visitors.add(event.visitor_id);
    if (event.event_name === 'demo_play') row.demo.add(event.visitor_id);
    if (event.event_name === 'launch_cta_click') row.cta.add(event.visitor_id);
    if (event.event_name === 'registration_completed') row.registrations.add(event.visitor_id);
    if (event.event_name === 'launch_checkout_started') row.checkout.add(event.visitor_id);
  }
  for (const order of orders) { const row = day(order.created_at); row.orders++; if (confirmed.includes(order)) row.verifiedOrders++; }
  const timeline = [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map(row => ({ date: row.date, visitors: row.visitors.size, demo: row.demo.size, cta: row.cta.size, registrations: row.registrations.size, checkout: row.checkout.size, orders: row.orders, verifiedOrders: row.verifiedOrders }));
  const makeHeatmap = (source: Heat[]) => ['all', 'mobile', 'desktop'].map(device => {
    const scoped = device === 'all' ? source : source.filter(row => row.device === device);
    const sessions = new Set(scoped.map(row => row.session_id)).size;
    const clicks = scoped.filter(row => row.kind === 'click' && row.x_pct !== null && row.y_pct !== null);
    const bins = new Map<string, { x: number; y: number; clicks: number; button: number; link: number; video: number; other: number }>();
    for (const click of clicks) {
      const x = Math.min(2, Math.floor(Number(click.x_pct) * 3));
      const y = Math.min(3, Math.floor(Number(click.y_pct) * 4));
      const key = `${x}:${y}`;
      const bin = bins.get(key) || { x, y, clicks: 0, button: 0, link: 0, video: 0, other: 0 };
      bin.clicks++;
      const type = click.target_type as 'button' | 'link' | 'video' | 'other';
      bin[['button', 'link', 'video'].includes(type) ? type : 'other']++;
      bins.set(key, bin);
    }
    return { device, sessions, clicks: clicks.length, bins: [...bins.values()], scroll: [25, 50, 75, 90, 100].map(depth => ({ depth, sessions: new Set(scoped.filter(row => row.kind === 'scroll' && Number(row.scroll_pct) === depth).map(row => row.session_id)).size })) };
  });
  const heatmap = makeHeatmap(heat);
  const heatmapByVariant = {
    bonus_v1: makeHeatmap(heat.filter(row => row.page_variant === 'bonus_v1')),
    base_v1: makeHeatmap(heat.filter(row => row.page_variant === 'base_v1')),
    legacy: makeHeatmap(heat.filter(row => row.page_variant == null)),
  };
  const bonusFunnel = Object.fromEntries(['section_view', 'bonus_claim', 'bonus_register', 'bonus_help_open', 'bonus_help_submit'].map(action => [action, new Set(heat.filter(row => row.page_variant === 'bonus_v1' && (action === 'section_view' ? row.kind === 'section_view' : row.kind === 'click' && row.target_key === action)).map(row => row.session_id)).size]));
  const campaignKeys = includeCampaigns ? [...new Set([
    ...events.map(row => row.metadata?.utmCampaign),
    ...heat.map(row => row.campaign_key),
  ].filter((value): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(value)))].sort() : [];
  const byCampaign = campaignKeys.map(key => ({ key, ...summarize(events.filter(row => row.metadata?.utmCampaign === key), heat.filter(row => row.campaign_key === key), [], false) }));
  const contentKeys = includeCampaigns ? [...new Set(events.filter(row => typeof row.metadata?.utmContent === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(row.metadata.utmContent)).map(row => `${row.metadata?.utmCampaign || ''}\u0000${row.metadata?.utmContent}`))].sort() : [];
  const byCreative = contentKeys.map(pair => { const [campaignKey, key] = pair.split('\u0000'); return { key, campaignKey, ...summarize(events.filter(row => row.metadata?.utmCampaign === campaignKey && row.metadata?.utmContent === key), [], [], false) }; });
  return { funnel, orders: { created: orders.length, verified: confirmed.length, pending: pending.length, verifiedAmountMyr: Math.round(confirmed.reduce((sum, row) => sum + Number(row.amount_myr || 0), 0) * 100) / 100 }, heatmap, heatmapByVariant, bonusFunnel, timeline, byCampaign, byCreative, attribution: 'CAMPAIGN_AND_CREATIVE_FOR_WEB_EVENTS_ONLY_PAYMENT_AND_HEATMAP_UNLINKED' };
}

export async function GET(req: NextRequest) {
  const secret = process.env.AD_PILOT_REPORT_SECRET || '';
  const supplied = req.headers.get('x-ad-pilot-report-key') || '';
  if (!secret || !supplied || !equal(supplied, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const from = req.nextUrl.searchParams.get('from') || '';
  const to = req.nextUrl.searchParams.get('to') || '';
  const start = Date.parse(from), end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 31 * 86400000 || end > Date.now() + 86400000) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  try {
    const [events, heat, orders] = await Promise.all([
      readRows<Event>('conversion_events', 'event_name,visitor_id,occurred_at,metadata', from, to),
      readRows<Heat>('salespage_heatmap_events', 'session_id,kind,device,x_pct,y_pct,scroll_pct,target_type,target_key,page_variant,occurred_at,campaign_key', from, to),
      readRows<Order>('orders', 'status,payment_state,amount_myr,created_at', from, to),
    ]);
    return NextResponse.json({ ok: true, product: 'AffiMatik', range: { from, to }, generatedAt: new Date().toISOString(), capped: events.capped || heat.capped || orders.capped, ...summarize(events.rows, heat.rows, orders.rows) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analytics unavailable' }, { status: 503 });
  }
}
