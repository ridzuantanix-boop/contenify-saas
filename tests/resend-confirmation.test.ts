import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/auth/resend-confirmation/route';

describe('confirmation-email resend', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('does not falsely claim success when the provider quota is exhausted', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 429, headers: { 'Retry-After': '1200' },
    })));
    const request = new NextRequest('https://affimatik.online/api/auth/resend-confirmation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@example.com' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('1200');
    expect(body).toMatchObject({ code: 'AUTH_EMAIL_RATE_LIMIT', retryAfterSeconds: 1200 });
    expect(body.error).toContain('Tiada emel baharu dihantar');
  });
});
