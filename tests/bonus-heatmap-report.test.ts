import { describe, expect, it } from 'vitest';
import { summarize } from '../src/app/api/internal/ad-pilot-report/route';

describe('AffiMatik report by salespage layout', () => {
  it('keeps old clicks separate and counts bonus actions by unique session', () => {
    const heat = [
      { session_id: 'old', kind: 'click', device: 'mobile', x_pct: .2, y_pct: .2, scroll_pct: null, target_type: 'button', occurred_at: '2026-11-22T00:00:00Z', campaign_key: 'affi' },
      { session_id: 'new', kind: 'section_view', device: 'mobile', x_pct: null, y_pct: null, scroll_pct: null, target_type: null, page_variant: 'bonus_v1', occurred_at: '2026-11-22T00:00:00Z', campaign_key: 'affi' },
      { session_id: 'new', kind: 'click', device: 'mobile', x_pct: .3, y_pct: .5, scroll_pct: null, target_type: 'button', target_key: 'bonus_claim', page_variant: 'bonus_v1', occurred_at: '2026-11-22T00:00:01Z', campaign_key: 'affi' },
      { session_id: 'new', kind: 'click', device: 'mobile', x_pct: .3, y_pct: .5, scroll_pct: null, target_type: 'button', target_key: 'bonus_claim', page_variant: 'bonus_v1', occurred_at: '2026-11-22T00:00:02Z', campaign_key: 'affi' },
    ];
    const report = summarize([], heat, []);
    expect(report.heatmapByVariant.bonus_v1[0].clicks).toBe(2);
    expect(report.heatmapByVariant.legacy[0].clicks).toBe(1);
    expect(report.bonusFunnel).toMatchObject({ section_view: 1, bonus_claim: 1, bonus_register: 0 });
    expect(report.byCampaign[0].bonusFunnel.bonus_claim).toBe(1);
  });
});
