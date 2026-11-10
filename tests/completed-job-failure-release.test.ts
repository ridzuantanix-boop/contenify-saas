import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  listPendingJobsForReconciliation: vi.fn(),
  releaseCredits: vi.fn(),
  updateJobStatus: vi.fn(),
  getStatus: vi.fn(),
  getOutputs: vi.fn(),
  getJob: vi.fn(),
  scheduleProviderRetry: vi.fn(),
  recoverExpiredNexabotDispatchLeases: vi.fn().mockResolvedValue({success:true,safe_requeued:0,marked_uncertain:0}),
  expireUncertainNexabotJobs: vi.fn().mockResolvedValue({success:true,expired_count:0}),
  claimNextNexabotJob: vi.fn().mockResolvedValue({success:true,claimed:false}),
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
  it('schedules a bounded retry when completed provider output cannot be saved', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    mocks.listPendingJobsForReconciliation.mockResolvedValue([{
      id: 'old-job', workspaceId: 'workspace-1', provider: 'nexabot', providerTaskId: 'provider-job',
      durationSeconds: 15, createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    }]);
    mocks.getStatus.mockResolvedValue({ normalizedStatus: 'COMPLETED', rawStatus: 'done' });
    mocks.getOutputs.mockRejectedValue(new Error('Video provider unavailable'));
    mocks.releaseCredits.mockResolvedValue({ success: true });
    mocks.updateJobStatus.mockResolvedValue({});
    mocks.getJob.mockResolvedValue({ id:'old-job',workspaceId:'workspace-1',provider:'nexabot',providerTaskId:'provider-job' });
    mocks.scheduleProviderRetry.mockResolvedValue({ success:true,retry_scheduled:true,retry_count:1,max_retries:3,next_retry_at:new Date().toISOString() });

    const response = await POST(new NextRequest('http://localhost/api/jobs/reconcile', {
      method: 'POST', headers: { 'x-cron-secret': 'test-cron-secret' },
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).results.retryScheduled).toBe(1);
    expect(mocks.releaseCredits).not.toHaveBeenCalled();
  });

  it('keeps polling the same provider task after the hard timeout without duplicate submission', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    mocks.listPendingJobsForReconciliation.mockResolvedValue([{
      id: 'stuck-job', workspaceId: 'workspace-1', provider: 'nexabot', providerTaskId: 'provider-stuck',
      durationSeconds: 15, createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    }]);
    mocks.getStatus.mockResolvedValue({ normalizedStatus: 'PENDING', rawStatus: 'queued' });
    mocks.releaseCredits.mockResolvedValue({ success: true });
    mocks.updateJobStatus.mockResolvedValue({});
    mocks.getJob.mockResolvedValue({ id:'stuck-job',workspaceId:'workspace-1',provider:'nexabot',providerTaskId:'provider-stuck' });
    mocks.scheduleProviderRetry.mockResolvedValue({ success:true,retry_scheduled:true,retry_count:1,max_retries:3,next_retry_at:new Date().toISOString() });

    const response = await POST(new NextRequest('http://localhost/api/jobs/reconcile', {
      method: 'POST', headers: { 'x-cron-secret': 'test-cron-secret' },
    }));
    const body = await response.json();
    expect(body.results.stillProcessing).toBe(1);
    expect(mocks.updateJobStatus).toHaveBeenCalledWith('stuck-job',expect.objectContaining({rawStatus:'PROVIDER_DELAYED_SAME_TASK'}));
    expect(mocks.releaseCredits).not.toHaveBeenCalled();
  });
});
