import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mocks = vi.hoisted(() => ({
  updateJobStatus: vi.fn(),
  recordAuditLog: vi.fn(),
}));
vi.mock('@/lib/auth/admin-guard', () => ({
  verifyAdminAccess: vi.fn().mockResolvedValue({ role: 'superadmin', isAuthorized: true, userId: 'isolated-admin' }),
}));
vi.mock('@/lib/db/store', () => ({ DurableStore: mocks }));

import { POST } from '../src/app/api/admin/recover-videos/route';

describe('isolated historical MP4 recovery', () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    if (oldUrl) process.env.SUPABASE_URL = oldUrl; else delete process.env.SUPABASE_URL;
    if (oldKey) process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey; else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('recovers one playable historical file and does not touch a wallet, including on repeat', async () => {
    process.env.SUPABASE_URL = 'https://isolated.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-test-key';
    const mp4 = readFileSync(resolve(process.cwd(), 'public/style-previews/NX01/sample-v1.mp4'));
    const candidate = {
      id: 'historical-job-1', workspace_id: 'historical-workspace-1', provider: 'nexabot',
      result_video_url: 'https://hrekuraxzpiqymgcrjyb.supabase.co/storage/v1/object/public/storage/media/old.mp4',
    };
    let candidateReads = 0;
    const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/video_jobs?')) {
        candidateReads++;
        return new Response(JSON.stringify(candidateReads === 1 ? [candidate] : []), { status: 200 });
      }
      if (url === candidate.result_video_url) return new Response(mp4, { status: 200, headers: { 'content-type': 'video/mp4' } });
      if (url.includes('/storage/v1/object/affimatik-assets/workspaces/historical-workspace-1/outputs/historical-job-1.mp4')) {
        expect(init?.method).toBe('POST');
        return new Response('{}', { status: 200 });
      }
      throw new Error(`Unexpected recovery request: ${url}`);
    });
    vi.stubGlobal('fetch', request);
    const routeRequest = () => new NextRequest('http://localhost/api/admin/recover-videos?limit=1', { method: 'POST' });
    const first = await POST(routeRequest());
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ results: [{ id: candidate.id, recovered: true }] });
    expect(mocks.updateJobStatus).toHaveBeenCalledWith(candidate.id, expect.objectContaining({
      videoObjectKey: 'workspaces/historical-workspace-1/outputs/historical-job-1.mp4',
      videoUrl: '/api/videos/historical-job-1/stream', outputHasAudio: true,
    }));
    const second = await POST(routeRequest());
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ results: [] });
    expect(mocks.updateJobStatus).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(4); // two candidate reads, one media download, one private upload
    expect(mocks.recordAuditLog).toHaveBeenCalledTimes(2);
  });
});
