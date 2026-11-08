import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ingestProviderMp4, inspectMp4, privateImageDataUri, signPrivateAsset } from '../src/lib/storage/supabase-assets';

function mp4Fixture(): Uint8Array {
  const box = (type: string, payload: Uint8Array) => {
    const bytes = new Uint8Array(payload.length + 8);
    new DataView(bytes.buffer).setUint32(0, bytes.length);
    bytes.set(new TextEncoder().encode(type), 4);
    bytes.set(payload, 8);
    return bytes;
  };
  const concat = (...parts: Uint8Array[]) => {
    const result = new Uint8Array(parts.reduce((sum, item) => sum + item.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  };
  const mvhd = new Uint8Array(24);
  new DataView(mvhd.buffer).setUint32(12, 1000);
  new DataView(mvhd.buffer).setUint32(16, 10000);
  const hdlr = new Uint8Array(12);
  hdlr.set(new TextEncoder().encode('vide'), 8);
  return concat(box('ftyp', new Uint8Array(8)), box('moov', concat(box('mvhd', mvhd), box('trak', box('mdia', box('hdlr', hdlr))))));
}

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

  it('blocks a provider redirect to an untrusted host', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/video.mp4' } }));
    vi.stubGlobal('fetch', request);
    await expect(ingestProviderMp4('runninghub', 'https://www.runninghub.cn/view?video.mp4', 'ws-1', 'job-1')).rejects.toThrow(/tidak dibenarkan/);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('accepts the exact RunningHub output host observed in live generation', async () => {
    process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    const request = vi.fn().mockResolvedValueOnce(new Response(mp4Fixture().buffer as ArrayBuffer, { status: 200 })).mockResolvedValueOnce(new Response('{}', { status: 200 })).mockResolvedValueOnce(new Response(mp4Fixture().buffer as ArrayBuffer, { status: 200 }));
    vi.stubGlobal('fetch', request);
    const result = await ingestProviderMp4('runninghub', 'https://rh-hk-images-1252422369.cos.ap-hongkong.myqcloud.com/job/video.mp4', 'ws-1', 'job-1');
    expect(result.durationSeconds).toBe(10);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('rejects a lookalike RunningHub output host', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(ingestProviderMp4('runninghub', 'https://rh-hk-images-1252422369.cos.ap-hongkong.myqcloud.com.attacker.test/video.mp4', 'ws-1', 'job-1')).rejects.toThrow(/tidak dibenarkan/);
    expect(request).not.toHaveBeenCalled();
  });

  it('accepts the exact Nexabot storage host and media path observed in staging', async () => {
    process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    const mp4 = mp4Fixture();
    const request = vi.fn().mockResolvedValueOnce(new Response(mp4.buffer as ArrayBuffer, { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(mp4.buffer as ArrayBuffer, { status: 200 }));
    vi.stubGlobal('fetch', request);
    const result = await ingestProviderMp4('nexabot', 'https://iosrygyeustxztewibzq.supabase.co/storage/v1/object/public/storage/media/2026/11/output.mp4', 'ws-1', 'job-1');
    expect(result.sizeBytes).toBe(mp4.length);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('rejects other paths on the Nexabot storage host and lookalike hosts', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    for (const url of [
      'https://iosrygyeustxztewibzq.supabase.co/storage/v1/object/public/other/file.mp4',
      'https://sub.iosrygyeustxztewibzq.supabase.co/storage/v1/object/public/storage/media/a.mp4',
      'https://iosrygyeustxztewibzq.supabase.co.attacker.test/storage/v1/object/public/storage/media/a.mp4',
    ]) {
      await expect(ingestProviderMp4('nexabot', url, 'ws-1', 'job-1')).rejects.toThrow(/tidak dibenarkan/);
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('uploads a valid MP4 into a workspace-scoped private path', async () => {
    process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    const mp4 = mp4Fixture();
    const request = vi.fn().mockResolvedValueOnce(new Response(mp4.buffer as ArrayBuffer, { status: 200 })).mockResolvedValueOnce(new Response('{}', { status: 200 })).mockResolvedValueOnce(new Response(mp4.buffer as ArrayBuffer, { status: 200 }));
    vi.stubGlobal('fetch', request);
    const result = await ingestProviderMp4('nexabot', 'https://nexabot.id/video.mp4', 'ws-1', 'job-1');
    expect(result.objectKey).toBe('workspaces/ws-1/outputs/job-1.mp4');
    expect(result.sizeBytes).toBe(mp4.length);
    expect(result.durationSeconds).toBe(10);
    expect(result.hasAudio).toBe(false);
    expect(String(request.mock.calls[1][0])).toContain('/storage/v1/object/affimatik-assets/workspaces/ws-1/outputs/job-1.mp4');
    expect(String(request.mock.calls[2][0])).toContain('/storage/v1/object/authenticated/affimatik-assets/workspaces/ws-1/outputs/job-1.mp4');
  });

  it('does not accept an upload whose private readback differs', async () => {
    process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    const mp4 = mp4Fixture();
    const altered = mp4.slice();
    altered[altered.length - 1] ^= 1;
    const request = vi.fn().mockResolvedValueOnce(new Response(mp4.buffer as ArrayBuffer, { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(altered.buffer as ArrayBuffer, { status: 200 }));
    vi.stubGlobal('fetch', request);
    await expect(ingestProviderMp4('nexabot', 'https://nexabot.id/video.mp4', 'ws-1', 'job-1')).rejects.toThrow(/tidak sepadan/);
  });

  it('rejects an MP4 with a valid signature but no playable video track', () => {
    const fake = new Uint8Array(64);
    fake.set(new TextEncoder().encode('ftyp'), 4);
    expect(() => inspectMp4(fake.buffer)).toThrow(/trek video/);
  });

  it('reads real bundled style preview MP4 durations and video tracks', () => {
    for (const style of ['NX01','NX02','NX03','NX05','NX07','NX09','NX10','RH01','RH02','RH03','RH04','RH17','RH19']) {
      const file = readFileSync(resolve(process.cwd(), 'public', 'style-previews', style, 'sample-v1.mp4'));
      const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
      const result = inspectMp4(bytes);
      expect(result.hasVideo).toBe(true);
      expect(result.durationSeconds).toBeGreaterThan(style.startsWith('NX') ? 9 : 14);
      expect(result.durationSeconds).toBeLessThan(style.startsWith('NX') ? 11 : 16);
      if (style.startsWith('NX')) expect(result.hasAudio).toBe(true);
    }
  });

  it('serves genuine 15-second Voice samples for all active styles', () => {
    for (const style of ['NX01','NX02','NX03','NX05','NX07','NX09','NX10']) {
      const file = readFileSync(resolve(process.cwd(), 'public', 'style-previews', style, 'sample-v2.mp4'));
      const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
      const result = inspectMp4(bytes);
      expect(result.hasVideo).toBe(true);
      expect(result.hasAudio).toBe(true);
      expect(result.durationSeconds).toBeGreaterThan(14.5);
      expect(result.durationSeconds).toBeLessThan(15.5);
    }
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
