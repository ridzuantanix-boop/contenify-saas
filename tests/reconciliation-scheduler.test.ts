import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../src/app/api/jobs/reconcile/route';
import { DurableStore } from '../src/lib/db/store';
import workerHandler from '../workers/cron-reconciler/index';

describe('Scheduled Reconciliation Worker & Job Recovery Suite', () => {
  const TEST_CRON_SECRET = 'affimatik_super_secret_cron_key_9999';

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
  });

  it('rejects unauthenticated requests without cron secret with HTTP 403', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/reconcile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Akses Ditolak');
  });

  it('authorizes requests with matching x-cron-secret header', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/reconcile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': TEST_CRON_SECRET,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toBeDefined();
    expect(body.reconciledAt).toBeDefined();
  });

  it('authorizes requests with matching Bearer authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/reconcile', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${TEST_CRON_SECRET}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('proves that worker scheduled() handler executes, delivers cron secret, and recovers jobs', async () => {
    // 1. Setup a test workspace and wallet
    const wsId = 'rec-ws-001';
    await DurableStore.getWallet(wsId);
    await DurableStore.adjustCredits(wsId, 20, 'Purchased-credit test fixture', 'qa@affimatik.local');

    // 2. Setup an expired orphaned job without provider task id
    const expiredJobId = 'job_expired_orphan_99';
    await DurableStore.saveJob({
      id: expiredJobId,
      workspaceId: wsId,
      userId: 'user-001',
      clientRequestId: 'req-expired-orphan',
      styleId: 'NX01',
      styleName: 'Sembang Kawan',
      provider: 'nexabot',
      durationSeconds: 10,
      requiredCredits: 10,
      status: 'SUBMITTING',
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40 mins ago (> 30m timeout)
      updatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    });
    // Reserve credits
    await DurableStore.reserveCredits(wsId, expiredJobId, 10, `res_${expiredJobId}`);

    // Verify wallet has 10 reserved
    const walletBefore = await DurableStore.getWallet(wsId);
    expect(walletBefore.reservedBalance).toBe(10);

    // 3. Mock fetch within the scheduled handler to direct to the local Next.js handler
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/jobs/reconcile')) {
        const req = new NextRequest(url, {
          method: init?.method || 'POST',
          headers: init?.headers as any,
          body: init?.body as any,
        });
        const res = await POST(req);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };

    try {
      // 4. Simulate Cloudflare Worker scheduled event trigger
      await workerHandler.scheduled(
        {
          cron: '*/5 * * * *',
          type: 'cron',
          scheduledTime: Date.now(),
        },
        {
          APP_BASE_URL: 'http://localhost:3000',
          CRON_SECRET: TEST_CRON_SECRET,
        },
        {
          waitUntil: () => {},
          passThroughOnException: () => {},
        }
      );

      // 5. Verify orphaned job was safely released and marked FAILED
      const jobAfter = await DurableStore.getJob(expiredJobId);
      expect(jobAfter?.status).toBe('FAILED');
      expect(jobAfter?.errorMessage).toContain('Pelayan AI Sedang Terganggu');

      // Verify wallet reserved credits released back to balance
      const walletAfter = await DurableStore.getWallet(wsId);
      expect(walletAfter.reservedBalance).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
