import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AFFIMATIK THE NEXT 10 email campaign', () => {
  const runner = fs.readFileSync('scripts/release/next-10-email-campaign.mjs','utf8');
  const migration = fs.readFileSync('supabase/migrations/00034_next_10_email_campaign.sql','utf8');
  it('uses accurate published capability copy and a hosted optimized poster', () => {
    expect(runner).toContain('6 gaya Fashion');
    expect(runner).toContain('4 gaya Kitchen');
    expect(runner).toContain('30 gaya video affiliate');
    expect(runner).toContain('gaya yang menyokong');
    expect(runner).toContain('/marketing/email/affimatik-the-next-10-launch.jpg');
    expect(fs.statSync('public/marketing/email/affimatik-the-next-10-launch.jpg').size).toBeLessThan(300_000);
  });
  it('keeps the live blast locked and idempotent', () => {
    expect(runner).toContain("AFFIMATIK_LIVE_CAMPAIGN_AUTHORIZED!=='true'");
    expect(runner).toContain('AFFIMATIK_EXPECTED_RECIPIENT_COUNT');
    expect(runner).toContain("'Idempotency-Key'");
    expect(runner).toContain('/emails/batch');
    expect(runner).toContain('/suppressions');
  });
  it('persists opt-outs and delivery progress behind RLS', () => {
    expect(migration).toContain('email_marketing_preferences');
    expect(migration).toContain('email_campaign_recipients');
    expect(migration).toContain('unsubscribe_marketing_email_v1');
    expect(migration.match(/ENABLE ROW LEVEL SECURITY/g)?.length).toBe(4);
    expect(migration).toContain('UNIQUE(campaign_id,email_hash)');
  });
});
