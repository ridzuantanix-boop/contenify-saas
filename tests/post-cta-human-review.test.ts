import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createSessionToken } from '../src/lib/auth/session';
import { GET, POST, PATCH } from '../src/app/api/admin/video-qa/flags/route';
import { DurableStore } from '../src/lib/db/store';
import { GET as streamVideo } from '../src/app/api/videos/[id]/stream/route';

const jobId = 'c9999999-9999-4999-8999-999999999999';
const flagId = 'd9999999-9999-4999-8999-999999999999';
const adminId = 'usr_admin_master';

async function cookie(role: 'superadmin' | 'member') {
  const token = await createSessionToken({ userId: role === 'superadmin' ? adminId : 'b9999999-9999-4999-8999-999999999999', email: 'qa@example.test', fullName: 'QA', workspaceId: 'a9999999-9999-4999-8999-999999999999', role, tier: 'free' });
  return `${role === 'superadmin' ? 'affimatik_admin_session' : 'affimatik_session'}=${token}`;
}

function request(method: 'GET' | 'POST' | 'PATCH', c: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/video-qa/flags', {
    method, headers: { cookie: c, host: 'localhost', origin: 'http://localhost', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('non-blocking human quality flags', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('blocks non-admin reads, writes and review-status changes before database access', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const c = await cookie('member');
    expect((await GET(request('GET', c))).status).toBe(403);
    expect((await POST(request('POST', c, { jobId, code: 'POST_CTA_SPEECH_REVIEW', issue: 'CTA repeated', transcriptEvidence: 'tekan butang di bawah' }))).status).toBe(403);
    expect((await PATCH(request('PATCH', c, { flagId }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records transcript evidence without changing job status or credits and keeps fact warnings separate', async () => {
    process.env.SUPABASE_URL = 'https://db.example.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, id: flagId, duplicate: false }) });
    vi.stubGlobal('fetch', fetchMock);
    const c = await cookie('superadmin');
    for (const evidence of [
      { issue: 'CTA repeated', transcriptEvidence: 'tekan butang di bawah, tekan butang di bawah', startSeconds: 10.68, endSeconds: 13.08 },
      { issue: 'Dialogue restarted after CTA', transcriptEvidence: 'tekan butang di bawah, ada yang tanya', startSeconds: 8.7, endSeconds: 12.98 },
      { issue: 'Garbled trailing speech', transcriptEvidence: '[unintelligible speech after CTA]', startSeconds: 12, endSeconds: 14 },
      { issue: 'Late speech needs listening', transcriptEvidence: 'tekan butang di bawah', startSeconds: 12.08, endSeconds: 13.32 },
    ]) {
      const response = await POST(request('POST', c, { jobId, code: 'POST_CTA_SPEECH_REVIEW', ...evidence }));
      expect(response.status).toBe(200);
    }
    const calls = fetchMock.mock.calls.map(call => JSON.parse(call[1].body as string));
    expect(calls.every(body => body.p_code === 'POST_CTA_SPEECH_REVIEW' && body.p_job_id === jobId && body.p_actor === adminId)).toBe(true);
    expect(calls.every(body => !('p_decision' in body) && !('p_credit' in body))).toBe(true);
    const fact = await POST(request('POST', c, { jobId, code: 'PRODUCT_FACT_REVIEW', issue: 'Unverified dosage', transcriptEvidence: 'ambil satu kapsul selepas makan' }));
    expect(fact.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.lastCall![1].body as string).p_code).toBe('PRODUCT_FACT_REVIEW');
  });

  it('accepts a naturally completed late CTA without creating a flag automatically', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    // A transcript alone never invokes the flag endpoint. Human review is required.
    const transcript = [{ start: 12.08, end: 13.32, text: 'tekan butang di bawah' }];
    expect(transcript[0].end).toBeLessThan(15);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves duplicate findings and marks review idempotently without erasing evidence', async () => {
    process.env.SUPABASE_URL = 'https://db.example.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, id: flagId, duplicate: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, id: flagId, idempotent: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, id: flagId, idempotent: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const c = await cookie('superadmin');
    const added = await POST(request('POST', c, { jobId, code: 'POST_CTA_SPEECH_REVIEW', issue: 'CTA repeated', transcriptEvidence: 'tekan butang di bawah' }));
    expect((await added.json()).duplicate).toBe(true);
    const reviewed = await PATCH(request('PATCH', c, { flagId }));
    expect((await reviewed.json()).idempotent).toBe(false);
    const again = await PATCH(request('PATCH', c, { flagId }));
    expect((await again.json()).idempotent).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toContain('review_video_quality_flag_atomic');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).not.toHaveProperty('p_transcript_evidence');
  });

  it('lets a signed superadmin preview a completed flagged video without cross-tenant customer access', async () => {
    vi.spyOn(DurableStore, 'getJob').mockResolvedValue({ id: jobId, workspaceId: 'd9999999-9999-4999-8999-999999999999', status: 'COMPLETED', videoObjectKey: 'workspaces/other/video.mp4' } as Awaited<ReturnType<typeof DurableStore.getJob>>);
    const memberResponse = await streamVideo(new NextRequest(`http://localhost/api/videos/${jobId}/stream`, { headers: { cookie: await cookie('member') } }), { params: Promise.resolve({ id: jobId }) });
    expect(memberResponse.status).toBe(404);
    // The admin reaches private storage; a missing storage fixture returns 503, not auth 401/404.
    const adminResponse = await streamVideo(new NextRequest(`http://localhost/api/videos/${jobId}/stream`, { headers: { cookie: await cookie('superadmin') } }), { params: Promise.resolve({ id: jobId }) });
    expect(adminResponse.status).toBe(503);
  });
});
