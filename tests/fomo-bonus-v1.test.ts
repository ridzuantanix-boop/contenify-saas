import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compareLaunchPackEconomics } from '@/lib/billing/fomo-economics';

const root = process.cwd();
const migration = readFileSync(resolve(root, 'supabase/migrations/00041_fomo_bonus_v1.sql'), 'utf8');
const checkout = readFileSync(resolve(root, 'src/lib/billing/checkout.ts'), 'utf8');
const offerRoute = readFileSync(resolve(root, 'src/app/api/fomo-offer/route.ts'), 'utf8');
const receiptRoute = readFileSync(resolve(root, 'src/app/api/billing/qr-receipt/route.ts'), 'utf8');

describe('FOMO Bonus V1', () => {
  it('keeps the canonical base price and separates 150 base + 100 bonus', () => {
    expect(migration).toContain("'launch_pack_base',v_claim.base_credits");
    expect(migration).toContain("'fomo_v1_bonus',v_claim.bonus_credits");
    expect(migration).toContain("VALUES(v_order.workspace_id,v_wallet.id,150,'GRANT'");
    expect(migration).toContain("VALUES(v_order.workspace_id,v_wallet.id,100,'GRANT'");
    expect(migration).toContain("v_order.amount_myr<>19");
  });

  it('uses server time, persists one assignment, and never restarts an expired offer', () => {
    expect(migration).toContain('UNIQUE(campaign_id, visitor_id)');
    expect(migration).toContain('offer_expires_at');
    expect(migration).toContain('now()>=v_assignment.offer_expires_at');
    expect(offerRoute).not.toContain('Date.now() + 60');
  });

  it('reserves a valid claim for 24 hours and binds it to user + order atomically', () => {
    expect(migration).toContain('payment_reservation_hours INTEGER NOT NULL DEFAULT 24');
    expect(migration).toContain("status='ORDER_LINKED'");
    expect(migration).toContain('user_id=p_user_id,order_id=p_order_id');
    expect(migration).toContain('fomo_bonus_once_per_user');
  });

  it('routes only promotional receipt grants through the promotional atomic RPC', () => {
    expect(checkout).toContain('createQrOrderFomoAtomic');
    expect(receiptRoute).toContain("isFomoOrder?'provision_qr_order_fomo_v1':'provision_qr_order_atomic'");
  });

  it('keeps full-redemption economics positive at verified configured reserves', () => {
    const result = compareLaunchPackEconomics({ priceMyr: 19, creditsPerVideo: 10, observedProviderCostMyrPerVideo: 0.045, conservativeReserveMyrPerVideo: 0.15, refundReservePercent: 10, affiliateCommissionPercent: 20, paymentProcessingMyr: 0 });
    expect(result.base).toMatchObject({ credits: 150, videos: 15, providerReserveMyr: 2.25, contributionAfterConservativeReservesMyr: 11.05, commerciallyPositive: true });
    expect(result.promotional).toMatchObject({ credits: 250, videos: 25, providerReserveMyr: 3.75, contributionAfterConservativeReservesMyr: 9.55, commerciallyPositive: true });
    expect(result.incrementalConservativeLiabilityMyr).toBe(1.5);
  });
});
