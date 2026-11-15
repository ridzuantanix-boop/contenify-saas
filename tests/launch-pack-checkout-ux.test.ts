import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const billing = fs.readFileSync('src/app/(dashboard)/billing/page.tsx', 'utf8');
const sidebar = fs.readFileSync('src/components/layout/sidebar.tsx', 'utf8');

describe('Launch Pack P0 checkout handoff', () => {
  it('makes checkout progress and failures visible near the Launch Pack CTA', () => {
    expect(billing).toContain('Menyediakan checkout…');
    expect(billing).toContain('id="billing-feedback"');
    expect(billing).toContain('Cuba lagi');
    expect(billing).toContain("scrollIntoView({behavior:'smooth',block:'center'})");
  });

  it('reveals the actual QR checkout immediately after it is created or restored', () => {
    expect(billing).toContain('id="payment-checkout"');
    expect(billing).toContain("document.getElementById('payment-checkout')?.scrollIntoView");
    expect(billing).toContain('Checkout sudah tersedia. Imbas QR');
  });

  it('preserves Launch Pack intent from the dashboard sidebar registration entry', () => {
    expect(sidebar).toContain('/register?intent=launch_pack&source=sidebar');
  });

  it('gives a clear alternative when the one-time Launch Pack was already purchased', () => {
    expect(billing).toContain("d.code==='LAUNCH_PACK_ALREADY_PURCHASED'");
    expect(billing).toContain('Untuk kredit tambahan, pilih pelan bulanan');
  });

  it('keeps the mobile QR and receipt controls inside the viewport', () => {
    expect(billing).toContain('w-full max-w-72');
    expect(billing).toContain('max-w-full');
    expect(billing).toContain('break-all font-mono');
  });
});
