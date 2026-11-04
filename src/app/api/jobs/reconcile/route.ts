import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';
import { ProviderRouter } from '@/lib/providers/router';

export const runtime = 'edge';

const router = new ProviderRouter();

/**
 * Background Reconciliation Endpoint
 * Protects credit settlement independently of whether customer kept their browser open.
 * Periodically reconciles in-flight pending jobs, settles completed jobs, and releases expired reservations.
 */
export async function POST(req: NextRequest) {
  // Only accessible via authorized admin or server cron secret
  const auth = await verifyAdminAccess(req);
  const cronSecret = req.headers.get('x-cron-secret');
  const isCronAuthorized = process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  if (!auth.isAuthorized && !isCronAuthorized) {
    return NextResponse.json({ error: 'Akses Ditolak: Hanya pentadbir atau cron sistem dibenarkan.' }, { status: 403 });
  }

  try {
    const pendingJobs = await DurableStore.listPendingJobsForReconciliation();
    const results = {
      totalPending: pendingJobs.length,
      settled: 0,
      released: 0,
      stillProcessing: 0,
    };

    const now = Date.now();
    const EXPIRY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes expiration threshold

    for (const job of pendingJobs) {
      const createdAtMs = new Date(job.createdAt).getTime();
      const isExpired = now - createdAtMs > EXPIRY_TIMEOUT_MS;

      if (!job.providerTaskId) {
        if (isExpired) {
          // Release reservation for orphaned jobs
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_timeout_${job.id}`);
          await DurableStore.updateJobStatus(job.id, {
            status: 'FAILED',
            errorMessage: 'Masa menunggu penjanaan tamat (Tiada respons pembekal).',
          });
          results.released++;
        }
        continue;
      }

      try {
        const adapter = router.resolveProvider(10, job.provider, true);
        const statusRes = await adapter.getStatus(job.providerTaskId);

        if (statusRes.normalizedStatus === 'COMPLETED') {
          const outputs = await adapter.getOutputs(job.providerTaskId);
          if (outputs?.videoUrl) {
            await DurableStore.settleCredits(job.workspaceId, job.id, job.requiredCredits, `stl_recon_${job.id}`);
            await DurableStore.updateJobStatus(job.id, {
              status: 'COMPLETED',
              videoUrl: outputs.videoUrl,
              rawStatus: statusRes.rawStatus,
            });
            results.settled++;
          }
        } else if (statusRes.normalizedStatus === 'FAILED' || isExpired) {
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_recon_${job.id}`);
          await DurableStore.updateJobStatus(job.id, {
            status: 'FAILED',
            errorMessage: statusRes.rawStatus || 'Tugasan tamat tempoh.',
            rawStatus: statusRes.rawStatus,
          });
          results.released++;
        } else {
          results.stillProcessing++;
        }
      } catch {
        if (isExpired) {
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_err_${job.id}`);
          await DurableStore.updateJobStatus(job.id, { status: 'FAILED', errorMessage: 'Ralat penyelarasan status pembekal.' });
          results.released++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      reconciledAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
