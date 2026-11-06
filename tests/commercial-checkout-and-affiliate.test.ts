import { describe, it, expect, beforeEach } from 'vitest';
import { DurableStore } from '../src/lib/db/store';
import { createCheckout } from '../src/lib/billing/checkout';
import { calculateFinancialSafety } from '../src/lib/admin/finance-calculator';
import { AUTHORITATIVE_PLANS } from '../src/lib/billing/plans';
import { R2StorageService } from '../src/lib/storage/r2';

describe('AffiMatik V3.0 — Master Commercial Billing, Affiliates & Financial Protection Suite', () => {
  beforeEach(() => {
    DurableStore.resetForTesting();
  });

  describe('Scenario A: Customer Account Self-Registration & 20 Credit Provisioning', () => {
    it('provisions workspace, free tier, and exactly one 20-credit grant idempotently', async () => {
      const workspaceId = 'ws-test-customer-001';

      // 1. First initial wallet provisioning
      const initialWallet = await DurableStore.getWallet(workspaceId);
      expect(initialWallet.balance).toBe(20);
      expect(initialWallet.reservedBalance).toBe(0);

      // 2. Verify exactly 1 GRANT ledger record
      const ledger1 = await DurableStore.getLedgerHistory(workspaceId);
      expect(ledger1).toHaveLength(1);
      expect(ledger1[0].eventType).toBe('GRANT');
      expect(ledger1[0].amount).toBe(20);

      // 3. Second call (re-login or repeated access) must be strictly idempotent
      const secondWallet = await DurableStore.getWallet(workspaceId);
      expect(secondWallet.balance).toBe(20);

      const ledger2 = await DurableStore.getLedgerHistory(workspaceId);
      expect(ledger2).toHaveLength(1); // No double-credit grant!
    });
  });

  describe('Scenario B: Paid Checkout, Webhook Settlement & Exact Credit Grant', () => {
    it('creates an order, provides Malaysian FPX / DuitNow QR reference, and settles credits once', async () => {
      const workspaceId = 'ws-paid-customer-002';
      const userId = 'user-paid-002';
      await DurableStore.getWallet(workspaceId); // Initial 20 credits

      // 1. Customer initiates checkout for Starter RM49 (100 credits)
      const checkout = await createCheckout({
        workspaceId,
        userId,
        planId: 'plan_starter',
        paymentMethod: 'manual_fpx',
      });

      expect(checkout.success).toBe(true);
      expect(checkout.amountMyr).toBe(49);
      expect(checkout.creditsGranted).toBe(100);
      expect(checkout.manualPaymentDetails?.referenceCode).toMatch(/^AFM-/);

      // Verify order is PENDING
      const pendingOrder = await DurableStore.getOrder(checkout.orderId);
      expect(pendingOrder).not.toBeNull();
      expect(pendingOrder?.status).toBe('PENDING');

      // 2. Settle payment via webhook / confirmation
      const settlement1 = await DurableStore.settleOrder(checkout.orderId, 'FPX-REF-12345');
      expect(settlement1.success).toBe(true);
      expect(settlement1.status).toBe('PAID');
      expect(settlement1.balance).toBe(120); // 20 initial + 100 purchased
      expect(settlement1.tier).toBe('starter');

      // Verify subscription record exists
      const sub = await DurableStore.getSubscription(workspaceId);
      expect(sub).not.toBeNull();
      expect(sub?.status).toBe('active');
      expect(sub?.tier).toBe('starter');

      // 3. Replay webhook (idempotency test)
      const settlementReplay = await DurableStore.settleOrder(checkout.orderId, 'FPX-REF-12345');
      expect(settlementReplay.success).toBe(true);
      expect(settlementReplay.balance).toBe(120); // Must NOT credit twice!

      const wallet = await DurableStore.getWallet(workspaceId);
      expect(wallet.balance).toBe(120);
    });
  });

  describe('Scenario G: 10% Approved Affiliate Commission Engine', () => {
    it('withholds commission until approval and credits only the first eligible payment', async () => {
      const affiliateUserId = 'user-affiliate-001';
      const referralCode = 'PAWARNA10';

      // 1. Provision affiliate partner
      const partner = await DurableStore.createAffiliatePartner(affiliateUserId, referralCode);
      expect(partner.referralCode).toBe(referralCode);

      // 2. Pending applicant has no earning privileges.
      expect((await DurableStore.getAffiliatePartner(affiliateUserId))?.status).toBe('PENDING');
      const pendingCheckout = await createCheckout({ workspaceId: 'ws-pending-customer', userId: 'user-pending', planId: 'plan_starter', referralCode });
      await DurableStore.settleOrder(pendingCheckout.orderId, 'FPX-PENDING');
      expect(await DurableStore.listAffiliateCommissions(partner.id)).toHaveLength(0);
      expect(await DurableStore.reviewAffiliatePartner(partner.id, 'APPROVED', 'owner')).toBe(true);

      // 3. Approved partner refers a different customer's first payment.
      const checkoutPro = await createCheckout({
        workspaceId: 'ws-referred-customer',
        userId: 'user-referred-001',
        planId: 'plan_pro',
        referralCode,
      });

      // 4. Settle order payment
      await DurableStore.settleOrder(checkoutPro.orderId, 'FPX-PRO-9988');

      const commissions = await DurableStore.listAffiliateCommissions(partner.id);
      expect(commissions).toHaveLength(1);
      expect(commissions[0].amountMyr).toBe(12.90);
      expect(commissions[0].status).toBe('PENDING');
      expect(commissions[0].ratePercentage).toBe(10.0);

      const renewal = await createCheckout({ workspaceId: 'ws-referred-customer', userId: 'user-referred-001', planId: 'plan_pro', referralCode });
      await DurableStore.settleOrder(renewal.orderId, 'FPX-RENEWAL');
      await DurableStore.settleOrder(renewal.orderId, 'FPX-RENEWAL');
      expect(await DurableStore.listAffiliateCommissions(partner.id)).toHaveLength(1);
    });
  });

  describe('Scenario H: Owner Protected Operating Reserve & Safe-to-Withdraw', () => {
    it('calculates liabilities, reserves, and safe-to-withdraw funds accurately', async () => {
      // Create 2 paid orders: Pro (RM129) and Agency (RM399) = Total RM 528 revenue
      const o1 = await DurableStore.createOrder({
        workspaceId: 'ws-fin-1',
        userId: 'user-fin-1',
        planId: 'plan_pro',
        amountMyr: 129,
        creditsGranted: 160,
        referralCode: 'REF1',
      });
      await DurableStore.settleOrder(o1.id, 'REF-PAY-1');

      const o2 = await DurableStore.createOrder({
        workspaceId: 'ws-fin-2',
        userId: 'user-fin-2',
        planId: 'plan_agency',
        amountMyr: 399,
        creditsGranted: 600,
      });
      await DurableStore.settleOrder(o2.id, 'REF-PAY-2');

      const finances = await calculateFinancialSafety();

      expect(finances.totalRevenueMyr).toBe(528);
      expect(finances.activePaidCustomers).toBe(2);
      expect(finances.mrrMyr).toBe(0); // Manual payments are not recurring MRR.
      expect(finances.costsVerified).toBe(false);
      expect(finances.safeToWithdrawMyr).toBe(0);
      expect(finances.expectedProviderRenewalMyr).toBe(300); // Minimum provider commitment
      expect(finances.requiredOperatingReserveMyr).toBeGreaterThan(300);

      // Safe to withdraw must strictly deduct required reserve and RM500 safety buffer
      expect(typeof finances.safeToWithdrawMyr).toBe('number');
      expect(finances.safeToWithdrawMyr).toBeGreaterThanOrEqual(0);
    });

    it('supports emergency generation pause / circuit breaker toggle', async () => {
      await DurableStore.setSystemSettings('generation_status', {
        paused: true,
        reason: 'Penyelenggaraan kecemasan pangkalan data.',
      });

      const settings = await DurableStore.getSystemSettings('generation_status');
      expect(settings.paused).toBe(true);
      expect(settings.reason).toContain('Penyelenggaraan kecemasan');

      // Resume
      await DurableStore.setSystemSettings('generation_status', { paused: false });
      const resumed = await DurableStore.getSystemSettings('generation_status');
      expect(resumed.paused).toBe(false);
    });
  });

  describe('Storage Retention and Multi-Tenant Isolation', () => {
    it('enforces tier-based retention periods correctly', () => {
      expect(R2StorageService.getRetentionDays('free')).toBe(7);
      expect(R2StorageService.getRetentionDays('starter')).toBe(14);
      expect(R2StorageService.getRetentionDays('pro')).toBe(60);
      expect(R2StorageService.getRetentionDays('agency')).toBe(365);

      const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(); // 20 days ago
      expect(R2StorageService.isAssetExpired(oldDate, 'starter')).toBe(true); // 20 > 14
      expect(R2StorageService.isAssetExpired(oldDate, 'pro')).toBe(false); // 20 < 60
    });
  });
});
