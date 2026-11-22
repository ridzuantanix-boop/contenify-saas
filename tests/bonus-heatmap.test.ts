import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/analytics/heatmap/route';

const sessionId = '00000000-0000-4000-8000-000000000001';
const headers = { origin: 'http://localhost:3000', referer: 'http://localhost:3000/?utm_campaign=bonus_test', 'content-type': 'application/json' };

function request(event: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/analytics/heatmap', {
    method: 'POST', headers,
    body: JSON.stringify({ anonymous: true, sessionId, seq: 1, device: 'mobile', pageVariant: 'bonus_v1', ...event }),
  });
}

describe('100-credit bonus heatmap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('records the named bonus action without customer input', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request({ kind: 'click', x: .5, y: .4, targetType: 'button', regionKey: 'bonus', targetKey: 'bonus_claim' }));
    expect(response.status).toBe(201);
    const stored = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(stored).toMatchObject({ page_variant: 'bonus_v1', region_key: 'bonus', target_key: 'bonus_claim', campaign_key: 'bonus_test' });
    expect(stored).not.toHaveProperty('phone');
  });

  it('records section visibility separately from clicks', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    expect((await POST(request({ kind: 'section_view', regionKey: 'bonus' }))).status).toBe(201);
    const stored = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(stored.kind).toBe('section_view');
    expect(stored).not.toHaveProperty('x_pct');
  });

  it('rejects arbitrary action labels and actions outside the bonus layout', async () => {
    const event = { kind: 'click', x: .5, y: .4, targetType: 'button', regionKey: 'bonus', targetKey: 'customer_phone' };
    expect((await POST(request(event))).status).toBe(400);
    expect((await POST(request({ ...event, targetKey: 'bonus_claim', pageVariant: 'base_v1' }))).status).toBe(400);
  });
});
