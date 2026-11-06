import { afterEach, describe, expect, it, vi } from 'vitest';
import { ingestProviderMp4, privateImageDataUri, signPrivateAsset } from '../src/lib/storage/supabase-assets';

describe('Private provider media ingestion', () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousUrl) process.env.SUPABASE_URL = previousUrl; else delete process.env.SUPABASE_URL;
    if (previousKey) process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey; else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('rejects an unexpected media host before fetching it', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(ingestProviderMp4('nexabot', 'https://127.0.0.1/private.mp4', 'ws-1', 'job-1')).rejects.toThrow(/tidak dibenarkan/);
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects a non-MP4 provider response and does not upload it', async () => {
    process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    const request = vi.fn().mockResolvedValue(new Response(new Uint8Array(64), { status: 200 }));
    vi.stubGlobal('fetch', request);
    await expect(ingestProviderMp4('nexabot', 'https://nexabot.id/video.mp4', 'ws-1', 'job-1')).rejects.toThrow(/bukan MP4/);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('uploads a valid MP4 into a workspace-scoped private path', async () => {
    process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    const mp4 = new Uint8Array(64);
    mp4.set([0, 0, 0, 64, 102, 116, 121, 112], 0);
    const request = vi.fn().mockResolvedValueOnce(new Response(mp4, { status: 200 })).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', request);
    const result = await ingestProviderMp4('nexabot', 'https://nexabot.id/video.mp4', 'ws-1', 'job-1');
    expect(result.objectKey).toBe('workspaces/ws-1/outputs/job-1.mp4');
    expect(result.sizeBytes).toBe(64);
    expect(String(request.mock.calls[1][0])).toContain('/storage/v1/object/affimatik-assets/workspaces/ws-1/outputs/job-1.mp4');
  });

  it('normalizes the private signed URL returned by Supabase Storage', async () => {
    process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ signedURL: '/object/sign/affimatik-assets/workspaces/ws-1/inputs/a.png?token=abc' }), { status: 200 })));
    expect(await signPrivateAsset('workspaces/ws-1/inputs/a.png')).toBe('https://unit-test.supabase.co/storage/v1/object/sign/affimatik-assets/workspaces/ws-1/inputs/a.png?token=abc');
  });

  it('sends Nexabot an actual stored image as a data URI', async () => {
    process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    const png = new Uint8Array([137,80,78,71,13,10,26,10]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(png, { status: 200 })));
    const image = await privateImageDataUri('workspaces/ws-1/inputs/a.png', 'image/png');
    expect(image).toBe(`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
  });
});
