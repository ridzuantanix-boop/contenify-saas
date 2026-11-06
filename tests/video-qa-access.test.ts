import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createSessionToken } from '../src/lib/auth/session';
import { DurableStore } from '../src/lib/db/store';
import { GET as reviewList, POST as reviewDecision } from '../src/app/api/admin/video-qa/route';
import { GET as streamVideo } from '../src/app/api/videos/[id]/stream/route';
import { POST as submitJob } from '../src/app/api/jobs/route';

describe('manual video review access', () => {
  afterEach(() => vi.restoreAllMocks());

  async function memberCookie() {
    const token = await createSessionToken({ userId: 'b9999999-9999-4999-8999-999999999999', email: 'member@example.test', fullName: 'Member', workspaceId: 'a9999999-9999-4999-8999-999999999999', role: 'member', tier: 'free' });
    return `affimatik_session=${token}`;
  }

  it('rejects customer review actions before accessing the database', async () => {
    const cookie = await memberCookie();
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    try {
      const headers = { cookie, host: 'localhost', origin: 'http://localhost' };
      expect((await reviewList(new NextRequest('http://localhost/api/admin/video-qa', { headers }))).status).toBe(403);
      expect((await reviewDecision(new NextRequest('http://localhost/api/admin/video-qa', { method: 'POST', headers, body: JSON.stringify({ jobId: 'c9999999-9999-4999-8999-999999999999', decision: 'APPROVE' }) }))).status).toBe(403);
      expect(request).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it('keeps QA-pending MP4 private from its customer until approval', async () => {
    vi.spyOn(DurableStore, 'getJob').mockResolvedValue({
      id: 'c9999999-9999-4999-8999-999999999999', workspaceId: 'a9999999-9999-4999-8999-999999999999',
      status: 'QA_PENDING', videoObjectKey: 'workspaces/test/outputs/job.mp4',
    } as Awaited<ReturnType<typeof DurableStore.getJob>>);
    const response = await streamVideo(new NextRequest('http://localhost/api/videos/c9999999-9999-4999-8999-999999999999/stream', { headers: { cookie: await memberCookie() } }), { params: Promise.resolve({ id: 'c9999999-9999-4999-8999-999999999999' }) });
    expect(response.status).toBe(404);
  });

  it('rejects a provider override that would bypass the disabled Motion route', async () => {
    const admit = vi.spyOn(DurableStore, 'admitJobAtomic');
    const response = await submitJob(new NextRequest('http://localhost/api/jobs', {
      method: 'POST', headers: { cookie: await memberCookie(), host: 'localhost', origin: 'http://localhost', 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientRequestId: 'test-provider-override', styleId: 'NX01', provider: 'runninghub', imageKeys: ['data:image/png;base64,iVBORw0KGgo='] }),
    }));
    expect(response.status).toBe(400);
    expect(admit).not.toHaveBeenCalled();
  });
});
