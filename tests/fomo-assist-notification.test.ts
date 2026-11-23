import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ reserved: false, sends: 0, admin: false, responseStatus: 200 }));
vi.mock('@/lib/auth/session', () => ({ getSessionFromRequest: vi.fn(async () => null) }));
vi.mock('@/lib/auth/admin-guard', () => ({ verifyAdminAccess: vi.fn(async () => ({ isAuthorized: state.admin, role: state.admin ? 'superadmin' : undefined })) }));
vi.mock('@/lib/billing/fomo-bonus', () => ({
  fomoFeatureEnabled: () => true,
  visitorIdFromRequest: () => 'a30e926f-1ad5-490c-b786-76c51bd6dc5a',
  initializeFomoOffer: vi.fn(async () => ({ enabled: true, campaign_id: 'campaign-test' })),
  reserveFomoAssistance: vi.fn(async () => { if (state.reserved) return false; state.reserved = true; return true; }),
  updateFomoAssistanceEmailStatus: vi.fn(async () => undefined),
}));

import { POST } from '@/app/api/fomo-offer/assist/route';

function request(auditTest = false) {
  return new NextRequest('https://affimatik.online/api/fomo-offer/assist', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ whatsapp: '0195216867', privacyAccepted: true, auditTest }),
  });
}

describe('FOMO assistance notification', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    state.reserved = false; state.sends = 0; state.admin = false; state.responseStatus = 200;
    process.env.RESEND_API_KEY = 'test-key';
    process.env.FOMO_OWNER_NOTIFICATION_EMAIL = 'owner@example.com';
    globalThis.fetch = vi.fn(async (_url, options) => {
      state.sends++;
      const payload = JSON.parse(String(options?.body));
      expect(payload.to).toEqual(['owner@example.com']);
      expect(payload.text).toContain('WhatsApp: +60195216867');
      return new Response('{}', { status: state.responseStatus });
    }) as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = originalFetch; delete process.env.RESEND_API_KEY; delete process.env.FOMO_OWNER_NOTIFICATION_EMAIL; });

  it('sends once across a repeated request', async () => {
    expect((await (await POST(request())).json()).emailStatus).toBe('SENT');
    expect((await (await POST(request())).json()).emailStatus).toBe('ALREADY_REQUESTED');
    expect(state.sends).toBe(1);
  });

  it('requires superadmin access and marks an authorized test unmistakably', async () => {
    expect((await POST(request(true))).status).toBe(403);
    state.admin = true;
    await POST(request(true));
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const payload = JSON.parse(String(call[1]?.body));
    expect(payload.subject).toContain('[UJIAN PRODUKSI]');
    expect(payload.text).toContain('BUKAN LEAD ATAU JUALAN PELANGGAN');
    expect(state.sends).toBe(1);
  });

  it('keeps assistance and checkout reachable if email provider rejects', async () => {
    state.responseStatus = 503;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).emailStatus).toBe('FAILED_503');
  });
});
