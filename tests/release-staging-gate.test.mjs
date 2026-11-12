import { describe, expect, it } from 'vitest';
import { createStagingWorker } from '../scripts/release/staging-gate.mjs';

const secret = 'stage-only-key-with-at-least-thirty-two-characters';
const worker = createStagingWorker({ fetch: async request => new Response(`app:${new URL(request.url).pathname}`) });
const env = { STAGING_GATE_SECRET: secret };
const request = (path, init) => new Request(`https://stage.example${path}`, init);

describe('staging Worker access gate', () => {
  it('fails closed when the gate secret is absent', async () => {
    expect((await worker.fetch(request('/'), {}, {})).status).toBe(503);
  });

  it('rejects anonymous pages, static assets and API routes', async () => {
    for (const path of ['/', '/_next/static/app.js', '/api/auth/session']) {
      expect((await worker.fetch(request(path), env, {})).status).toBe(404);
    }
  });

  it('allows the exact header key and marks responses private', async () => {
    const response = await worker.fetch(request('/_next/static/app.js', { headers: { 'x-affimatik-staging-key': secret } }), env, {});
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('app:/_next/static/app.js');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('serves a gated static asset before OpenNext', async () => {
    const assetEnv = { ...env, ASSETS: { fetch: async () => new Response('asset:ok', { headers: { 'Content-Type': 'application/javascript' } }) } };
    const response = await worker.fetch(request('/_next/static/app.js', { headers: { 'x-affimatik-staging-key': secret } }), assetEnv, {});
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('asset:ok');
    expect(response.headers.get('content-type')).toBe('application/javascript');
  });

  it('issues an HttpOnly cookie only for the correct form key', async () => {
    const form = await worker.fetch(request('/__stage_access'), env, {});
    expect(form.status).toBe(200);
    const wrong = await worker.fetch(request('/__stage_access', { method: 'POST', body: new URLSearchParams({ key: 'wrong' }) }), env, {});
    expect(wrong.status).toBe(403);
    const login = await worker.fetch(request('/__stage_access', { method: 'POST', body: new URLSearchParams({ key: secret }) }), env, {});
    expect(login.status).toBe(303);
    const cookie = login.headers.get('set-cookie');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect((await worker.fetch(request('/api/auth/session', { headers: { Cookie: cookie.split(';')[0] } }), env, {})).status).toBe(200);
    expect((await worker.fetch(request('/', { headers: { Cookie: `${cookie.split(';')[0]}tampered` } }), env, {})).status).toBe(404);
  });

  it('accepts a short-lived signed owner test link without exposing the gate key', async () => {
    const login = await worker.fetch(request('/__stage_access', { method: 'POST', body: new URLSearchParams({ key: secret }) }), env, {});
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const token = cookie.split('=')[1];
    const linked = await worker.fetch(request(`/__stage_access?token=${encodeURIComponent(token)}`), env, {});
    expect(linked.status).toBe(303);
    expect(linked.headers.get('location')).toBe('/login');
    expect(linked.headers.get('set-cookie')).toContain('HttpOnly');
    expect(linked.headers.get('set-cookie')).not.toContain(secret);
  });
});
