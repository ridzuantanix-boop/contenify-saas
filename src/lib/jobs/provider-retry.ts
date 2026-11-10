import { DurableStore, VideoJobRecord } from '@/lib/db/store';
import { ProviderRouter } from '@/lib/providers/router';
import { findOfficialAvatar, findOfficialBackground, officialAssetDataUri } from '@/lib/personalization/official-assets';
import { privateImageDataUri } from '@/lib/storage/supabase-assets';
import { customerFailureMessage } from './customer-failure';

const router = new ProviderRouter();

export function isRetryableProviderFailure(raw: unknown): boolean {
  const detail = raw instanceof Error ? raw.message : String(raw || '');
  // Only explicit permanent/customer-input errors stop immediately. A bare
  // "failed" or "rejected" from Nexabot is treated as provider-side transient.
  return !/unauthori[sz]ed|invalid api key|insufficient credit|payment required|moderation|policy violation|unsafe content|invalid (image|media|mime)|unsupported (mode|format)|missing required|http 400|stored .* (unavailable|no longer exists)|reference is unavailable/i.test(detail);
}

async function databaseRows(path: string) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Retry asset database is not configured.');
  const response = await fetch(`${base.replace(/\/$/,'')}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Retry asset lookup HTTP ${response.status}`);
  return response.json() as Promise<Array<Record<string, any>>>;
}

async function officialSource(relativePath: string) {
  const base = process.env.APP_BASE_URL || 'https://affimatik.online';
  const headers: Record<string,string> = {};
  if (process.env.STAGING_GATE_SECRET) headers['x-affimatik-staging-key'] = process.env.STAGING_GATE_SECRET;
  return officialAssetDataUri(new Request(new URL(relativePath, base), { headers }), relativePath);
}

