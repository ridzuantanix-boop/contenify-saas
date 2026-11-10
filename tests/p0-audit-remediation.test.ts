import { describe, it, expect, beforeEach } from 'vitest';
import { DurableStore } from '../src/lib/db/store';
import { verifyAdminAccess } from '../src/lib/auth/admin-guard';
import { AUTHORITATIVE_PLANS } from '../src/lib/billing/plans';
import { reconcileOrphanAccounts } from '../src/lib/db/reconcile';

describe('P0 Production Reliability & Security Audit Remediation Suite', () => {
  beforeEach(() => {
    DurableStore.resetForTesting();
  });

  // ---------------------------------------------------------------------------
  // 1. Production Fail-Closed Enforcement
  // ---------------------------------------------------------------------------
  describe('P0 Fail-Closed Enforcement', () => {
    it('strictly throws in production if Supabase credentials are missing', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origVitest = process.env.VITEST;
      const origUrl = process.env.SUPABASE_URL;
      const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        (process.env as any).NODE_ENV = 'production';
        delete (process.env as any).VITEST;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        await expect(async () => {
          await DurableStore.getWallet('ws_test_prod_fail_closed');
        }).rejects.toThrow(/Database configuration missing in production/);
      } finally {
        (process.env as any).NODE_ENV = origNodeEnv;
        if (origVitest !== undefined) (process.env as any).VITEST = origVitest; else delete (process.env as any).VITEST;
        if (origUrl !== undefined) process.env.SUPABASE_URL = origUrl; else delete process.env.SUPABASE_URL;
        if (origKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey; else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });

    it('reports isAvailable: false in getSoftLaunchMetrics when Supabase is not configured in production', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origVitest = process.env.VITEST;
      const origUrl = process.env.SUPABASE_URL;
      const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        (process.env as any).NODE_ENV = 'production';
        delete (process.env as any).VITEST;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const metrics = await DurableStore.getSoftLaunchMetrics();
        expect(metrics.isAvailable).toBe(false);
        expect(metrics.error).toContain('Supabase');
      } finally {
        (process.env as any).NODE_ENV = origNodeEnv;
        if (origVitest !== undefined) (process.env as any).VITEST = origVitest; else delete (process.env as any).VITEST;
        if (origUrl !== undefined) process.env.SUPABASE_URL = origUrl; else delete process.env.SUPABASE_URL;
        if (origKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey; else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Security & Hardcoded Credential Elimination
  // ---------------------------------------------------------------------------
  describe('P0 Security Lockdown & Elimination of Hardcoded Fallbacks', () => {
    it('strictly rejects the hardcoded legacy key AffiMatik@Master2026! when not configured in environment', async () => {
      const origKey = process.env.ADMIN_ACCESS_KEY;
      delete process.env.ADMIN_ACCESS_KEY;

      try {
        const untrustedHeaders = new Headers({
          'x-admin-key': 'AffiMatik@Master2026!',
        });

        const result = await verifyAdminAccess(untrustedHeaders);
        expect(result.isAuthorized).toBe(false);
      } finally {
        process.env.ADMIN_ACCESS_KEY = origKey;
      }
    });

    it('only authorizes admin access when ADMIN_ACCESS_KEY matches exact configured environment value', async () => {
      const origKey = process.env.ADMIN_ACCESS_KEY;
      const secureDynamicKey = 'secure_prod_key_' + crypto.randomUUID();
      process.env.ADMIN_ACCESS_KEY = secureDynamicKey;

      try {
        // Bad attempt
        const badRes = await verifyAdminAccess(new Headers({ 'x-admin-key': 'bad_guess' }));
        expect(badRes.isAuthorized).toBe(false);

        // Good attempt
        const goodRes = await verifyAdminAccess(new Headers({ 'x-admin-key': secureDynamicKey }));
        expect(goodRes.isAuthorized).toBe(true);
        expect(goodRes.role).toBe('superadmin');
      } finally {
        process.env.ADMIN_ACCESS_KEY = origKey;
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Authoritative Plan Enforcement in Manual Activation
  // ---------------------------------------------------------------------------
  describe('P0 Authoritative Plan & Verifiable Payment Enforcement', () => {
    it('strictly enforces V7.2 pricing: Starter (500 cr), Pro (2,000 cr), Agency (8,000 cr)', async () => {
      const workspaceId = crypto.randomUUID();

      // Seed customer in local store
      DurableStore.setWallet({
        workspaceId,
        balance: 0,
        reservedBalance: 0,
        lifetimeGranted: 0,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      // 1. Rejects fake placeholder payment reference
      await expect(async () => {
        await DurableStore.manualActivateCustomer({
          workspaceId,
          activationType: 'MANUAL_PAID',
          planId: 'plan_starter',
          amountPaidMyr: 49,
          paymentReference: 'bank_transfer_12345678', // Fake generated placeholder
          adminEmail: 'admin@pawarna.my',
        });
      }).rejects.toThrow(/Rujukan pembayaran bank yang sah dan disahkan/);

      // 2. Rejects mismatched amount (e.g. attempting to pay RM30 for RM49 Starter)
      await expect(async () => {
        await DurableStore.manualActivateCustomer({
          workspaceId,
          activationType: 'MANUAL_PAID',
          planId: 'plan_starter',
          amountPaidMyr: 30, // Mismatched
          paymentReference: 'MAYBANK-REF-992831',
          adminEmail: 'admin@pawarna.my',
        });
      }).rejects.toThrow(/tidak sepadan dengan harga autoritatif/);

      // 3. Successful manual activation with verified payment grants exactly authoritative credits (50 for starter)
      const starterResult = await DurableStore.manualActivateCustomer({
        workspaceId,
        activationType: 'MANUAL_PAID',
        planId: 'plan_starter',
        amountPaidMyr: 49,
        paymentReference: 'MAYBANK-TRX-20261105-01',
        reason: 'Pengesahan resit pemindahan Maybank2u',
        adminEmail: 'admin@pawarna.my',
      });

      expect(starterResult.success).toBe(true);
      expect(starterResult.balance).toBe(500);
      expect(starterResult.tier).toBe('starter');

      // 4. Pro plan grants exactly 160 credits for RM129
      const proWorkspace = crypto.randomUUID();
      DurableStore.setWallet({
        workspaceId: proWorkspace,
        balance: 0,
        reservedBalance: 0,
        lifetimeGranted: 0,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      const proResult = await DurableStore.manualActivateCustomer({
        workspaceId: proWorkspace,
        activationType: 'MANUAL_PAID',
        planId: 'plan_pro',
        amountPaidMyr: 129,
        paymentReference: 'CIMB-TRX-20261105-02',
        reason: 'Pengesahan resit pemindahan CIMB Clicks',
        adminEmail: 'admin@pawarna.my',
      });

      expect(proResult.success).toBe(true);
      expect(proResult.balance).toBe(2000);
      expect(proResult.tier).toBe('pro');

      // 5. Agency studio grants exactly 600 credits for RM399
      const agencyWorkspace = crypto.randomUUID();
      DurableStore.setWallet({
        workspaceId: agencyWorkspace,
        balance: 0,
        reservedBalance: 0,
        lifetimeGranted: 0,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      const agencyResult = await DurableStore.manualActivateCustomer({
        workspaceId: agencyWorkspace,
        activationType: 'MANUAL_PAID',
        planId: 'plan_agency',
        amountPaidMyr: 399,
        paymentReference: 'RHB-TRX-20261105-03',
        reason: 'Pengesahan resit transfer RHB Bank',
        adminEmail: 'admin@pawarna.my',
      });

      expect(agencyResult.success).toBe(true);
      expect(agencyResult.balance).toBe(8000);
      expect(agencyResult.tier).toBe('agency');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Registered Users Listing
  // ---------------------------------------------------------------------------
  describe('P0 Registered Users List & Privacy Protection', () => {
    it('masks emails and protects customer secrets in admin user listing', async () => {
      // Save customer profile in store
      DurableStore.saveCustomerProfile({
        userId: 'usr_sarah_01',
        email: 'sarah.abdullah@gmail.com',
        fullName: 'Sarah Abdullah',
        whatsapp: '+60123456789',
        workspaceId: 'ws_sarah_01',
        tier: 'free',
      });

      await DurableStore.getWallet('ws_sarah_01');
      const result = await DurableStore.listRegisteredUsers();
      expect(result.users.length).toBeGreaterThan(0);
      const user = result.users.find((u) => u.fullName === 'Sarah Abdullah');
      expect(user).toBeDefined();
      expect(user?.emailMasked).toBe('s***h@gmail.com');
      expect(user?.whatsapp).toBe('+60123456789');
      expect(user?.balance).toBe(20);
      expect(user?.provisionStatus).toBe('provisioned');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Reconcile Function Handling
  // ---------------------------------------------------------------------------
  describe('P0 Idempotent Reconcile Safety', () => {
    it('returns structured report when Supabase is unconfigured without throwing unhandled exceptions', async () => {
      const origUrl = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;

      try {
        const report = await reconcileOrphanAccounts();
        expect(report.success).toBe(false);
        expect(report.details.length).toBeGreaterThan(0);
        expect(report.details[0].status).toBe('failed');
      } finally {
        process.env.SUPABASE_URL = origUrl;
      }
    });
  });
});
