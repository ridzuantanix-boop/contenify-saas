import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const tracker = fs.readFileSync('src/components/analytics/heatmap-tracker.tsx', 'utf8');
const route = fs.readFileSync('src/app/api/analytics/heatmap/route.ts', 'utf8');
const privacy = fs.readFileSync('src/app/privacy/page.tsx', 'utf8');

describe('anonymous first-party salespage heatmap', () => {
  it('collects only page-scoped interaction measurements without a consent popup or persistent identifier', () => {
    expect(tracker).toContain('anonymous: true');
    expect(tracker).toContain('crypto.randomUUID()');
    expect(tracker).toContain("target.closest('input, textarea, select, [contenteditable=\"true\"]')");
    expect(tracker).not.toContain('affimatik_heatmap_choice');
    expect(tracker).not.toContain('localStorage');
    expect(tracker).not.toContain('Tetapan analitik');
    expect(tracker).not.toContain('Benarkan');
    expect(tracker).toContain('return null');
  });

  it('retains server-side payload, origin and event-count protections', () => {
    expect(route).toContain('body.anonymous !== true');
    expect(route).toContain("origin === expected");
    expect(route).toContain("new URL(referer).pathname === '/'");
    expect(route).toContain("Number(req.headers.get('content-length') || 0) > 1600");
    expect(route).toContain('Number(seq) > 40');
    expect(route).not.toContain('body.consent');
  });

  it('discloses the limited anonymous measurement accurately', () => {
    expect(privacy).toContain('ukuran interaksi anonim yang terhad');
    expect(privacy).toContain('ID sesi rawak yang baharu bagi setiap page-load');
    expect(privacy).toContain('tidak merekod teks yang ditaip');
    expect(privacy).toContain('tidak menyimpan cookie atau pengecam pelayar berterusan');
  });
});
