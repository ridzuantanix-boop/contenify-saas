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
      expect(compiled.spokenScript).toBeTruthy();
      expect(compiled.providerPrompt).toContain('[V8 SMART SCRIPT CONTROL]');
      expect(compiled.visualPrompt).toContain('9:16 aspect ratio');
      expect(compiled.visualPrompt).toContain('5500K');
      expect(compiled.visualPrompt).toContain('NO phone UI overlays');
      expect(compiled.visualPrompt).toContain('Modesty Guardrail');
    }
  });

  it('keeps the non-billing prompt summary available', () => {
    const style = getVideoStyle('NX16')!;
    const profile = AICreativeDirector.extractProductProfile({ productName: 'Lampu Nova', productCategory: 'Lampu' });
    const preview = DynamicPromptCompiler.previewPrompt(profile, style, AICreativeDirector.createScenePlan(profile, style));
    expect(preview.provider).toBe('nexabot');
    expect(preview.durationSeconds).toBe(15);
    expect(preview.creditCost).toBe(10);
    expect(preview.spokenScript).toContain('Lampu Nova');
    expect(preview.audioDirective).toContain('skrip V8');
  });

  it('does not treat a legacy customScript field as Custom Script without explicit mode', () => {
    expect('resolveSpokenScript' in DynamicPromptCompiler).toBe(false);
    const style = getVideoStyle('NX05')!;
    const profile = AICreativeDirector.extractProductProfile({ productName: 'Produk Kesihatan', productCategory: 'Kesihatan' });
    const legacyScript = 'Saya sudah guna dan pasti berkesan.';
    const compiled = DynamicPromptCompiler.compile(profile, style, AICreativeDirector.createScenePlan(profile, style), { customScript: legacyScript });
    expect(compiled.providerPrompt).not.toContain(legacyScript);
    expect(compiled.providerPrompt).toContain('Never claim personal use');
  });
});
