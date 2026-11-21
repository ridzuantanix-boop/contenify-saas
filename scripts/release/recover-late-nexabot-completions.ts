import { DurableStore } from '../../src/lib/db/store';
import { ProviderRouter } from '../../src/lib/providers/router';
import { ingestProviderMp4 } from '../../src/lib/storage/supabase-assets';

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((value) => value.startsWith('--limit='));
  const jobArg = process.argv.find((value) => value.startsWith('--job='));
  const requestedJobId = jobArg?.split('=')[1] || '';
  const limit = Math.max(1, Math.min(50, Number(limitArg?.split('=')[1] || 20)));
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !process.env.NEXABOT_API_KEY) throw new Error('Production recovery credentials are required.');

  if (requestedJobId && !/^[0-9a-f-]{36}$/i.test(requestedJobId)) throw new Error('Invalid --job identifier.');
  const jobFilter = requestedJobId ? `&id=eq.${encodeURIComponent(requestedJobId)}` : '';
  const response = await fetch(`${base}/rest/v1/video_jobs?provider=eq.nexabot&status=eq.FAILED&provider_task_id=not.is.null${jobFilter}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())}&order=created_at.asc&limit=${limit}&select=id` , {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Recovery candidate lookup HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const dbHeaders = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const patch = async (path: string, body: Record<string, unknown>) => {
    const result = await fetch(`${base}/rest/v1/${path}`, { method: 'PATCH', headers: { ...dbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    if (!result.ok) throw new Error(`Recovery metadata update HTTP ${result.status}: ${(await result.text()).slice(0, 300)}`);
  };

  const rows = await response.json() as Array<{ id: string }>;
  const router = new ProviderRouter();
  const results: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    try {
      const job = await DurableStore.getJob(row.id);
      if (!job?.providerTaskId || job.status !== 'FAILED' || job.provider !== 'nexabot') continue;
      const adapter = router.resolveProvider(job.durationSeconds as 10 | 15, 'nexabot', true);
      const status = await adapter.getStatus(job.providerTaskId);
      if (status.normalizedStatus !== 'COMPLETED') {
        results.push({ jobId: job.id, taskId: job.providerTaskId, providerStatus: status.rawStatus, recovered: false, reason: 'NOT_COMPLETED' });
        continue;
      }
      if (!apply) {
        results.push({ jobId: job.id, taskId: job.providerTaskId, providerStatus: status.rawStatus, recovered: false, reason: 'DRY_RUN_READY' });
        continue;
      }
      const output = await adapter.getOutputs(job.providerTaskId);
      if (!output.videoUrl) throw new Error('Provider completed without a downloadable video URL.');
      const stored = await ingestProviderMp4('nexabot', output.videoUrl, job.workspaceId, job.id, true);
      if (Math.abs(stored.durationSeconds - job.durationSeconds) > 0.5 || !stored.hasAudio) {
        throw new Error(`Recovered MP4 failed media validation (duration=${stored.durationSeconds}, audio=${stored.hasAudio}).`);
      }
      const saved = await DurableStore.updateJobStatus(job.id, {
        status: 'COMPLETED',
        videoObjectKey: stored.objectKey,
        videoUrl: `/api/videos/${job.id}/stream`,
        actualDurationSeconds: stored.durationSeconds,
        outputHasAudio: stored.hasAudio,
        outputSizeBytes: stored.sizeBytes,
        rawStatus: `LATE_PROVIDER_COMPLETION:${status.rawStatus}`,
      });
      const recovered = saved?.status === 'COMPLETED' && saved.videoObjectKey === stored.objectKey;
      const autoFactoryBatchId = typeof job.inputOptions?.autoFactoryBatchId === 'string'
        ? job.inputOptions.autoFactoryBatchId
        : '';
      if (recovered && autoFactoryBatchId) {
        await patch(`auto_factory_items?job_id=eq.${encodeURIComponent(job.id)}`, { status: 'COMPLETED', error_message: null, updated_at: new Date().toISOString() });
        const itemResponse = await fetch(`${base}/rest/v1/auto_factory_items?batch_id=eq.${encodeURIComponent(autoFactoryBatchId)}&select=status`, { headers: dbHeaders, cache: 'no-store' });
        if (!itemResponse.ok) throw new Error(`Recovery batch lookup HTTP ${itemResponse.status}`);
        const items = await itemResponse.json() as Array<{ status: string }>;
        const completed = items.filter((item) => item.status === 'COMPLETED').length;
        const failed = items.filter((item) => item.status === 'FAILED').length;
        const terminal = items.every((item) => ['COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED'].includes(item.status));
        await patch(`auto_factory_batches?id=eq.${encodeURIComponent(autoFactoryBatchId)}`, {
          completed_jobs: completed,
          failed_jobs: failed,
          status: terminal ? 'COMPLETED' : 'RUNNING',
          updated_at: new Date().toISOString(),
        });
      }
      const latest = recovered ? null : await DurableStore.getJob(job.id);
      results.push({
        jobId: job.id,
        taskId: job.providerTaskId,
        providerStatus: status.rawStatus,
        recovered,
        ...(recovered ? {} : {
          reason: latest?.errorMessage || 'PERSIST_RETURNED_FALSE',
          observedJobStatus: job.status,
          latestJobStatus: latest?.status,
          actualDurationSeconds: latest?.actualDurationSeconds,
          outputHasAudio: latest?.outputHasAudio,
        }),
      });
    } catch (error) {
      results.push({ jobId: row.id, recovered: false, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(JSON.stringify({ apply, candidates: rows.length, recovered: results.filter((item) => item.recovered).length, results }, null, 2));
  if (apply && results.some((item) => item.providerStatus === 'done' && item.recovered !== true)) process.exitCode = 2;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
