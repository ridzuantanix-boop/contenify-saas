import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, summarize } from '../src/app/api/internal/ad-pilot-report/route';

describe('AD PILOT aggregate report', () => {
  it('counts visitors once, separates pending orders and bins repeated heatmap clicks', () => {
    const at = '2026-11-19T02:00:00.000Z';
    const report = summarize(
      [
        { event_name: 'landing_view', visitor_id: 'v1', occurred_at: at, metadata: { utmCampaign: 'affimatik_launch' } },
        { event_name: 'landing_view', visitor_id: 'v1', occurred_at: at },
        { event_name: 'demo_play', visitor_id: 'v1', occurred_at: at },
        { event_name: 'launch_cta_click', visitor_id: 'v1', occurred_at: at },
      ],
      [
        { session_id: 's1', kind: 'click', device: 'mobile', x_pct: .8, y_pct: .1, scroll_pct: null, target_type: 'button', occurred_at: at, campaign_key: 'affimatik_launch' },
        { session_id: 's1', kind: 'click', device: 'mobile', x_pct: .79, y_pct: .2, scroll_pct: null, target_type: 'button', occurred_at: at },
        { session_id: 's1', kind: 'scroll', device: 'mobile', x_pct: null, y_pct: null, scroll_pct: 25, target_type: null, occurred_at: at },
      ],
      [
        { status: 'PENDING', payment_state: 'PAYMENT_UNVERIFIED', amount_myr: 19, created_at: at },
        { status: 'PAID', payment_state: 'BANK_PAYMENT_VERIFIED', amount_myr: 19, created_at: at },
      ],
    );
    expect(report.funnel.landing_view).toEqual({ events: 2, visitors: 1 });
    expect(report.orders).toEqual({ created: 2, verified: 1, pending: 1, verifiedAmountMyr: 19 });
    expect(report.heatmap[0].sessions).toBe(1);
    expect(report.heatmap[0].bins).toContainEqual({ x: 2, y: 0, clicks: 2, button: 2, link: 0, video: 0, other: 0 });
    expect(report.heatmap[0].scroll[0]).toEqual({ depth: 25, sessions: 1 });
    expect(report.byCampaign[0].key).toBe('affimatik_launch');
    expect(report.byCampaign[0].funnel.landing_view.visitors).toBe(1);
    expect(report.byCampaign[0].heatmap[0].clicks).toBe(1);
  });

  it('separates web events by creative without assigning payments or heatmap to one ad', () => {
    const at = '2026-11-19T02:00:00.000Z';
    const report = summarize([
      { event_name: 'landing_view', visitor_id: 'v1', occurred_at: at, metadata: { utmCampaign: 'affimatik_copy_review', utmContent: 'proof_video_01' } },
      { event_name: 'registration_completed', visitor_id: 'v1', occurred_at: at, metadata: { utmCampaign: 'affimatik_copy_review', utmContent: 'proof_video_01' } },
      { event_name: 'landing_view', visitor_id: 'v2', occurred_at: at, metadata: { utmCampaign: 'affimatik_copy_review', utmContent: 'late_night_03' } },
    ], [], [{ status: 'PAID', payment_state: 'BANK_PAYMENT_VERIFIED', amount_myr: 19, created_at: at }]);
    expect(report.byCreative.map((row: { key: string }) => row.key)).toEqual(['late_night_03', 'proof_video_01']);
    expect(report.byCreative[1].funnel.registration_completed.visitors).toBe(1);
    expect(report.byCreative[0].orders.verified).toBe(0);
    expect(report.orders.verified).toBe(1);
  });

  it('attributes verified revenue to payment date when checkout and payment span days', () => {
    const createdAt = '2026-11-22T10:00:00.000Z';
    const paidAt = '2026-11-23T03:00:00.000Z';
    const order = { status: 'PAID', payment_state: 'BANK_PAYMENT_VERIFIED', amount_myr: 19, created_at: createdAt, paid_at: paidAt };
    const checkoutDay = summarize([], [], [order], true, []);
    const paymentDay = summarize([], [], [], true, [order]);
    expect(checkoutDay.orders.verified).toBe(0);
    expect(paymentDay.orders.verified).toBe(1);
    expect(paymentDay.orders.verifiedAmountMyr).toBe(19);
    expect(paymentDay.paymentDateBasis).toBe('paid_at');
    expect(paymentDay.timeline[0].date).toBe('2026-11-23');
  });

  it('queries paid_at separately from created_at for the requested reporting day', async () => {
    const previous = {
      fetch: globalThis.fetch,
      key: process.env.AD_PILOT_REPORT_SECRET,
      base: process.env.SUPABASE_URL,
      role: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    process.env.AD_PILOT_REPORT_SECRET = 'test-report-secret';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    const seen: string[] = [];
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      seen.push(url.search);
      if (url.pathname.endsWith('/orders') && url.searchParams.has('paid_at'))
        return Response.json([{ status: 'PAID', payment_state: 'BANK_PAYMENT_VERIFIED', amount_myr: 19, created_at: '2026-11-19T10:00:00Z', paid_at: '2026-11-20T10:00:00Z' }]);
      return Response.json([]);
    };
    try {
      const req = new NextRequest('https://affimatik.online/api/internal/ad-pilot-report?from=2026-11-19T16%3A00%3A00Z&to=2026-11-20T16%3A00%3A00Z',
        { headers: { 'x-ad-pilot-report-key': 'test-report-secret' } });
      const response = await GET(req);
      const report = await response.json();
      expect(response.status).toBe(200);
      expect(seen.some(query => query.includes('paid_at=gte.'))).toBe(true);
      expect(seen.some(query => query.includes('created_at=gte.'))).toBe(true);
      expect(report.orders.verified).toBe(1);
      expect(report.paymentDateBasis).toBe('paid_at');
    } finally {
      globalThis.fetch = previous.fetch;
      for (const [name, value] of [['AD_PILOT_REPORT_SECRET', previous.key], ['SUPABASE_URL', previous.base], ['SUPABASE_SERVICE_ROLE_KEY', previous.role]] as const) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
    }
  });
});
