import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/00031_review_reward_30_credits.sql', 'utf8');
const route = readFileSync('src/app/api/review-reward/route.ts', 'utf8');
const library = readFileSync('src/app/(dashboard)/library/page.tsx', 'utf8');

describe('one-time 30-credit customer review reward', () => {
  it('grants exactly 30 credits atomically after two distinct completed-video downloads', () => {
    expect(migration).toContain('UNIQUE (workspace_id, user_id, video_job_id)');
    expect(migration).toContain('IF v_count < 2');
    expect(migration).toContain('SET balance=balance+30,lifetime_granted=lifetime_granted+30');
    expect(migration).toContain("'review-reward:'||p_user_id::text");
    expect(migration).toContain('UNIQUE (workspace_id)');
    expect(migration).toContain('UNIQUE (user_id)');
  });

  it('keeps both RPCs service-role-only and rejects unverified checkout sessions', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.grant_review_reward_atomic');
    expect(migration).toContain('TO service_role');
    expect(route).toContain('isEmailVerificationPending(session)');
    expect(route).toContain('Sahkan emel sebelum menuntut ganjaran ulasan.');
  });

  it('accepts a meaningful review or approved TikTok/Shopee link with explicit marketing consent', () => {
    expect(route).toContain('reviewText.length < 40 && !publishedUrl');
    expect(route).toContain("host === 'tiktok.com'");
    expect(route).toContain("host === 'shopee.com.my'");
    expect(route).toContain('body.marketingConsent === true');
    expect(library).toContain('Kongsi ulasan, dapat +30 kredit');
    expect(library).toContain('bersamaan tiga video bonus');
    expect(library).toContain("action: 'record_download'");
  });
});
