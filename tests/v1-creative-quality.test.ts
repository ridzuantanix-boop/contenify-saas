import { describe, expect, it } from 'vitest';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle } from '../src/lib/styles/registry';

describe('AFFIMATIK V6 — creative quality regression', () => {
  const products = [
    ['Hydra Face Serum', 'Skincare', 'NX02'],
    ['Sambal Garing Bonda', 'Makanan', 'NX13'],
    ['Lampu Meja Nova', 'Lampu', 'NX14'],
    ['Cecair Pencuci Pinggan', 'Keperluan Rumah', 'RH03'],
  ] as const;

  it('compiles unrelated categories through Nexabot with universal locks', () => {
    for (const [name, category, styleId] of products) {
      const style = getVideoStyle(styleId)!;
      const profile = AICreativeDirector.extractProductProfile({ productName: name, productCategory: category });
      const compiled = DynamicPromptCompiler.compile(profile, style, AICreativeDirector.createScenePlan(profile, style));
      expect(compiled.provider).toBe('nexabot');
      expect(compiled.spokenScript).toBeUndefined();
      expect(compiled.providerPrompt).toContain('PROVIDER-CREATED DIALOGUE');
      expect(compiled.visualPrompt).toContain('9:16 aspect ratio');
      expect(compiled.visualPrompt).toContain('5500K');
      expect(compiled.visualPrompt).toContain('NO phone UI overlays');
      expect(compiled.visualPrompt).toContain('Modesty Guardrail');
    }
  });

  it('previews provider-owned dialogue without deducting or exposing a script', () => {
    const style = getVideoStyle('NX16')!;
    const profile = AICreativeDirector.extractProductProfile({ productName: 'Lampu Nova', productCategory: 'Lampu' });
    const preview = DynamicPromptCompiler.previewPrompt(profile, style, AICreativeDirector.createScenePlan(profile, style));
    expect(preview.provider).toBe('nexabot');
    expect(preview.durationSeconds).toBe(15);
    expect(preview.creditCost).toBe(10);
    expect(preview.spokenScript).toBeNull();
    expect(preview.audioDirective).toContain('Provider mencipta dialog');
  });

  it('never reintroduces internal script generation or customer script injection', () => {
    expect('resolveSpokenScript' in DynamicPromptCompiler).toBe(false);
    const style = getVideoStyle('NX05')!;
    const profile = AICreativeDirector.extractProductProfile({ productName: 'Produk Kesihatan', productCategory: 'Kesihatan' });
    const legacyScript = 'Saya sudah guna dan pasti berkesan.';
    const compiled = DynamicPromptCompiler.compile(profile, style, AICreativeDirector.createScenePlan(profile, style), { customScript: legacyScript });
    expect(compiled.providerPrompt).not.toContain(legacyScript);
    expect(compiled.providerPrompt).toContain('Never claim personal use');
  });
});
