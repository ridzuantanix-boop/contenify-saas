import { DurableStore, VideoJobRecord } from '@/lib/db/store';
import { ingestProviderMp4 } from '@/lib/storage/supabase-assets';

export async function persistCompletedVideo(job: VideoJobRecord, providerUrl: string, rawStatus: string): Promise<boolean> {
  if (job.status === 'QA_PENDING') return true;
  let objectKey = job.videoObjectKey;
  let videoDetails: { actualDurationSeconds?: number; outputHasAudio?: boolean; outputSizeBytes?: number } = {};
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST && job.provider !== 'mock' && !objectKey) {
    const stored = await ingestProviderMp4(job.provider, providerUrl, job.workspaceId, job.id);
    objectKey = stored.objectKey;
    videoDetails = { actualDurationSeconds: stored.durationSeconds, outputHasAudio: stored.hasAudio, outputSizeBytes: stored.sizeBytes };
    await DurableStore.updateJobStatus(job.id, { videoObjectKey: objectKey, ...videoDetails });
  }
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST && job.provider !== 'mock') {
    if (!objectKey) throw new Error('Video belum disimpan untuk semakan kualiti.');
    await DurableStore.updateJobStatus(job.id, { status: 'QA_PENDING', rawStatus, videoObjectKey: objectKey, ...videoDetails });
    return true;
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
