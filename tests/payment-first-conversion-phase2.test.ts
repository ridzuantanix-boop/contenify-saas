import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { createSessionToken } from '../src/lib/auth/session';
import { POST as createJob } from '../src/app/api/jobs/route';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Payment-first conversion Phase 2', () => {
  it('provisions only a zero-credit checkout workspace before email verification', () => {
    const migration = read('supabase/migrations/00030_payment_first_checkout.sql');
    expect(migration).toContain('provision_pending_checkout_account_atomic');
    expect(migration).toContain('VALUES (v_workspace, 0, 0, 0, 0');
    expect(migration).not.toContain('provision_wallet_atomic');
    expect(migration).toContain('REVOKE ALL');
    expect(migration).toContain('TO service_role');
  });

  it('blocks video generation for the checkout-only session', async () => {
    vi.stubEnv('SESSION_SECRET', 'phase-2-session-secret');
    const token = await createSessionToken({
      userId: '11111111-1111-4111-8111-111111111111', email: 'pending@example.com', fullName: 'Pending',
      workspaceId: '22222222-2222-4222-8222-222222222222', role: 'owner', tier: 'free', emailVerified: false,
    });
    const response = await createJob(new NextRequest('https://affimatik.online/api/jobs', {
      method: 'POST', headers: { cookie: `affimatik_session=${token}`, origin: 'https://affimatik.online', host: 'affimatik.online' },
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' });
    vi.unstubAllEnvs();
  });

  it('ships the revised conversion copy, style tags, clean MP4 and QR-only WhatsApp help', () => {
    const page = read('src/app/page.tsx');
    const billing = read('src/app/(dashboard)/billing/page.tsx');
    const register = read('src/app/register/page.tsx');
    for (const copy of [
      'Daftar akaun dan terus bayar melalui QR', '+ 12 gaya lain di dalam studio', 'Clean MP4 (9:16)',
      'Buat Sendiri vs Guna AffiMatik', 'Akses Awal (Soft Launch)', '3. Sahkan Emel & Jana Video Pertama',
    ]) expect(page).toContain(copy);
    expect(register).toContain('Cipta Akaun & Terus ke QR');
    expect(register).not.toContain('Nombor WhatsApp');
    expect(billing).toContain('Perlukan bantuan bayaran QR? WhatsApp Admin');
    expect(page).not.toContain('Pawarna Studio ialah nama jenama dan belum merupakan syarikat atau enterprise berdaftar');
    expect(read('src/app/terms/page.tsx')).toContain('belum merupakan syarikat atau enterprise berdaftar');
  });
});
