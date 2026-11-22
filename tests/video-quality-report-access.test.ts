import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createSessionToken } from '../src/lib/auth/session';
import { POST } from '../src/app/api/videos/report/route';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const jobId = '33333333-3333-4333-8333-333333333333';

async function request() {
  const token = await createSessionToken({ userId:'11111111-1111-4111-8111-111111111111', email:'qa@example.com', fullName:'QA', workspaceId, role:'owner', tier:'starter' });
  return new NextRequest('https://affimatik.online/api/videos/report', { method:'POST', headers:{ cookie:`affimatik_session=${token}`, host:'affimatik.online', origin:'https://affimatik.online' }, body:JSON.stringify({jobId,category:'cta_cutoff',description:'CTA ends mid-word.'}) });
}

describe('customer video report ownership', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it('rejects reports when no completed video belongs to the workspace', async () => {
    vi.stubEnv('SESSION_SECRET','report-test-secret');
    vi.stubEnv('SUPABASE_URL','https://unit-test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only');
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]',{status:200}));
    vi.stubGlobal('fetch',fetchMock);
    const response = await POST(await request());
    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`workspace_id=eq.${workspaceId}`);
  });
  it('records only metadata from the server-owned completed job', async () => {
    vi.stubEnv('SESSION_SECRET','report-test-secret');
    vi.stubEnv('SUPABASE_URL','https://unit-test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id:jobId, preset_id:'NX01', provider:'nexabot', created_at:'2026-11-22T00:00:00Z', result_video_r2_key:'private/output.mp4' }]),{status:200}))
      .mockResolvedValueOnce(new Response('[]',{status:201}));
    vi.stubGlobal('fetch',fetchMock);
    const response = await POST(await request());
    expect(response.status).toBe(200);
    const written = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(written).toMatchObject({ job_id:jobId, workspace_id:workspaceId, style_id:'NX01', video_object_key:'private/output.mp4' });
    expect(fetchMock.mock.calls[1][1].headers.Prefer).toContain('ignore-duplicates');
  });
});
