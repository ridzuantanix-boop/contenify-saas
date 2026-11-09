import { describe, expect, it, vi } from 'vitest';
import { createCanonicalProductionWorker } from '../scripts/release/production-origin.mjs';

describe('production canonical origin wrapper', () => {
  it('redirects www traffic to HTTPS apex while preserving path and query', async () => {
    const app = { fetch: vi.fn() };
    const worker = createCanonicalProductionWorker(app);
    const response = await worker.fetch(new Request('https://www.affimatik.online/auth/callback?type=signup'), {}, {});
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://affimatik.online/auth/callback?type=signup');
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it('passes apex and staging requests to OpenNext unchanged', async () => {
    const app = { fetch: vi.fn().mockResolvedValue(new Response('ok')) };
    const worker = createCanonicalProductionWorker(app);
    expect((await worker.fetch(new Request('https://affimatik.online/login'), {}, {})).status).toBe(200);
    expect((await worker.fetch(new Request('https://staging.example/login'), {}, {})).status).toBe(200);
    expect(app.fetch).toHaveBeenCalledTimes(2);
  });

  it('serves casual no-store maintenance responses and keeps reconciliation alive', async () => {
    const app = { fetch: vi.fn().mockResolvedValue(new Response('app')) };
    const worker = createCanonicalProductionWorker(app);
    const env = { MAINTENANCE_MODE: 'true' };
    const page = await worker.fetch(new Request('https://affimatik.online/factory'), env, {});
    expect(page.status).toBe(503);
    expect(page.headers.get('cache-control')).toContain('no-store');
    expect(await page.text()).toContain('Akaun, baki kredit, job dan video korang semuanya selamat.');
    const api = await worker.fetch(new Request('https://affimatik.online/api/styles'), env, {});
    expect(api.status).toBe(503);
    expect(await api.json()).toMatchObject({ maintenance: true });
    const cron = await worker.fetch(new Request('https://affimatik.online/api/jobs/reconcile'), env, {});
    expect(await cron.text()).toBe('app');
    expect(app.fetch).toHaveBeenCalledTimes(1);
  });
});
