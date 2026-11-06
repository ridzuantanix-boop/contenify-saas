import { describe, it, expect } from 'vitest';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { DynamicPromptCompiler, GEMS_PROMPT_VERSION } from '../src/lib/engine/compiler';
import { VoiceoverDirector } from '../src/lib/engine/voiceover-director';
import { VIDEO_STYLES_REGISTRY, getVideoStyle } from '../src/lib/styles/registry';

describe('AFFIMATIK GEMS MASTERPROMPTS V5.0 — Authoritative Creative Suite', () => {
  const publishedStyleIds = [
    'NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10',
    'RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19',
  ];

  const productFixtures = [
    {
      categoryName: 'Skincare',
      productName: 'Hydra-Boost Face Serum 30ml',
      category: 'Skincare',
      confirmedBenefit: 'Membantu melembapkan kulit kering',
      expectedSpokenShort: 'serum muka ni',
    },
    {
      categoryName: 'Packaged Food',
      productName: 'Sambal Garing Ikan Bilis Bonda',
      category: 'Makanan & Masakan',
      confirmedBenefit: 'Sedia dimakan terus bersama nasi panas',
      expectedSpokenShort: 'sambal ni',
    },
    {
      categoryName: 'Fashion & Tudung',
      productName: 'Tudung Bawal Cotton Voile Premium',
      category: 'Fesyen Muslimah',
      confirmedBenefit: 'Kain bawal sejuk dan mudah dibentuk',
      expectedSpokenShort: 'tudung bawal ni',
    },
    {
      categoryName: 'Gadget & Electronics',
      productName: 'Ultra-Slim 20000mAh Powerbank',
      category: 'Elektronik & Gadget',
      confirmedBenefit: 'Menyokong pengecasan pantas 22.5W',
      expectedSpokenShort: 'powerbank ni',
    },
    {
      categoryName: 'Home & Living',
      productName: 'Lampu Meja LED 3 Mod',
      category: 'Keperluan Rumah',
      confirmedBenefit: 'Mempunyai tiga tahap kecerahan',
      expectedSpokenShort: 'lampu meja ni',
    },
  ];

  // ---------------------------------------------------------------------------
  // 1. Authoritative Style Registry & Metadata Verification
  // ---------------------------------------------------------------------------
  it('1. verifies that all 13 styles are published with promptTemplateVersion V5.0', () => {
    expect(VIDEO_STYLES_REGISTRY.length).toBe(13);

    for (const styleId of publishedStyleIds) {
      const style = getVideoStyle(styleId);
      expect(style).toBeDefined();
      expect(style?.id).toBe(styleId);
      expect(style?.publicationStatus).toBe('published');
      expect(style?.promptTemplateVersion).toBe('affimatik-gems-masterprompts-v5.0');
      expect(style?.actionPlan.primaryAction).toBeDefined();
      expect(style?.actionPlan.actionProgression).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Product Brain Intelligence Across 5 Diverse Categories
  // ---------------------------------------------------------------------------
  it('2. verifies Product Brain generates natural spoken aliases and grounded category facts', () => {
    for (const fixture of productFixtures) {
      const profile = AICreativeDirector.extractProductProfile({
        productName: fixture.productName,
        productCategory: fixture.category,
        productFacts: [fixture.confirmedBenefit],
      });

      expect(profile.name).toBe(fixture.productName);
      expect(profile.spokenShortName).toBe(fixture.expectedSpokenShort);
      expect(profile.confirmedFeatures).toContain(fixture.confirmedBenefit);
      expect(profile.coreFunction).toBeDefined();
      expect(profile.usageContext).toBeDefined();
      expect(profile.buyerProblem).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Style-Specific Hook Engine & Zero Packaging Filler
  // ---------------------------------------------------------------------------
  it('3. verifies unique hook strategy for each of the 7 Voice styles and zero packaging filler', () => {
    const fixture = productFixtures[4]; // Lampu Meja LED 3 Mod
    const profile = AICreativeDirector.extractProductProfile({
      productName: fixture.productName,
      productCategory: fixture.category,
      productFacts: [fixture.confirmedBenefit],
    });

    const voiceStyles = ['NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10'];
    const generatedScripts = new Map<string, string>();

    for (const styleId of voiceStyles) {
      const style = getVideoStyle(styleId)!;
      const script = VoiceoverDirector.generateAuthenticScript(profile, style, 'spoken_button', 0);
      generatedScripts.set(styleId, script);

      // Verify strict word budget (target 14-23 words, bounds 12-26)
      const words = script.split(/\s+/).filter(Boolean);
      expect(words.length).toBeGreaterThanOrEqual(14);
      expect(words.length).toBeLessThanOrEqual(25);

      // Verify ZERO packaging filler
      expect(script).not.toMatch(/packaging|bungkusan|botol ni cantik|label ni mudah/i);
      expect(script).not.toMatch(/\b(kamu|kalian|nggak|banget|cobain|keranjang kuning)\b/i);

      // Verify verbal CTA presence
      expect(script).toContain('Tekan butang di bawah.');
    }

    // Verify distinct hook strategies
    const nx01Script = generatedScripts.get('NX01')!;
    expect(nx01Script).toMatch(/^Kalau korang/i); // Situation hook

    const nx02Script = generatedScripts.get('NX02')!;
    expect(nx02Script).toMatch(/^Lampu meja ni/i); // Direct product explainer hook

    const nx03Script = generatedScripts.get('NX03')!;
    expect(nx03Script).toMatch(/^Eh, lampu meja ni rupanya/i); // First impression curiosity hook

    const nx05Script = generatedScripts.get('NX05')!;
    expect(nx05Script).toMatch(/\? Lampu meja ni/i); // Problem-solution question hook

    const nx07Script = generatedScripts.get('NX07')!;
    expect(nx07Script).toMatch(/\? Ya, model ni/i); // Direct Q&A question hook

    const nx09Script = generatedScripts.get('NX09')!;
    expect(nx09Script).toMatch(/^Untuk/i); // Off-camera usage context hook

    const nx10Script = generatedScripts.get('NX10')!;
    expect(nx10Script).toMatch(/^Yang penting tentang/i); // Fact & utility first hook
  });

  // ---------------------------------------------------------------------------
  // 4. Verbatim User Custom Script Preservation
  // ---------------------------------------------------------------------------
  it('4. excludes a legacy custom script from the direct provider payload', () => {
    const style = getVideoStyle('NX01')!;
    const profile = AICreativeDirector.extractProductProfile({
      productName: 'Minyak Habbatus Sauda',
      productCategory: 'Kesihatan',
    });
    const scenePlan = AICreativeDirector.createScenePlan(profile, style);

    const approvedCustomScript = 'Korang yang selalu keletihan waktu kerja, minyak habbatus sauda ni sangat membantu menyegarkan badan. Tekan butang di bawah.';

    const compiled = DynamicPromptCompiler.compile(profile, style, scenePlan, {
      customScript: approvedCustomScript,
    });

    expect(compiled.preflightValid).toBe(true);
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).not.toContain(approvedCustomScript);
    expect(compiled.providerPrompt).toContain('PROVIDER-CREATED DIALOGUE');
  });

  // ---------------------------------------------------------------------------
  // 5. Motion 15s Pure Visual Realism & Zero Spoken Dialogue
  // ---------------------------------------------------------------------------
  it('5. verifies that all 6 Motion 15s styles strictly enforce zero spoken dialogue', () => {
    const rhStyles = ['RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19'];
    const fixture = productFixtures[3]; // Powerbank
    const profile = AICreativeDirector.extractProductProfile({
      productName: fixture.productName,
      productCategory: fixture.category,
      productFacts: [fixture.confirmedBenefit],
    });

    for (const styleId of rhStyles) {
      const style = getVideoStyle(styleId)!;
      const scenePlan = AICreativeDirector.createScenePlan(profile, style);
      const compiled = DynamicPromptCompiler.compile(profile, style, scenePlan);

      expect(compiled.preflightValid).toBe(true);
      expect(compiled.provider).toBe('runninghub');
      expect(compiled.spokenScript).toBeUndefined();
      expect(compiled.providerPrompt).toContain('Strictly NO spoken dialogue');
      expect(compiled.providerPrompt).toContain('15-second');
      expect(compiled.promptVersion).toBe(GEMS_PROMPT_VERSION);
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Global Universal Locks: Identity, Zero UI, and Shariah Modesty
  // ---------------------------------------------------------------------------
  it('6. verifies universal master locks enforced across all styles', () => {
    for (const styleId of publishedStyleIds) {
      const style = getVideoStyle(styleId)!;
      const fixture = productFixtures[0];
      const profile = AICreativeDirector.extractProductProfile({
        productName: fixture.productName,
        productCategory: fixture.category,
      });
      const scenePlan = AICreativeDirector.createScenePlan(profile, style);
      const compiled = DynamicPromptCompiler.compile(profile, style, scenePlan, {
        isMuslimahModest: true,
      });

      // Product Identity Max Lock
      expect(compiled.visualPrompt).toContain('[PRODUCT IDENTITY MAX LOCK]');
      expect(compiled.visualPrompt).toContain('Preserve exact product geometry');

      // Zero UI Lock
      expect(compiled.visualPrompt).toContain('[ZERO UI & WATERMARK LOCK]');
      expect(compiled.visualPrompt).toContain('Strictly NO TikTok logo');
      expect(compiled.visualPrompt).toContain('NO phone frame');

      // Realistic UGC
      expect(compiled.visualPrompt).toContain('[REALISTIC UGC PROFILE]');
      expect(compiled.visualPrompt).toContain('5500K');

      // Shariah Modesty Lock
      if (style.category === 'hand_demo' || styleId.startsWith('RH') || styleId === 'NX09' || styleId === 'NX10') {
        expect(compiled.visualPrompt).toContain('[SHARIAH MODESTY LOCK — HAND DEMO]');
        expect(compiled.visualPrompt).toContain('sleeve fully covering wrist');
      } else {
        expect(compiled.visualPrompt).toContain('[SHARIAH MODESTY LOCK — PRESENTER]');
        expect(compiled.visualPrompt).toContain('Hijab labuh fully covering hair, neck, and chest');
      }
    }
  });
});
