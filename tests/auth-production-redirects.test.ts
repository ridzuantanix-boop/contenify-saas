import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as register } from '../src/app/api/auth/register/route';
import { POST as resend } from '../src/app/api/auth/resend-confirmation/route';
import { POST as recover } from '../src/app/api/auth/password-reset/route';
import { POST as updatePassword } from '../src/app/api/auth/update-password/route';
import { POST as createSession } from '../src/app/api/auth/session/route';
import { publicAppOrigin } from '../src/lib/auth/public-origin';

const jsonRequest = (url: string, body: Record<string, unknown>) => new NextRequest(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

function configureProduction() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DEPLOYMENT_ENV', 'production');
  vi.stubEnv('APP_BASE_URL', 'https://affimatik.online');
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
  vi.stubEnv('SESSION_SECRET', 'session');
}

describe('production authentication redirects', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('never trusts a production request host or an unsafe configured origin', () => {
    configureProduction();
    expect(publicAppOrigin(new NextRequest('https://attacker.example/register'))).toBe('https://affimatik.online');
    vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
    expect(() => publicAppOrigin(new NextRequest('https://affimatik.online/register'))).toThrow(/kanonik/);
  });

  it('sends signup, resend and recovery emails to the canonical callback', async () => {
    configureProduction();
    const seen: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      seen.push(String(input));
      if (String(input).includes('/signup')) return new Response(JSON.stringify({ id: 'user-1', identities: [{}] }), { status: 200 });
      return new Response('{}', { status: 200 });
    }));
    expect((await register(jsonRequest('https://evil.example/api/auth/register', { email: 'new@example.com', password: 'password123', whatsapp: '01123456789', acceptedTerms: true }))).status).toBe(200);
    expect((await resend(jsonRequest('https://evil.example/api/auth/resend-confirmation', { email: 'new@example.com' }))).status).toBe(200);
    expect((await recover(jsonRequest('https://evil.example/api/auth/password-reset', { email: 'new@example.com' }))).status).toBe(200);
    expect(seen).toHaveLength(3);
    for (const url of seen) expect(decodeURIComponent(url)).toContain('redirect_to=https://affimatik.online/auth/callback');
    for (const url of seen) expect(url).not.toContain('localhost');
  });

  it('verifies a recovery token before changing the password', async () => {
    configureProduction();
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1', email: 'new@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1' }), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const response = await updatePassword(jsonRequest('https://affimatik.online/api/auth/update-password', { accessToken: 'verified-token', password: 'new-password-123' }));
    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls[1][1]).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(upstream.mock.calls[1][1]?.body))).toEqual({ password: 'new-password-123' });
  });

  it('does not submit a new password when the recovery token is invalid', async () => {
    configureProduction();
    const upstream = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', upstream);
    const response = await updatePassword(jsonRequest('https://affimatik.online/api/auth/update-password', { accessToken: 'expired-token', password: 'new-password-123' }));
    expect(response.status).toBe(401);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('distinguishes an unconfirmed mailbox from invalid credentials', async () => {
    configureProduction();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error_code: 'email_not_confirmed', msg: 'Email not confirmed' }), { status: 400 })));
    const response = await createSession(jsonRequest('https://affimatik.online/api/auth/session', { email: 'new@example.com', password: 'password123' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'AUTH_EMAIL_NOT_CONFIRMED' });
  });
});
