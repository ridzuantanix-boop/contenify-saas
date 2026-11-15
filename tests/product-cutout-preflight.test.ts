import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('deterministic product cutout preflight', () => {
  it('is an isolated, non-generative test tool and never overwrites its source', () => {
    const script = fs.readFileSync(path.join(root, 'scripts/release/product-cutout-preflight.py'), 'utf8');
    expect(script).toContain('explicitly reviewed polygon mask');
    expect(script).toContain('identityPixelsUnchanged');
    expect(script).not.toMatch(/openai|gemini|nexabot|requests\.post|fetch\(/i);
    expect(script).not.toMatch(/source\.save|original\.save/);
  });

  it('keeps separate reviewed specifications for all components in both examples', () => {
    for (const name of ['seriya-serum', 'aromae-home-mist']) {
      const spec = JSON.parse(fs.readFileSync(path.join(root, `scripts/release/product-cutout-specs/${name}.json`), 'utf8'));
      expect(spec.includePolygons).toHaveLength(2);
      expect(spec.expectedSize).toEqual([1122, 1402]);
      expect(fs.existsSync(path.join(root, spec.source))).toBe(true);
    }
  });
});
