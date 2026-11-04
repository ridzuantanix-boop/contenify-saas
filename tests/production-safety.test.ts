import { describe, it, expect, beforeEach } from 'vitest';
import { verifyAdminAccess } from '../src/lib/auth/admin-guard';
import { createSessionToken, verifySessionToken } from '../src/lib/auth/session';
import { DurableStore } from '../src/lib/db/store';
import { ProviderRouter } from '../src/lib/providers/router';
import { VoiceoverDirector } from '../src/lib/engine/voiceover-director';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { VIDEO_STYLES_REGISTRY, getVideoStyle } from '../src/lib/styles/registry';

describe('AFFIMATIK V2.1.1 Mandatory Acceptance Tests', () => {
  beforeEach(() => {
    DurableStore.resetForTesting();
  });

  // ---------------------------------------------------------------------------
  // 1. Security & RBAC Guard
  // ---------------------------------------------------------------------------
  describe('Security & Admin Authentication Guard', () => {
    it('prevents browser-supplied role header (x-admin-role) from granting administrator privileges', async () => {
      // Attacker tries to inject x-admin-role: superadmin directly from browser
      const untrustedHeaders = new Headers({
        'x-admin-role': 'superadmin',
      });

      const result = await verifyAdminAccess(untrustedHeaders);
      expect(result.isAuthorized).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('Akses Pentadbir Ditolak');
    });

    it('rejects normal user session when attempting admin access', async () => {
      // Regular creator session
      const normalUserToken = await createSessionToken({
        userId: 'usr_normal_creator',
        email: 'creator@example.com',
        fullName: 'Normal Creator',
        workspaceId: 'ws_creator_1',
        role: 'member',
        tier: 'starter',
      });

      const reqHeaders = new Headers({
        cookie: `affimatik_session=${normalUserToken}`,
      });

      const result = await verifyAdminAccess(reqHeaders);
      expect(result.isAuthorized).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it('authorizes authenticated superadmin session token', async () => {
      const adminToken = await createSessionToken({
        userId: 'usr_superadmin',
        email: 'admin@pawarna.my',
        fullName: 'System SuperAdmin',
        workspaceId: 'ws_admin',
        role: 'superadmin',
        tier: 'agency',
      });

      const reqHeaders = new Headers({
        cookie: `affimatik_admin_session=${adminToken}`,
      });

      const result = await verifyAdminAccess(reqHeaders);
      expect(result.isAuthorized).toBe(true);
      expect(result.role).toBe('superadmin');
      expect(result.statusCode).toBe(200);
    });

    it('authorizes exact match server ADMIN_ACCESS_KEY header and rejects invalid keys', async () => {
      process.env.ADMIN_ACCESS_KEY = 'super_secret_pawarna_key_2026';

      // Invalid key attempt
      const badHeaders = new Headers({
        'x-admin-key': 'wrong_password_guess',
      });
      const badRes = await verifyAdminAccess(badHeaders);
      expect(badRes.isAuthorized).toBe(false);

      // Exact match key
      const goodHeaders = new Headers({
        'x-admin-key': 'super_secret_pawarna_key_2026',
      });
      const goodRes = await verifyAdminAccess(goodHeaders);
      expect(goodRes.isAuthorized).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Concurrency-Safe Durable Credit Accounting
  // ---------------------------------------------------------------------------
  describe('Durable Transactional Credit Accounting', () => {
    it('prevents two concurrent generation requests from double-spending credits', async () => {
      const workspaceId = 'ws_concurrency_test';
      // User has 10 credits in wallet (enough for only ONE 10s video)
      DurableStore.setWallet({
        workspaceId,
        balance: 10,
        reservedBalance: 0,
        lifetimeGranted: 10,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      // Two simultaneous reservation attempts for 10 credits
      const [res1, res2] = await Promise.all([
        DurableStore.reserveCredits(workspaceId, 'job_concurrent_1', 10, 'idem_concurrent_1'),
        DurableStore.reserveCredits(workspaceId, 'job_concurrent_2', 10, 'idem_concurrent_2'),
      ]);

      // Exactly ONE must succeed and the other must be rejected
      const successes = [res1.success, res2.success].filter(Boolean);
      const failures = [res1.success, res2.success].filter((s) => !s);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Final wallet state must accurately reflect 10 reserved and 0 available
      const finalWallet = await DurableStore.getWallet(workspaceId);
      expect(finalWallet.balance).toBe(10);
      expect(finalWallet.reservedBalance).toBe(10);
      expect(finalWallet.balance - finalWallet.reservedBalance).toBe(0);
    });

    it('guarantees idempotency on duplicate reservation requests', async () => {
      const workspaceId = 'ws_idempotency_test';
      DurableStore.setWallet({
        workspaceId,
        balance: 50,
        reservedBalance: 0,
        lifetimeGranted: 50,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      // Request 1
      const res1 = await DurableStore.reserveCredits(workspaceId, 'job_idem', 10, 'stable_idem_key_1');
      expect(res1.success).toBe(true);

      // Request 2 with same idempotency key
      const res2 = await DurableStore.reserveCredits(workspaceId, 'job_idem', 10, 'stable_idem_key_1');
      expect(res2.success).toBe(true);

      // Balance must only be reserved ONCE (10, not 20)
      const finalWallet = await DurableStore.getWallet(workspaceId);
      expect(finalWallet.reservedBalance).toBe(10);
    });

    it('settles charges on completed MP4 output and releases reservations on failure', async () => {
      const workspaceId = 'ws_settle_release';
      DurableStore.setWallet({
        workspaceId,
        balance: 50,
        reservedBalance: 0,
        lifetimeGranted: 50,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      // Job A: Success settlement
      await DurableStore.reserveCredits(workspaceId, 'job_success', 10, 'res_job_success');
      const settleRes = await DurableStore.settleCredits(workspaceId, 'job_success', 10, 'stl_job_success');
      expect(settleRes.success).toBe(true);

      const walletAfterSettle = await DurableStore.getWallet(workspaceId);
      expect(walletAfterSettle.balance).toBe(40);
      expect(walletAfterSettle.reservedBalance).toBe(0);

      // Job B: Failure release
      await DurableStore.reserveCredits(workspaceId, 'job_failed', 15, 'res_job_failed');
      expect((await DurableStore.getWallet(workspaceId)).reservedBalance).toBe(15);

      const releaseRes = await DurableStore.releaseCredits(workspaceId, 'job_failed', 'rel_job_failed');
      expect(releaseRes.success).toBe(true);

      const walletAfterRelease = await DurableStore.getWallet(workspaceId);
      expect(walletAfterRelease.balance).toBe(40);
      expect(walletAfterRelease.reservedBalance).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Provider Configuration Safety & No Silent Fallbacks
  // ---------------------------------------------------------------------------
  describe('Provider Safety & Configuration Errors', () => {
    it('throws explicit error when NEXABOT_API_KEY is missing in production and does NOT silently fall back to mock', () => {
      const originalKey = process.env.NEXABOT_API_KEY;
      const originalMock = process.env.USE_MOCK_PROVIDERS;

      try {
        delete process.env.NEXABOT_API_KEY;
        process.env.USE_MOCK_PROVIDERS = 'false';

        const router = new ProviderRouter({ useMockOnly: false });

        expect(() => {
          router.resolveProvider(10, 'nexabot');
        }).toThrow(/Ralat Konfigurasi Pelayan: Kunci API Nexabot/);
      } finally {
        process.env.NEXABOT_API_KEY = originalKey;
        process.env.USE_MOCK_PROVIDERS = originalMock;
      }
    });

    it('throws explicit error when RUNNINGHUB_API_KEY is missing in production', () => {
      const originalKey = process.env.RUNNINGHUB_API_KEY;
      const originalMock = process.env.USE_MOCK_PROVIDERS;

      try {
        delete process.env.RUNNINGHUB_API_KEY;
        process.env.USE_MOCK_PROVIDERS = 'false';

        const router = new ProviderRouter({ useMockOnly: false });

        expect(() => {
          router.resolveProvider(15, 'runninghub');
        }).toThrow(/Ralat Konfigurasi Pelayan: Kunci API RunningHub/);
      } finally {
        process.env.RUNNINGHUB_API_KEY = originalKey;
        process.env.USE_MOCK_PROVIDERS = originalMock;
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Voiceover Director & Truthfulness Validation
  // ---------------------------------------------------------------------------
  describe('Voiceover Director & Script Truthfulness Rules', () => {
    it('enforces Strictly NO spoken dialogue for RunningHub 15s videos', () => {
      const res = VoiceoverDirector.validateScript(
        'Korang tengok ni produk paling mantap!',
        {
          name: 'Pencuci Muka',
          category: 'Skincare',
          packagingFormat: 'bottle',
          sourceConfidence: 'ai_interpreted',
          verifiedFacts: [],
          prohibitedClaims: [],
        },
        'runninghub'
      );

      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('tidak dibenarkan mengandungi sebarang skrip pertuturan');
    });

    it('rejects Indonesian loanwords (kamu, kalian, nggak, banget, cobain)', () => {
      const res = VoiceoverDirector.validateScript(
        'Kalian wajib cobain produk ini karena bagus banget!',
        {
          name: 'Serum Wajah',
          category: 'Skincare',
          packagingFormat: 'bottle',
          sourceConfidence: 'ai_interpreted',
          verifiedFacts: [],
          prohibitedClaims: [],
        },
        'nexabot'
      );

      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('Perkataan slanga Indonesia dilarang'))).toBe(true);
    });

    it('rejects fake personal endorsements ("saya sendiri puas hati pakai")', () => {
      const res = VoiceoverDirector.validateScript(
        'Tengok barang ni, saya sendiri puas hati pakai dan sangat jimat!',
        {
          name: 'Sabun Mandi',
          category: 'Personal Care',
          packagingFormat: 'bottle',
          sourceConfidence: 'ai_interpreted',
          verifiedFacts: [],
          prohibitedClaims: [],
        },
        'nexabot'
      );

      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('Klaim peribadi atau janji keberkesanan tidak berasas dilarang'))).toBe(true);
    });

    it('rejects inappropriate verb "pakai" for food products', () => {
      const res = VoiceoverDirector.validateScript(
        'Sambal ni sedap bila korang pakai setiap hari!',
        {
          name: 'Sambal Nyet Berapi',
          category: 'Makanan & Masakan',
          packagingFormat: 'jar',
          sourceConfidence: 'verified_user',
          verifiedFacts: [],
          prohibitedClaims: [],
        },
        'nexabot'
      );

      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('Penggunaan kata kerja "pakai" tidak sesuai untuk produk makanan'))).toBe(true);
    });

    it('approves compliant, truthful Malaysian Malay script for food product', () => {
      const res = VoiceoverDirector.validateScript(
        'Korang tengok bungkusan sambal ni, bahan dia nampak berkualiti dan sedap bila dihidang bersama makanan.',
        {
          name: 'Sambal Bilis Garing',
          category: 'Makanan',
          packagingFormat: 'jar',
          sourceConfidence: 'verified_user',
          verifiedFacts: [],
          prohibitedClaims: [],
        },
        'nexabot'
      );

      expect(res.isValid).toBe(true);
      expect(res.errors.length).toBe(0);
    });

    it('DynamicPromptCompiler applies validation to all scripts and prevents duplicate CTAs', () => {
      const style = getVideoStyle('NX01')!;
      const product = {
        name: 'Serum Pencerah',
        category: 'Skincare',
        packagingFormat: 'bottle' as const,
        sourceConfidence: 'ai_interpreted' as const,
        verifiedFacts: [],
        prohibitedClaims: [],
      };

      const scenePlan = AICreativeDirector.createScenePlan(product, style);

      // Custom script with Indonesian word
      const compiledBad = DynamicPromptCompiler.compile(product, style, scenePlan, {
        customScript: 'Kalian wajib cobain serum ini!',
      });
      expect(compiledBad.preflightValid).toBe(false);
      expect(compiledBad.validationErrors.some((e) => e.includes('slanga Indonesia'))).toBe(true);

      // Compliant script
      const compiledGood = DynamicPromptCompiler.compile(product, style, scenePlan, {
        callToAction: 'spoken_button',
      });
      expect(compiledGood.preflightValid).toBe(true);
      expect(compiledGood.providerPrompt).toContain('Tekan butang di bawah');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Video Style Catalogue Accuracy
  // ---------------------------------------------------------------------------
  describe('Video Style Registry Verification', () => {
    it('verifies that only styles with documented test video evidence are marked quality_verified', () => {
      const verifiedStyles = VIDEO_STYLES_REGISTRY.filter((s) => s.qualityStatus === 'quality_verified');

      // NX01, NX02, NX09 have verified test MP4 videos
      expect(verifiedStyles.length).toBe(3);
      for (const s of verifiedStyles) {
        expect(s.previewVideoUrl).toBeTruthy();
        expect(s.previewVideoUrl).toContain('.mp4');
      }

      // Remaining styles are marked prompt_validated
      const validatedStyles = VIDEO_STYLES_REGISTRY.filter((s) => s.qualityStatus === 'prompt_validated');
      expect(validatedStyles.length).toBe(10);
      for (const s of validatedStyles) {
        expect(s.previewVideoUrl).toBeNull();
      }
    });
  });
});
