import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8');

describe('mobile-first affiliate sales page', () => {
  it('uses customer-first copy and keeps Launch Pack intent on every sales CTA', () => {
    expect(page).toContain('Video Beg Kuning');
    expect(page).toContain('RM19 Sekali Bayar');
    expect(page).toContain('Mula Jana 15 Video Sekarang — RM19');
    expect(page).toContain('/register?intent=launch_pack&source=${placement}');
  });

  it('shows sound controls for all owner-approved proof videos', () => {
    expect(page).toContain('Tekan Untuk Dengar Suara BM');
    expect(page).toContain('Sound On · Suara BM');
    for (const id of ['NX21','NX22','NX23','NX24','NX25','NX26','NX28','NX29','NX01','NX02']) expect(page).toContain(`id: '${id}'`);
  });

  it('contains the mobile trust grid and no internal implementation jargon', () => {
    for (const badge of ['Bayar Sekali Sahaja', 'Kredit Sah 180 Hari', 'Mesra Telefon', 'Kredit Selamat']) {
      expect(page).toContain(badge);
    }
    for (const forbidden of [
      'dijana melalui Nexabot', 'dua reference identik', 'pencemaran UI', 'keadaan provider',
      'RunningHub', 'AffiMatik V10.1', 'tempahan kredit', 'Tiada ETA',
    ]) expect(page).not.toContain(forbidden);
  });
});
