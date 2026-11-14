import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { CLIENT_CONVERSION_EVENTS, CONVERSION_EVENTS } from '../src/lib/analytics/conversion';
import { POST as recordConversion } from '../src/app/api/analytics/conversion/route';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('AffiMatik Sales Page Conversion V2', () => {
  it('opens with the customer problem, solution, real proof and exact RM19 CTA', () => {
    const page = read('src/app/page.tsx');
    expect(page).toContain('Penat Nak Buat Video Affiliate');
    expect(page).toContain('Banyak produk nak promote');
    expect(page).toContain('Mula Dengan RM19');
    expect(page).toContain('Satu gambar produk → satu video affiliate sebenar');
    expect(page).toContain('RM19 · 150 kredit · sah 180 hari');
  });

  it('ships all eight customer-first sections and honest proof labels', () => {
    const page = read('src/app/page.tsx');
    for (const copy of [
      'Produk makin banyak. Masa content tetap sama.',
      'Gambar masuk. MP4 sebenar keluar.',
      'Upload. Pilih gaya. Tekan Jana.',
      'Tak perlu tunggu depan skrin satu video demi satu.',
      'Cara paling mudah untuk mula',
      'Soalan sebelum mula',
      'Produk dah ada. Sekarang jadikan ia content.',
    ]) expect(page).toContain(copy);
    expect(page).toContain('kempen Creative V6');
    expect(page).toContain('Enjin live kini V10.1');
    for (const id of ['NX17', 'NX01', 'RH03']) expect(page).toContain(id);
  });

  it('uses the genuine uploaded tutorial and matched product-to-video assets', () => {
    const files = [
      'public/marketing/tutorials/affimatik-v10-mobile.mp4',
      'public/marketing/tutorials/quick-bulk-v9.mp4',
      'public/marketing/proof/seriya-source.webp',
      'public/marketing/proof/lumea-source.webp',
      'public/marketing/proof/nova-lumi-source.webp',
    ];
    for (const file of files) {
      const bytes = fs.readFileSync(path.join(root, file));
      expect(bytes.length).toBeGreaterThan(10_000);
    }
    expect(read('src/app/page.tsx')).toContain('Rakaman skrin sebenar AffiMatik V10.1');
  });

  it('preserves Launch Pack intent from landing through auth and billing', () => {
    const landing = read('src/app/page.tsx');
    const register = read('src/app/register/page.tsx');
    const login = read('src/app/login/page.tsx');
    const callback = read('src/app/auth/callback/page.tsx');
    const billing = read('src/app/(dashboard)/billing/page.tsx');
    expect(landing).toContain('/register?intent=launch_pack');
    for (const file of [register, login, callback, billing]) expect(file).toContain('affimatik_purchase_intent');
    expect(callback).toContain('/billing?intent=launch_pack');
    expect(billing).toContain('id="launch-pack"');
  });

  it('defines the eleven requested events and keeps financial truth server-only', () => {
    expect(CONVERSION_EVENTS).toEqual([
      'landing_view','demo_play','launch_cta_click','registration_started','registration_completed',
      'email_verified','launch_checkout_started','qr_evidence_submitted','credits_provisionally_activated',
      'payment_bank_verified','first_video_completed',
    ]);
    for (const event of ['qr_evidence_submitted','credits_provisionally_activated','payment_bank_verified','first_video_completed']) {
      expect(CLIENT_CONVERSION_EVENTS.has(event as never)).toBe(false);
    }
    const route = read('src/app/api/analytics/conversion/route.ts');
    expect(route).not.toMatch(/password|whatsapp|receipt_object|email_address/i);
    expect(read('supabase/migrations/00028_conversion_events.sql')).toContain('UNIQUE(event_name, dedupe_key)');
  });

  it('keeps analytics fail-open and rejects client-forged financial events', async () => {
    const originalUrl = process.env.SUPABASE_URL;
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const failOpen = await recordConversion(new NextRequest('https://affimatik.online/api/analytics/conversion', {
        method: 'POST',
        headers: { 'content-type': 'application/json', referer: 'https://affimatik.online/' },
        body: JSON.stringify({ eventName: 'landing_view', dedupeKey: 'release-check' }),
      }));
      expect(failOpen.status).toBe(202);
      expect(await failOpen.json()).toEqual({ recorded: false });

      const forgedFinancial = await recordConversion(new NextRequest('https://affimatik.online/api/analytics/conversion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventName: 'payment_bank_verified', dedupeKey: 'forged' }),
      }));
      expect(forgedFinancial.status).toBe(400);
    } finally {
      if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
      if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });

  it('locks analytics behind service-role access and two independent idempotency keys', () => {
    const migration = read('supabase/migrations/00028_conversion_events.sql');
    expect(migration).toContain('ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.conversion_events FROM anon, authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.conversion_events TO service_role');
    expect(migration).toContain('event_id UUID NOT NULL UNIQUE');
    expect(migration).toContain('UNIQUE(event_name, dedupe_key)');
  });

  it('removes stale V6 SEO metadata while preserving the admin manifest', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toContain('Jana Video Affiliate Dari Gambar Produk');
    expect(layout).toContain('openGraph');
    expect(layout).not.toContain('AffiMatik Voice V6');
    expect(read('src/app/manifest.ts')).toContain("name: 'AffiMatik Admin & CRM'");
  });
});
