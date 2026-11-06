import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({ env: { ASSETS: { fetch: mocks.fetch } } }),
}));
import { GET, HEAD } from '../src/app/api/style-samples/[id]/route';

const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe('iPhone-compatible public style samples', () => {
  it('serves a precise byte range from the corresponding versioned MP4', async () => {
    mocks.fetch.mockResolvedValue(new Response(new Uint8Array([0, 1, 2, 3, 4]), { status: 200 }));
    const response = await GET(new NextRequest('https://preview.example/api/style-samples/NX01', {
      headers: { Range: 'bytes=1-3' },
    }), context('NX01'));
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 1-3/5');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(mocks.fetch).toHaveBeenCalledWith('https://preview.example/style-previews/NX01/sample-v2.mp4');
  });

  it('rejects invalid ranges and unavailable Motion styles', async () => {
    mocks.fetch.mockResolvedValue(new Response(new Uint8Array([0, 1, 2]), { status: 200 }));
    const badRange = await GET(new NextRequest('https://preview.example/api/style-samples/NX02', {
      headers: { Range: 'bytes=10-20' },
    }), context('NX02'));
    expect(badRange.status).toBe(416);
    expect(badRange.headers.get('content-range')).toBe('bytes */3');
    const unavailable = await GET(new NextRequest('https://preview.example/api/style-samples/RH01'), context('RH01'));
    expect(unavailable.status).toBe(404);
  });

  it('answers HEAD with a playable MP4 length without a body', async () => {
    mocks.fetch.mockResolvedValue(new Response(new Uint8Array([0, 1, 2]), { status: 200 }));
    const response = await HEAD(new NextRequest('https://preview.example/api/style-samples/NX03'), context('NX03'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('3');
    expect(response.body).toBeNull();
  });
});
