import { DurableStore, VideoJobRecord } from '@/lib/db/store';
import { ingestProviderMp4 } from '@/lib/storage/supabase-assets';
import { customerFailureMessage } from '@/lib/jobs/customer-failure';
import { recordServerConversion } from '@/lib/analytics/conversion';
import { assessMediaQuality } from '@/lib/quality/media-quality';
import { recordMediaQuality } from '@/lib/quality/quality-store';

async function persistProviderVideo(job: VideoJobRecord, providerUrl: string, rawStatus: string, settleReservation: boolean): Promise<boolean> {
  let objectKey = job.videoObjectKey;
  let videoDetails: { actualDurationSeconds?: number; outputHasAudio?: boolean; outputSizeBytes?: number } = {};
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST && job.provider !== 'mock' && !objectKey) {
    let stored;
    try {
      stored = await ingestProviderMp4(job.provider, providerUrl, job.workspaceId, job.id, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/bukan MP4|trek video|Saiz MP4|Domain sumber video|Kandungan video tersimpan tidak sepadan|Saiz video tersimpan tidak sepadan|Video tersimpan tidak lengkap/i.test(message)) {
        await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_media_${job.id}`);
        await DurableStore.updateJobStatus(job.id, { status: 'FAILED', errorMessage: customerFailureMessage(message) });
        return false;
      }
      throw error;
    }
    objectKey = stored.objectKey;
    videoDetails = { actualDurationSeconds: stored.durationSeconds, outputHasAudio: stored.hasAudio, outputSizeBytes: stored.sizeBytes };
    await DurableStore.updateJobStatus(job.id, { videoObjectKey: objectKey, ...videoDetails });
  }
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST && job.provider !== 'mock' && !objectKey) {
    throw new Error('Video belum disimpan dalam storan peribadi.');
  }
  const actualDuration = videoDetails.actualDurationSeconds ?? job.actualDurationSeconds;
  const hasAudio = videoDetails.outputHasAudio ?? job.outputHasAudio;
  const assessment = assessMediaQuality({
    expectedDurationSeconds: job.durationSeconds,
    actualDurationSeconds: actualDuration,
    hasAudio,
    sizeBytes: videoDetails.outputSizeBytes ?? job.outputSizeBytes,
    speechExpected: job.provider === 'nexabot',
  });
  await recordMediaQuality(job.id, assessment).catch(() => false);
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST && job.provider === 'nexabot' &&
      (actualDuration === undefined || Math.abs(actualDuration - job.durationSeconds) > 0.5 || hasAudio !== true)) {
    await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_media_${job.id}`);
    await DurableStore.updateJobStatus(job.id, { status: 'FAILED', errorMessage: customerFailureMessage('Video pembekal tidak menepati tempoh atau audio gaya Voice.') });
    return false;
  }
  if (settleReservation) {
    const settled = await DurableStore.settleCredits(job.workspaceId, job.id, job.requiredCredits, `stl_${job.id}`);
    if (!settled.success) return false;
  }
  await DurableStore.updateJobStatus(job.id, {
    status: 'COMPLETED',
    videoObjectKey: objectKey,
    ...videoDetails,
    videoUrl: objectKey ? `/api/videos/${job.id}/stream` : providerUrl,
    rawStatus,
  });
  await recordServerConversion({eventName:'first_video_completed',dedupeKey:`job:${job.id}`,workspaceId:job.workspaceId,metadata:{provider:job.provider,styleId:job.styleId,source:'video_persisted'}}).catch(()=>false);
  return true;
}

export async function persistCompletedVideo(job: VideoJobRecord, providerUrl: string, rawStatus: string): Promise<boolean> {
  return persistProviderVideo(job, providerUrl, rawStatus, true);
}

/** Recover a late MP4 without re-debiting credits already returned to the user. */
export async function persistLateCompletedVideo(job: VideoJobRecord, providerUrl: string, rawStatus: string): Promise<boolean> {
  if (job.status !== 'FAILED' || job.provider !== 'nexabot') return false;
  return persistProviderVideo(job, providerUrl, `LATE_PROVIDER_COMPLETION:${rawStatus}`, false);
}
