import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('public tutorial showcase', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/app/tutorial-showcase/page.tsx'), 'utf8');

  it('is a static, no-login, noindex showcase', () => {
    expect(source).toContain("export const dynamic = 'force-static'");
    expect(source).toContain('index: false');
    expect(source).not.toContain('getSessionFromRequest');
  });

  it('does not call production APIs or expose active forms', () => {
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/<form[\s>]/);
    expect(source).not.toContain('/api/');
  });

  it('covers the full V9 customer tutorial journey', () => {
    for (const section of ['dashboard', 'creator-profiles', 'product-folders', 'auto-factory', 'styles', 'queue', 'video-library', 'billing']) {
      expect(source).toContain(`data-tutorial-step=\"${section}\"`);
    }
    expect(source).toContain('20 Gaya Rasmi');
    expect(source).toContain('Daily Auto Run');
  });
});
