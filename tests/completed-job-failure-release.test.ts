import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  listPendingJobsForReconciliation: vi.fn(),
  releaseCredits: vi.fn(),
  updateJobStatus: vi.fn(),
  getStatus: vi.fn(),
  getOutputs: vi.fn(),
}));
vi.mock('@/lib/auth/admin-guard', () => ({ verifyAdminAccess: vi.fn().mockResolvedValue({ isAuthorized: false }) }));
vi.mock('@/lib/db/store', () => ({ DurableStore: mocks }));
vi.mock('@/lib/providers/router', () => ({
  ProviderRouter: class {
    resolveProvider() { return { getStatus: mocks.getStatus, getOutputs: mocks.getOutputs }; }
  },
}));

import { POST } from '../src/app/api/jobs/reconcile/route';

describe('credit-safe reconciliation of completed provider jobs', () => {
  it('releases a stale reservation when the provider output cannot be saved', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    mocks.listPendingJobsForReconciliation.mockResolvedValue([{
      id: 'old-job', workspaceId: 'workspace-1', provider: 'nexabot', providerTaskId: 'provider-job',
      durationSeconds: 15, createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    }]);
    mocks.getStatus.mockResolvedValue({ normalizedStatus: 'COMPLETED', rawStatus: 'done' });
    mocks.getOutputs.mockRejectedValue(new Error('Video provider unavailable'));
    mocks.releaseCredits.mockResolvedValue({ success: true });
    mocks.updateJobStatus.mockResolvedValue({});

    const response = await POST(new NextRequest('http://localhost/api/jobs/reconcile', {
      method: 'POST', headers: { 'x-cron-secret': 'test-cron-secret' },
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).results.released).toBe(1);
    expect(mocks.releaseCredits).toHaveBeenCalledWith('workspace-1', 'old-job', 'rel_err_old-job');
    expect(mocks.updateJobStatus).toHaveBeenCalledWith('old-job', expect.objectContaining({ status: 'FAILED' }));
  });

  it('closes an indefinitely pending provider task after the hard timeout', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    mocks.listPendingJobsForReconciliation.mockResolvedValue([{
      id: 'stuck-job', workspaceId: 'workspace-1', provider: 'nexabot', providerTaskId: 'provider-stuck',
      durationSeconds: 15, createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    }]);
    mocks.getStatus.mockResolvedValue({ normalizedStatus: 'PENDING', rawStatus: 'queued' });
    mocks.releaseCredits.mockResolvedValue({ success: true });
    mocks.updateJobStatus.mockResolvedValue({});

    const response = await POST(new NextRequest('http://localhost/api/jobs/reconcile', {
      method: 'POST', headers: { 'x-cron-secret': 'test-cron-secret' },
    }));
    const body = await response.json();
    expect(body.results.released).toBe(1);
    expect(mocks.releaseCredits).toHaveBeenCalledWith('workspace-1', 'stuck-job', 'rel_hard_timeout_stuck-job');
    expect(mocks.updateJobStatus).toHaveBeenCalledWith('stuck-job', expect.objectContaining({
      status: 'FAILED',
      errorMessage: expect.stringContaining('Kredit untuk tugasan ini telah dipulangkan'),
    }));
  });
});
