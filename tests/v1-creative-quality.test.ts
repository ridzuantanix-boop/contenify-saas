import { describe, expect, it } from 'vitest';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle } from '../src/lib/styles/registry';

describe('AFFIMATIK V8 — creative quality regression', () => {
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
      expect(compiled.providerPrompt).toContain('Nexabot writes hook, story and speech');
      expect(compiled.visualPrompt).toContain('15s 9:16 Malaysian UGC');
      expect(compiled.visualPrompt).toContain('Neutral daylight, true whites');
      expect(compiled.visualPrompt).toContain('no source UI');
      expect(compiled.visualPrompt).toMatch(/covered wrists|cover wrists|Modest everyday dress/);
      expect(compiled.providerPrompt.length).toBeLessThanOrEqual(1000);
    }
  });

  it('keeps the non-billing prompt summary available', () => {
    const style = getVideoStyle('NX16')!;
    const profile = AICreativeDirector.extractProductProfile({ productName: 'Lampu Nova', productCategory: 'Lampu' });
    const preview = DynamicPromptCompiler.previewPrompt(profile, style, AICreativeDirector.createScenePlan(profile, style));
    expect(preview.provider).toBe('nexabot');
    expect(preview.durationSeconds).toBe(15);
    expect(preview.creditCost).toBe(10);
    expect(preview.spokenScript).toBeNull();
    expect(preview.audioDirective).toContain('Nexabot');
  });

  it('does not treat a legacy customScript field as Custom Script without explicit mode', () => {
    expect('resolveSpokenScript' in DynamicPromptCompiler).toBe(false);
    const style = getVideoStyle('NX05')!;
    const profile = AICreativeDirector.extractProductProfile({ productName: 'Produk Kesihatan', productCategory: 'Kesihatan' });
    const legacyScript = 'Saya sudah guna dan pasti berkesan.';
    const compiled = DynamicPromptCompiler.compile(profile, style, AICreativeDirector.createScenePlan(profile, style), { customScript: legacyScript });
    expect(compiled.providerPrompt).not.toContain(legacyScript);
    expect(compiled.providerPrompt).toContain('No invented benefits/results or fake self-use');
  });
});
