import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/auth/register/route';

const request = () => new NextRequest('https://affimatik.online/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'new-test@example.invalid', password: 'strong-test-password', whatsapp: '01123456789', fullName: 'Test User' }),
});

describe('Supabase signup response contract', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  function configure() {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('SESSION_SECRET', 'test-session-secret');
  }

  it('accepts the flat user returned by the raw GoTrue signup endpoint without granting credits', async () => {
    configure();
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'user-1', identities: [{ id: 'identity-1' }], confirmation_sent_at: '2026-11-08T00:00:00Z' }), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, requiresEmailConfirmation: true });
    expect(body.user).toBeUndefined();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('accepts a wrapped obfuscated existing-user response without exposing account existence', async () => {
    configure();
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: 'fake-user', identities: [] }, session: null }), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.requiresEmailConfirmation).toBe(true);
    expect(body.message).toContain('Jika pernah mendaftar');
    expect(body.message).not.toContain('fake-user');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
