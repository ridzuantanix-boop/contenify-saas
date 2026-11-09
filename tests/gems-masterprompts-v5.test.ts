import { describe, expect, it } from 'vitest';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { DynamicPromptCompiler, GEMS_PROMPT_VERSION } from '../src/lib/engine/compiler';
import { VIDEO_STYLES_REGISTRY, getVideoStyle } from '../src/lib/styles/registry';

const OFFICIAL_IDS = [
  'NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10',
  'RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19',
  'NX11', 'NX12', 'NX13', 'NX14', 'NX15', 'NX16', 'NX17',
];

describe('AFFIMATIK CREATIVE V6 — canonical direct-provider suite', () => {
  it('publishes exactly 20 canonical Nexabot 15-second styles', () => {
    expect(VIDEO_STYLES_REGISTRY.map((style) => style.id)).toEqual(OFFICIAL_IDS);
    for (const style of VIDEO_STYLES_REGISTRY) {
      expect(style.engine).toBe('nexabot');
      expect(style.durationSeconds).toBe(15);
      expect(style.publicationStatus).toBe('published');
      expect(style.promptTemplateVersion).toBe('affimatik-creative-v6.0');
      expect(style.creativeDirection).toBeDefined();
      expect(style.actionPlan.primaryAction).toBeTruthy();
    }
  });

  it('keeps every style direction distinct', () => {
    const fingerprints = VIDEO_STYLES_REGISTRY.map((style) => JSON.stringify(style.creativeDirection));
    expect(new Set(fingerprints).size).toBe(20);
  });

  it('compiles all styles with distinct curated V8 Smart Script patterns', () => {
    const product = AICreativeDirector.extractProductProfile({ productName: 'Lampu Meja Nova', productCategory: 'Lampu' });
    const prompts = VIDEO_STYLES_REGISTRY.map((style) => {
      const compiled = DynamicPromptCompiler.compile(product, style, AICreativeDirector.createScenePlan(product, style));
      expect(compiled.preflightValid, style.id).toBe(true);
      expect(compiled.provider, style.id).toBe('nexabot');
      expect(compiled.spokenScript, style.id).toBeTruthy();
      expect(compiled.promptVersion).toBe(GEMS_PROMPT_VERSION);
      expect(compiled.providerPrompt).toContain(`[STYLE ${style.id} —`);
      expect(compiled.providerPrompt).toContain('[MALAYSIAN AFFILIATE VOICE DNA V6]');
      expect(compiled.providerPrompt).toContain('[V8 SMART SCRIPT CONTROL]');
      expect(compiled.providerPrompt).not.toMatch(/\$\{p\.spokenScript\}|\{script_body\}|Script: ""/i);
      return compiled.providerPrompt;
    });
    expect(new Set(prompts).size).toBe(20);
  });

  it('preserves identity, realistic UGC, zero UI, Shariah and grounded-claim locks', () => {
    for (const styleId of OFFICIAL_IDS) {
      const style = getVideoStyle(styleId)!;
      const product = AICreativeDirector.extractProductProfile({ productName: 'Produk Rujukan', productCategory: 'Umum' });
      const compiled = DynamicPromptCompiler.compile(product, style, AICreativeDirector.createScenePlan(product, style));
      expect(compiled.providerPrompt).toContain('[PRODUCT IDENTITY MAX LOCK]');
      expect(compiled.providerPrompt).toContain('[ZERO UI & WATERMARK LOCK]');
      expect(compiled.providerPrompt).toContain('[REALISTIC UGC PROFILE]');
      expect(compiled.providerPrompt).toContain('[SHARIAH MODESTY LOCK');
      expect(compiled.providerPrompt).toContain('If the image and customer-confirmed facts do not establish a claim, omit it entirely');
      expect(compiled.providerPrompt).toContain('never a mandatory first frame');
    }
  });

  it('ignores custom text unless Custom Script mode is explicitly selected', () => {
    const style = getVideoStyle('NX01')!;
    const product = AICreativeDirector.extractProductProfile({ productName: 'Produk Ujian', productCategory: 'Umum' });
    const supplied = 'Ayat ini tidak boleh menjadi skrip pertuturan backend.';
    const compiled = DynamicPromptCompiler.compile(product, style, AICreativeDirector.createScenePlan(product, style), { customScript: supplied });
    expect(compiled.spokenScript).toBeTruthy();
    expect(compiled.providerPrompt).not.toContain(supplied);
  });
});
