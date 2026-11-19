import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/analytics/conversion/route';

describe('AffiMatik creative attribution', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; });

  it('carries campaign and creative labels from landing to registration without a client-supplied attribution field', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    const writes: Record<string, any>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'POST') writes.push(JSON.parse(String(init.body)));
      return new Response('', { status: 201 });
    });
    const landing = await POST(new NextRequest('https://affimatik.online/api/analytics/conversion', {
      method: 'POST',
      headers: { referer: 'https://affimatik.online/?utm_campaign=affimatik_copy_review&utm_content=proof_video_01' },
      body: JSON.stringify({ eventName: 'landing_view', dedupeKey: 'home' }),
    }));
    expect(landing.cookies.get('affimatik_content')?.value).toBe('proof_video_01');
    expect(writes[0].metadata).toMatchObject({ utmCampaign: 'affimatik_copy_review', utmContent: 'proof_video_01' });
    await POST(new NextRequest('https://affimatik.online/api/analytics/conversion', {
      method: 'POST',
      headers: { cookie: 'affimatik_campaign=affimatik_copy_review; affimatik_content=proof_video_01', referer: 'https://affimatik.online/register' },
      body: JSON.stringify({ eventName: 'registration_completed', dedupeKey: 'register-session-ready' }),
    }));
    expect(writes[1].metadata).toMatchObject({ utmCampaign: 'affimatik_copy_review', utmContent: 'proof_video_01' });
  });
});
