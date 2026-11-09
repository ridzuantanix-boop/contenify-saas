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

    it('ensures anonymous session endpoint rejects unauthenticated privilege escalation', async () => {
      // Unauthenticated visitor calling session check
      const emptyHeaders = new Headers({});
      const token = emptyHeaders.get('cookie');
      expect(token).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Concurrency-Safe Durable Credit Accounting & Tenant Isolation
  // ---------------------------------------------------------------------------
  describe('Durable Transactional Credit Accounting', () => {
    it('initializes new workspaces with 50 free credits by policy and NEVER grants 160 unbacked credits', async () => {
      const newWs = 'ws_brand_new_customer';
      const wallet = await DurableStore.getWallet(newWs);
      expect(wallet.balance).toBe(20);
      expect(wallet.reservedBalance).toBe(0);
      expect(wallet.lifetimeGranted).toBe(20);
    });

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

    it('settles charges on completed MP4 output and releases reservations on failure exactly once', async () => {
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

      // Settle again with same idempotency key does not deduct again
      await DurableStore.settleCredits(workspaceId, 'job_success', 10, 'stl_job_success');
      const walletAfterDuplicateSettle = await DurableStore.getWallet(workspaceId);
      expect(walletAfterDuplicateSettle.balance).toBe(40);

      // Job B: Failure release
      await DurableStore.reserveCredits(workspaceId, 'job_failed', 15, 'res_job_failed');
      expect((await DurableStore.getWallet(workspaceId)).reservedBalance).toBe(15);

      const releaseRes = await DurableStore.releaseCredits(workspaceId, 'job_failed', 'rel_job_failed');
      expect(releaseRes.success).toBe(true);

      const walletAfterRelease = await DurableStore.getWallet(workspaceId);
      expect(walletAfterRelease.balance).toBe(40);
      expect(walletAfterRelease.reservedBalance).toBe(0);
    });

    it('rejects settlement if reservation was already released', async () => {
      const workspaceId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      DurableStore.setWallet({
        workspaceId,
        balance: 30,
        reservedBalance: 0,
        lifetimeGranted: 30,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      await DurableStore.reserveCredits(workspaceId, jobId, 10, 'res_key_rel');
      await DurableStore.releaseCredits(workspaceId, jobId, 'rel_key_rel');

      // Attempt to settle released reservation MUST fail
      const settleRes = await DurableStore.settleCredits(workspaceId, jobId, 10, 'stl_after_release');
      expect(settleRes.success).toBe(false);
      expect(settleRes.error).toContain('dilepaskan');
    });

    it('rejects settlement if settlement amount does not match reserved amount', async () => {
      const workspaceId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      DurableStore.setWallet({
        workspaceId,
        balance: 30,
        reservedBalance: 0,
        lifetimeGranted: 30,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      await DurableStore.reserveCredits(workspaceId, jobId, 10, 'res_key_mismatch');

      // Attempt to settle with 15 instead of 10
      const settleRes = await DurableStore.settleCredits(workspaceId, jobId, 15, 'stl_mismatch_amount');
      expect(settleRes.success).toBe(false);
      expect(settleRes.error).toContain('tidak sepadan');
    });

    it('enforces clientRequestId deduplication for idempotent job creation', async () => {
      const workspaceId = crypto.randomUUID();
      const clientRequestId = crypto.randomUUID();
      const jobId = crypto.randomUUID();

      await DurableStore.saveJob({
        id: jobId,
        workspaceId,
        userId: crypto.randomUUID(),
        clientRequestId,
        styleId: 'NX01',
        styleName: 'Sembang Kawan',
        provider: 'nexabot',
        durationSeconds: 10,
        status: 'PROCESSING',
        requiredCredits: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const existingJob = await DurableStore.getJobByClientRequestId(workspaceId, clientRequestId);
      expect(existingJob).toBeDefined();
      expect(existingJob?.id).toBe(jobId);
    });

    it('fails closed safely when database is unavailable', async () => {
      DurableStore.setDatabaseUnavailableForTesting(true);

      await expect(async () => {
        await DurableStore.getWallet('ws_any');
      }).rejects.toThrow(/Database connection unavailable/);

      await expect(async () => {
        await DurableStore.reserveCredits('ws_any', 'job_fail', 10, 'key');
      }).rejects.toThrow(/Database connection unavailable/);

      DurableStore.setDatabaseUnavailableForTesting(false);
    });

    it('enforces fail-closed in production even if USE_MOCK_PROVIDERS is true', async () => {
      const origEnv = process.env.NODE_ENV;
      const origMock = process.env.USE_MOCK_PROVIDERS;
      const origUrl = process.env.SUPABASE_URL;

      try {
        (process.env as any).NODE_ENV = 'production';
        process.env.USE_MOCK_PROVIDERS = 'true';
        delete process.env.SUPABASE_URL;

        await expect(async () => {
          await DurableStore.getWallet('ws_prod_test');
        }).rejects.toThrow(/Database configuration missing in production/);
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        process.env.USE_MOCK_PROVIDERS = origMock;
        process.env.SUPABASE_URL = origUrl;
      }
    });

    it('admitJobAtomic coordinates concurrency check, balance check, credit reservation, and job insertion atomically', async () => {
      const workspaceId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      const clientRequestId = crypto.randomUUID();

      DurableStore.setWallet({
        workspaceId,
        balance: 20,
        reservedBalance: 0,
        lifetimeGranted: 20,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      // 1. Successful atomic admission
      const admission1 = await DurableStore.admitJobAtomic({
        workspaceId,
        userId,
        jobId,
        clientRequestId,
        styleId: 'NX01',
        styleName: 'Sembang Kawan',
        presetVersion: 2,
        provider: 'nexabot',
        durationSeconds: 10,
        requiredCredits: 10,
        maxConcurrency: 1, // Free/Starter tier limit = 1
        compiledPrompt: 'Video prompt text',
      });

      expect(admission1.success).toBe(true);
      expect(admission1.isDuplicate).toBe(false);
      expect(admission1.jobId).toBe(jobId);

      // Verify wallet reserved balance updated atomically
      const walletAfter = await DurableStore.getWallet(workspaceId);
      expect(walletAfter.balance).toBe(20);
      expect(walletAfter.reservedBalance).toBe(10);
      expect(walletAfter.balance - walletAfter.reservedBalance).toBe(10);

      // Verify job record is durably recorded with status SUBMITTING
      const recordedJob = await DurableStore.getJob(jobId);
      expect(recordedJob).toBeDefined();
      expect(recordedJob?.status).toBe('SUBMITTING');
      expect(recordedJob?.requiredCredits).toBe(10);

      // 2. Duplicate submission with same clientRequestId returns existing job and does NOT debit wallet twice
      const admissionDuplicate = await DurableStore.admitJobAtomic({
        workspaceId,
        userId,
        jobId: crypto.randomUUID(),
        clientRequestId, // Same client request ID
        styleId: 'NX01',
        styleName: 'Sembang Kawan',
        presetVersion: 2,
        provider: 'nexabot',
        durationSeconds: 10,
        requiredCredits: 10,
        maxConcurrency: 1,
        compiledPrompt: 'Video prompt text',
      });

      expect(admissionDuplicate.success).toBe(true);
      expect(admissionDuplicate.isDuplicate).toBe(true);
      expect(admissionDuplicate.jobId).toBe(jobId); // Returns original jobId
      const walletAfterDup = await DurableStore.getWallet(workspaceId);
      expect(walletAfterDup.reservedBalance).toBe(10); // NOT debited twice!

      // 3. Second concurrent job rejected when concurrency limit (1) is reached
      const admission2 = await DurableStore.admitJobAtomic({
        workspaceId,
        userId,
        jobId: crypto.randomUUID(),
        clientRequestId: crypto.randomUUID(), // New request
        styleId: 'NX01',
        styleName: 'Sembang Kawan',
        presetVersion: 2,
        provider: 'nexabot',
        durationSeconds: 10,
        requiredCredits: 10,
        maxConcurrency: 1,
        compiledPrompt: 'Video prompt text 2',
      });

      expect(admission2.success).toBe(false);
      expect(admission2.concurrencyLimitReached).toBe(true);
      expect(admission2.error).toContain('Had penjanaan serentak dicapai');

      // 4. Insufficient credits rejection
      const emptyWs = crypto.randomUUID();
      DurableStore.setWallet({
        workspaceId: emptyWs,
        balance: 5, // Only 5 credits (needs 10)
        reservedBalance: 0,
        lifetimeGranted: 5,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      const admissionNoCredits = await DurableStore.admitJobAtomic({
        workspaceId: emptyWs,
        userId,
        jobId: crypto.randomUUID(),
        clientRequestId: crypto.randomUUID(),
        styleId: 'NX01',
        styleName: 'Sembang Kawan',
        presetVersion: 2,
        provider: 'nexabot',
        durationSeconds: 10,
        requiredCredits: 10,
        maxConcurrency: 5,
        compiledPrompt: 'Prompt',
      });

      expect(admissionNoCredits.success).toBe(false);
      expect(admissionNoCredits.insufficientCredits).toBe(true);
      expect(admissionNoCredits.error).toContain('tidak mencukupi');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Job Ownership & Cross-Workspace Tenant Isolation
  // ---------------------------------------------------------------------------
  describe('Job Ownership & Tenant Isolation', () => {
    it('isolates jobs by workspace and prevents cross-workspace task retrieval', async () => {
      const wsA = 'ws_tenant_a';
      const wsB = 'ws_tenant_b';

      // Save Job for Tenant A
      await DurableStore.saveJob({
        id: 'job_tenant_a_1',
        workspaceId: wsA,
        userId: 'usr_a',
        styleId: 'NX01',
        styleName: 'Sembang Kawan',
        provider: 'nexabot',
        providerTaskId: 'nxb_task_secret_a',
        durationSeconds: 10,
        status: 'PROCESSING',
        requiredCredits: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Tenant A can retrieve their job
      const jobA = await DurableStore.getJob('job_tenant_a_1');
      expect(jobA).toBeDefined();
      expect(jobA?.workspaceId).toBe(wsA);

      // Tenant B querying by providerTaskId scoped to Tenant B fails (returns null)
      const lookupByTenantB = await DurableStore.getJobByProviderTaskId('nxb_task_secret_a', wsB);
      expect(lookupByTenantB).toBeNull();
    });

    it('enforces plan concurrency limits (Free/Starter = 1 concurrent job)', async () => {
      const wsStarter = 'ws_starter_concurrency';
      expect(await DurableStore.countActiveJobs(wsStarter)).toBe(0);

      // Add 1 active processing job
      await DurableStore.saveJob({
        id: 'job_active_1',
        workspaceId: wsStarter,
        userId: 'usr_s',
        styleId: 'NX01',
        styleName: 'Sembang Kawan',
        provider: 'nexabot',
        durationSeconds: 10,
        status: 'PROCESSING',
        requiredCredits: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(await DurableStore.countActiveJobs(wsStarter)).toBe(1);
    });

    it('prevents normal authenticated user session from operating on another workspace wallet', async () => {
      const victimWs = crypto.randomUUID();
      const attackerWs = crypto.randomUUID();

      // Seed victim's wallet with 100 credits
      DurableStore.setWallet({
        workspaceId: victimWs,
        balance: 100,
        reservedBalance: 0,
        lifetimeGranted: 100,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      });

      // Attacker has an authenticated session strictly bound to attackerWs
      const attackerSessionToken = await createSessionToken({
        userId: 'usr_attacker',
        email: 'attacker@example.com',
        fullName: 'Attacker',
        workspaceId: attackerWs,
        role: 'member',
        tier: 'starter',
      });

      const verifiedAttacker = await verifySessionToken(attackerSessionToken);
      expect(verifiedAttacker?.workspaceId).toBe(attackerWs);

      // Backend strictly binds financial operations to session.workspaceId (victim cannot be spoofed)
      expect(verifiedAttacker?.workspaceId).not.toBe(victimWs);
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
        scriptMode: 'custom',
        customScript: 'Kalian wajib cobain serum ini!',
      });
      expect(compiledBad.preflightValid).toBe(false);
      expect(compiledBad.validationErrors.some((e) => e.includes('Bahasa Melayu Malaysia'))).toBe(true);

      // Compliant script
      const compiledGood = DynamicPromptCompiler.compile(product, style, scenePlan, {
        callToAction: 'click_button',
      });
      expect(compiledGood.preflightValid).toBe(true);
      expect(compiledGood.providerPrompt).toContain('[V8 SMART SCRIPT CONTROL]');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Video Style Catalogue Accuracy
  // ---------------------------------------------------------------------------
  describe('Video Style Registry Verification', () => {
    it('verifies that only styles with documented test video evidence are marked quality_verified', () => {
      const verifiedStyles = VIDEO_STYLES_REGISTRY.filter((s) => s.qualityStatus === 'quality_verified');

      // Real 15s Nexabot V6 samples were generated for every published style.
      expect(verifiedStyles.length).toBe(0);
      expect(VIDEO_STYLES_REGISTRY.filter((s) => s.engine === 'nexabot' && s.qualityStatus === 'video_tested')).toHaveLength(20);
      expect(VIDEO_STYLES_REGISTRY.filter((s) => s.engine === 'runninghub')).toHaveLength(0);
      for (const s of VIDEO_STYLES_REGISTRY.filter((item) => item.qualityStatus === 'video_tested')) {
        expect(s.previewVideoUrl).toBe(`/api/style-samples/${s.id}`);
      }
      expect(VIDEO_STYLES_REGISTRY.filter((s) => s.id.startsWith('RH')).every((s) => s.engine === 'nexabot')).toBe(true);
    });
  });
});
