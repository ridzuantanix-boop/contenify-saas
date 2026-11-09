import { DurableStore, VideoJobRecord } from '@/lib/db/store';
import { ingestProviderMp4 } from '@/lib/storage/supabase-assets';
import { customerFailureMessage } from '@/lib/jobs/customer-failure';

export async function persistCompletedVideo(job: VideoJobRecord, providerUrl: string, rawStatus: string): Promise<boolean> {
  let objectKey = job.videoObjectKey;
  let videoDetails: { actualDurationSeconds?: number; outputHasAudio?: boolean; outputSizeBytes?: number } = {};
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST && job.provider !== 'mock' && !objectKey) {
    let stored;
    try {
      stored = await ingestProviderMp4(job.provider, providerUrl, job.workspaceId, job.id);
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
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST && job.provider === 'nexabot' &&
      (actualDuration === undefined || Math.abs(actualDuration - job.durationSeconds) > 0.5 || hasAudio !== true)) {
    await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_media_${job.id}`);
    await DurableStore.updateJobStatus(job.id, { status: 'FAILED', errorMessage: customerFailureMessage('Video pembekal tidak menepati tempoh atau audio gaya Voice.') });
    return false;
  }
  const settled = await DurableStore.settleCredits(job.workspaceId, job.id, job.requiredCredits, `stl_${job.id}`);
  if (!settled.success) return false;
  await DurableStore.updateJobStatus(job.id, {
    status: 'COMPLETED',
    videoObjectKey: objectKey,
    ...videoDetails,
    videoUrl: objectKey ? `/api/videos/${job.id}/stream` : providerUrl,
    rawStatus,
  });
  return true;
}
