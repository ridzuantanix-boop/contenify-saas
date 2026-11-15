import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarizeAdminDashboard } from '../src/lib/admin/dashboard-insights';

describe('Admin CRM and first-party analytics dashboard', () => {
  it('separates visitors, funnel, customers, revenue and real video outcomes', () => {
    const now=new Date('2026-11-16T00:00:00+08:00');
    const result=summarizeAdminDashboard({now,
      events:[
        {event_name:'landing_view',visitor_id:'v1',occurred_at:'2026-11-15T10:00:00+08:00'},
        {event_name:'landing_view',visitor_id:'v2',occurred_at:'2026-11-15T11:00:00+08:00'},
        {event_name:'registration_completed',visitor_id:'v1',occurred_at:'2026-11-15T12:00:00+08:00'},
        {event_name:'launch_checkout_started',visitor_id:'v1',occurred_at:'2026-11-15T12:05:00+08:00'},
        {event_name:'qr_evidence_submitted',visitor_id:'v1',occurred_at:'2026-11-15T12:10:00+08:00'},
      ],
      profiles:[{id:'u1',default_workspace_id:'w1',tier:'starter',created_at:'2026-11-15T12:00:00+08:00'}],
      orders:[{workspace_id:'w1',status:'PAID',payment_state:'BANK_PAYMENT_VERIFIED',amount_myr:19,created_at:'2026-11-15T12:10:00+08:00'}],
      jobs:[{workspace_id:'w1',status:'COMPLETED',provider:'nexabot',created_at:'2026-11-15T13:00:00+08:00',completed_at:'2026-11-15T13:02:00+08:00',updated_at:'2026-11-15T13:02:00+08:00'}],
      rewards:[{workspace_id:'w1',credits_granted:30,granted_at:'2026-11-15T14:00:00+08:00',status:'GRANTED'}],
    });
    expect(result.traffic).toMatchObject({uniqueVisitors:2,uniqueVisitors7d:2,landingViews:2});
    expect(result.funnel.rates).toMatchObject({visitorToRegistration:50,registrationToCheckout:100,checkoutToReceipt:100});
    expect(result.customers).toMatchObject({total:1,paying:1,active30d:1});
    expect(result.revenue).toMatchObject({confirmedMyr:19,confirmedOrders:1});
    expect(result.videos).toMatchObject({totalJobs:1,completed:1,completed24h:1});
    expect(result.rewards).toEqual({claims:1,creditsGranted:30});
  });

  it('shows per-customer generation, payment, activity and reward columns in CRM', () => {
    const page=readFileSync('src/app/(dashboard)/admin/page.tsx','utf8');
    const store=readFileSync('src/lib/db/store.ts','utf8');
    expect(page).toContain('{u.completedVideos} siap');
    expect(page).toContain('{u.totalJobs} jumlah');
    expect(page).toContain('view=users&limit=200');
    expect(page).toContain('RM{u.confirmedSpendMyr.toFixed(2)}');
    expect(page).toContain('Ganjaran ulasan');
    expect(store).toContain('reviewRewardClaimed');
    expect(store).toContain("customerStatus:orders.confirmed>0?'paid'");
  });
});
