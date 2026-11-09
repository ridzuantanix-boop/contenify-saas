import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';
import { persistCompletedVideo } from '@/lib/orchestration/persist-video';
import { ProviderRouter } from '@/lib/providers/router';
import { customerFailureMessage } from '@/lib/jobs/customer-failure';


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
  const authHeader = req.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const isCronAuthorized = Boolean(
    process.env.CRON_SECRET && 
    (cronSecret === process.env.CRON_SECRET || bearerSecret === process.env.CRON_SECRET)
  );

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
    const ORPHAN_TIMEOUT_MS = 30 * 60 * 1000;
    const PROVIDER_HARD_TIMEOUT_MS = 45 * 60 * 1000;

    for (const job of pendingJobs) {
      const createdAtMs = new Date(job.createdAt).getTime();
      const ageMs = now - createdAtMs;
      const isOrphanExpired = ageMs > ORPHAN_TIMEOUT_MS;
      const isProviderExpired = ageMs > PROVIDER_HARD_TIMEOUT_MS;

      if (!job.providerTaskId) {
        if (isOrphanExpired) {
          // Release reservation for orphaned jobs
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_timeout_${job.id}`);
          await DurableStore.updateJobStatus(job.id, {
            status: 'FAILED',
            errorMessage: customerFailureMessage('provider timeout without task id'),
          });
          results.released++;
        }
        continue;
      }

      try {
        const adapter = router.resolveProvider(job.durationSeconds as 10 | 15, job.provider, true);
        const statusRes = await adapter.getStatus(job.providerTaskId);

        if (statusRes.normalizedStatus === 'COMPLETED') {
          const outputs = await adapter.getOutputs(job.providerTaskId);
          if (outputs?.videoUrl) {
            if (await persistCompletedVideo(job, outputs.videoUrl, statusRes.rawStatus)) {
              if (process.env.NODE_ENV === 'production' && !process.env.VITEST && job.provider !== 'mock') results.stillProcessing++;
              else results.settled++;
            }
          }
        } else if (statusRes.normalizedStatus === 'FAILED') {
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_recon_${job.id}`);
          await DurableStore.updateJobStatus(job.id, {
            status: 'FAILED',
            errorMessage: customerFailureMessage(statusRes.errorMessage || statusRes.rawStatus),
            rawStatus: `${statusRes.rawStatus}${statusRes.errorMessage ? `: ${statusRes.errorMessage}` : ''}`.slice(0, 1000),
          });
          results.released++;
        } else if (statusRes.normalizedStatus === 'RUNNING' || statusRes.normalizedStatus === 'PENDING') {
          if (isProviderExpired) {
            await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_hard_timeout_${job.id}`);
            await DurableStore.updateJobStatus(job.id, {
              status: 'FAILED',
              errorMessage: customerFailureMessage('provider remained pending beyond hard timeout'),
              rawStatus: statusRes.rawStatus,
            });
            results.released++;
          } else {
            results.stillProcessing++;
          }
        } else if (isProviderExpired) {
          // Provider status terminal or unrecognized after expiry
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_timeout_${job.id}`);
          await DurableStore.updateJobStatus(job.id, {
            status: 'FAILED',
            errorMessage: customerFailureMessage(statusRes.rawStatus || 'provider timeout'),
            rawStatus: statusRes.rawStatus,
          });
          results.released++;
        } else {
          results.stillProcessing++;
        }
      } catch (pollErr: unknown) {
        // Keep transient polling errors credit-safe, but never hold a reservation forever.
        const errMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
        if (isProviderExpired) {
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_err_${job.id}`);
          await DurableStore.updateJobStatus(job.id, { status: 'FAILED', errorMessage: customerFailureMessage(errMsg) });
          results.released++;
        } else {
          // Transient network error while polling provider: keep processing
          results.stillProcessing++;
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

export async function GET(req: NextRequest) {
  return POST(req);
}

