import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AFFILIATE_COMMISSION_RATE,
  affiliateStatusKeepsLifetimeAccess,
  isQualifyingSettledSubscription,
  validateAffiliateUsername,
} from '@/lib/affiliate/partner-policy';

describe('AffiMatik Partner V1 owner policy', () => {
  it('qualifies only genuinely settled subscriptions, never Launch Pack or top-ups', () => {
    expect(isQualifyingSettledSubscription({ planId: 'plan_starter', status: 'PAID', paymentState: 'PAYMENT_CONFIRMED' })).toBe(true);
    expect(isQualifyingSettledSubscription({ planId: 'plan_pro', status: 'PAID', paymentState: 'BANK_PAYMENT_VERIFIED' })).toBe(true);
    expect(isQualifyingSettledSubscription({ planId: 'launch_pack', status: 'PAID', paymentState: 'PAYMENT_CONFIRMED' })).toBe(false);
    expect(isQualifyingSettledSubscription({ planId: 'topup_plus', status: 'PAID', paymentState: 'PAYMENT_CONFIRMED' })).toBe(false);
    expect(isQualifyingSettledSubscription({ planId: 'plan_agency', status: 'PAID', paymentState: 'PROVISIONALLY_ACTIVE' })).toBe(false);
    expect(isQualifyingSettledSubscription({ planId: 'plan_agency', status: 'PAID', paymentState: 'PAYMENT_CONFIRMED', metadata: { full_refund: true } })).toBe(false);
  });

  it('normalizes username rules and blocks reserved impersonation identifiers', () => {
    expect(validateAffiliateUsername(' Creator88 ')).toEqual({ valid: true, normalized: 'creator88' });
    expect(validateAffiliateUsername('affiliate_ali')).toEqual({ valid: true, normalized: 'affiliate_ali' });
    expect(validateAffiliateUsername('ab').valid).toBe(false);
    expect(validateAffiliateUsername('creator ali').valid).toBe(false);
    expect(validateAffiliateUsername('ADMIN').valid).toBe(false);
    expect(validateAffiliateUsername('affimatik_help').valid).toBe(false);
  });

  it('keeps approved status separate from subscription lifecycle and uses 20 percent', () => {
    expect(affiliateStatusKeepsLifetimeAccess('APPROVED')).toBe(true);
    expect(affiliateStatusKeepsLifetimeAccess('SUSPENDED')).toBe(false);
    expect(AFFILIATE_COMMISSION_RATE).toBe(20);
  });

  it('ships atomic aliases, race protection, lifetime eligibility and audited suspension', () => {
    const sql = fs.readFileSync('supabase/migrations/00033_affimatik_partner_v1.sql', 'utf8');
    expect(sql).toContain('affiliate_referral_aliases');
    expect(sql).toContain('alias_normalized TEXT PRIMARY KEY');
    expect(sql).toContain('has_ever_qualified_paid_subscription_v1');
    expect(sql).toContain("plan_id IN ('plan_starter','plan_pro','plan_agency')");
    expect(sql).toContain("status='APPROVED'");
    expect(sql).toContain('affiliate_username IS NULL');
    expect(sql).toContain('legacy_alias_preserved');
    expect(sql).toContain('AFFILIATE_FRAUD_OR_POLICY_SUSPENSION');
    expect(sql).toContain('round(v_order.amount_myr*0.20,2)');
    expect(sql).toContain("now()+interval '14 days'");
  });

  it('exposes the required customer copy and subscription CTA', () => {
    const page = fs.readFileSync('src/app/(dashboard)/affiliate/page.tsx', 'utf8');
    expect(page).toContain('Langgan Sekali. Jadi Affiliate Selamanya.');
    expect(page).toContain('Launch Pack, top-up, kredit promosi');
    expect(page).toContain('href="/billing"');
    expect(page).toContain('Tidak perlu renew subscription');
  });
});