export async function resolvePersistedProviderReferences(job: VideoJobRecord) {
  const options = job.inputOptions || {};
  const imageAssetId = typeof options.imageAssetId === 'string' ? options.imageAssetId : '';
  if (!/^[0-9a-f-]{36}$/i.test(imageAssetId)) throw new Error('Stored product image reference is unavailable for retry.');
  const product = await databaseRows(`product_images?id=eq.${encodeURIComponent(imageAssetId)}&workspace_id=eq.${encodeURIComponent(job.workspaceId)}&select=r2_key,mime_type&limit=1`);
  if (!product.length) throw new Error('Stored product image no longer exists for retry.');
  const mainImage = await privateImageDataUri(String(product[0].r2_key), String(product[0].mime_type));
  const references: string[] = [];

  const avatarId = typeof options.avatarId === 'string' ? options.avatarId : '';
  if (avatarId) {
    const official = findOfficialAvatar(avatarId);
    if (official) references.push(await officialSource(official.referenceUrl));
    else {
      const rows = await databaseRows(`avatars?id=eq.${encodeURIComponent(avatarId)}&workspace_id=eq.${encodeURIComponent(job.workspaceId)}&consent_confirmed=eq.true&select=image_r2_key&limit=1`);
      if (!rows.length) throw new Error('Stored avatar no longer exists for retry.');
      const key = String(rows[0].image_r2_key); references.push(await privateImageDataUri(key, key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg'));
    }
  }
  const backgroundId = typeof options.backgroundId === 'string' ? options.backgroundId : '';
  if (backgroundId) {
    const official = findOfficialBackground(backgroundId);
    if (official) references.push(await officialSource(official.referenceUrl));
    else {
      const rows = await databaseRows(`background_assets?id=eq.${encodeURIComponent(backgroundId)}&workspace_id=eq.${encodeURIComponent(job.workspaceId)}&select=image_r2_key,mime_type&limit=1`);
      if (!rows.length) throw new Error('Stored background no longer exists for retry.');
      references.push(await privateImageDataUri(String(rows[0].image_r2_key), String(rows[0].mime_type)));
    }
  }
  return { mainImage, references };
}

export async function scheduleOrFinalizeProviderFailure(jobId: string, expectedTaskId: string | null, raw: unknown) {
  const job = await DurableStore.getJob(jobId);
  if (!job) return { retryScheduled: false, finalized: false, error: 'JOB_NOT_FOUND' };
  const technical = raw instanceof Error ? raw.message : String(raw || 'provider failure');
  if (job.provider !== 'nexabot' || !isRetryableProviderFailure(technical)) {
    await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_terminal_${job.id}`);
    await DurableStore.updateJobStatus(job.id, { status: 'FAILED', errorMessage: customerFailureMessage(technical), rawStatus: technical.slice(0,1000) });
    return { retryScheduled: false, finalized: true, creditRestored: true };
  }
  const scheduled = await DurableStore.scheduleProviderRetry(job.id, expectedTaskId, technical);
  if (scheduled.stale_observation) return { retryScheduled: false, staleObservation: true };
  if (scheduled.retry_scheduled) return { retryScheduled: true, retryCount: Number(scheduled.retry_count), maxRetries: Number(scheduled.max_retries), nextRetryAt: String(scheduled.next_retry_at) };
  if (scheduled.retry_exhausted) {
    await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_retry_exhausted_${job.id}`);
    const message = 'Pelayan Nexabot masih tidak dapat menyiapkan video selepas tiga cubaan semula automatik. Kredit tugasan ini telah dipulangkan sepenuhnya.';
    await DurableStore.updateJobStatus(job.id, { status: 'FAILED', errorMessage: message, rawStatus: technical.slice(0,1000) });
    return { retryScheduled: false, finalized: true, creditRestored: true, exhausted: true };
  }
  return { retryScheduled: false, finalized: false, error: scheduled.error || 'RETRY_NOT_SCHEDULED' };
}

export async function dispatchDueProviderRetry(job: VideoJobRecord) {
  const claim = await DurableStore.claimProviderRetry(job.id);
  if (!claim.claimed) return { claimed: false };
  try {
    if (!job.compiledPromptSnapshot) throw new Error('Stored provider prompt is unavailable for retry.');
    const { mainImage, references } = await resolvePersistedProviderReferences(job);
    const adapter = router.resolveProvider(job.durationSeconds as 10|15, job.provider, true);
    const result = await adapter.submit({
      jobId: job.id, workspaceId: job.workspaceId,
      idempotencyKey: `idem_${job.id}_retry_${job.retryCount || claim.retry_count || 1}`,
      prompt: job.compiledPromptSnapshot, durationSeconds: job.durationSeconds as 10|15, aspectRatio: '9:16',
      mainImageKeyOrUrl: mainImage, referenceImageKeysOrUrls: references,
    });
    // The provider may already be charging/processing this task, so never turn a
    // transient database write failure into a fresh retry attempt with a new
    // idempotency key. Retry only the task-id persistence write here. If the DB
    // remains unavailable, the claim lease expires and replays the SAME attempt
    // key, allowing Nexabot's idempotency protection to return the same task.
    let completed: Record<string, any> = { success: false };
    for (let attempt = 0; attempt < 3 && !completed.success; attempt++) {
      try {
        completed = await DurableStore.completeProviderRetryDispatch(job.id, result.providerTaskId);
      } catch (error) {
        if (attempt === 2) return { claimed: true, submitted: false, persistencePending: true, providerTaskId: result.providerTaskId,
          error: error instanceof Error ? error.message : String(error) };
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
    if (!completed.success) return { claimed: true, submitted: false, persistencePending: true, providerTaskId: result.providerTaskId,
      error: String(completed.error || 'Retry task id could not be persisted') };
    return { claimed: true, submitted: true, providerTaskId: result.providerTaskId };
  } catch (error) {
    return { claimed: true, submitted: false, ...(await scheduleOrFinalizeProviderFailure(job.id, null, error)) };
  }
}
