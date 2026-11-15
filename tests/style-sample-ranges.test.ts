import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, HEAD } from '../src/app/api/style-samples/[id]/route';

const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe('iPhone-compatible public style samples', () => {
  it('redirects preview traffic to the CPU-free static asset pipeline', async () => {
    const response = await GET(new NextRequest('https://preview.example/api/style-samples/NX01', {
      headers: { Range: 'bytes=1-3' },
    }), context('NX01'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://preview.example/style-previews/NX01/sample-demo-v1.mp4?v=demo-replacement-v1-20261115');
    expect(response.headers.get('cache-control')).toContain('max-age=300');
  });

  it('serves RH identities through the matching replacement demo assets', async () => {
    const response = await GET(new NextRequest('https://preview.example/api/style-samples/RH01'), context('RH01'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://preview.example/style-previews/RH01/sample-demo-v1.mp4?v=demo-replacement-v1-20261115');
  });

  it('answers HEAD with the same static asset redirect and no body', async () => {
    const response = await HEAD(new NextRequest('https://preview.example/api/style-samples/NX03'), context('NX03'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://preview.example/style-previews/NX03/sample-demo-v1.mp4?v=demo-replacement-v1-20261115');
    expect(response.headers.get('content-length')).toBe('0');
    expect(response.body).toBeNull();
  });
});
