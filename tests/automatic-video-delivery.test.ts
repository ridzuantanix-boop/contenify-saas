import { afterEach, describe, expect, it, vi } from 'vitest';
import { DurableStore, type VideoJobRecord } from '../src/lib/db/store';
import { persistCompletedVideo } from '../src/lib/orchestration/persist-video';
import { ingestProviderMp4 } from '../src/lib/storage/supabase-assets';

vi.mock('../src/lib/storage/supabase-assets', () => ({ ingestProviderMp4: vi.fn() }));

const job = {
  id: 'job-1', workspaceId: 'workspace-1', provider: 'nexabot',
  durationSeconds: 15, requiredCredits: 10, status: 'PROCESSING',
} as VideoJobRecord;

describe('automatic delivery after private MP4 persistence', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('publishes only after private storage and its readback succeed, then settles credits', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VITEST', '');
    vi.mocked(ingestProviderMp4).mockResolvedValue({
      objectKey: 'workspaces/workspace-1/outputs/job-1.mp4', sizeBytes: 4000000,
      durationSeconds: 15.04, hasAudio: true,
    });
    const actions: string[] = [];
    vi.spyOn(DurableStore, 'updateJobStatus').mockImplementation(async (_id, patch) => {
      actions.push(`update:${patch.status || 'media'}`);
      return job;
    });
    vi.spyOn(DurableStore, 'settleCredits').mockImplementation(async () => {
      actions.push('settle');
      return { success: true } as Awaited<ReturnType<typeof DurableStore.settleCredits>>;
    });
    const release = vi.spyOn(DurableStore, 'releaseCredits');
    expect(await persistCompletedVideo(job, 'https://nexabot.id/video.mp4', 'done')).toBe(true);
    expect(actions).toEqual(['update:media', 'settle', 'update:COMPLETED']);
    expect(release).not.toHaveBeenCalled();
    expect(vi.mocked(DurableStore.updateJobStatus).mock.calls[1][1]).toMatchObject({
      videoUrl: '/api/videos/job-1/stream', videoObjectKey: 'workspaces/workspace-1/outputs/job-1.mp4',
    });
  });

  it('releases the reservation when the saved Voice MP4 lacks audio', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VITEST', '');
    vi.mocked(ingestProviderMp4).mockResolvedValue({
      objectKey: 'workspaces/workspace-1/outputs/job-1.mp4', sizeBytes: 4000000,
      durationSeconds: 15, hasAudio: false,
    });
    vi.spyOn(DurableStore, 'updateJobStatus').mockResolvedValue(job);
    const release = vi.spyOn(DurableStore, 'releaseCredits').mockResolvedValue({ success: true } as Awaited<ReturnType<typeof DurableStore.releaseCredits>>);
    const settle = vi.spyOn(DurableStore, 'settleCredits');
    expect(await persistCompletedVideo(job, 'https://nexabot.id/video.mp4', 'done')).toBe(false);
    expect(release).toHaveBeenCalledOnce();
    expect(settle).not.toHaveBeenCalled();
    expect(vi.mocked(DurableStore.updateJobStatus).mock.lastCall?.[1]).toMatchObject({ status: 'FAILED' });
  });
});
