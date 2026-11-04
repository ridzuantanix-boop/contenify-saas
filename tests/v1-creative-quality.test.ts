import { describe, it, expect } from 'vitest';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { VoiceoverDirector } from '../src/lib/engine/voiceover-director';
import { getVideoStyle, getAllVideoStyles } from '../src/lib/styles/registry';

describe('AFFIMATIK VIDEO FACTORY — V1 Creative Quality Acceptance Suite', () => {
  const categories = [
    {
      categoryName: 'Beauty & Skincare Bottle',
      productName: 'Hydra-Boost Face Serum 30ml',
      productCategory: 'Skincare',
      confirmedBenefit: 'Membantu melembapkan kulit kering',
      expectedFormat: 'bottle',
      testStyleId: 'NX01', // Nexabot Sembang Kawan 10s
    },
    {
      categoryName: 'Packaged Food',
      productName: 'Sambal Garing Ikan Bilis Bonda',
      productCategory: 'Makanan & Masakan',
      confirmedBenefit: 'Sedia dimakan terus bersama nasi panas',
      expectedFormat: 'jar',
      testStyleId: 'NX02', // Nexabot Review Sambil Pegang 10s
    },
    {
      categoryName: 'Fashion & Tudung',
      productName: 'Tudung Bawal Cotton Voile Premium',
      productCategory: 'Fesyen Muslimah',
      confirmedBenefit: 'Kain bawal sejuk dan mudah dibentuk',
      expectedFormat: 'apparel',
      testStyleId: 'NX09', // Nexabot Goyang Produk + VO 10s
    },
    {
      categoryName: 'Gadget & Electronic Device',
      productName: 'Ultra-Slim 20000mAh Powerbank',
      productCategory: 'Elektronik & Gadget',
      confirmedBenefit: 'Menyokong pengecasan pantas 22.5W',
      expectedFormat: 'gadget',
      testStyleId: 'RH01', // RunningHub Goyang Produk Natural 15s
    },
    {
      categoryName: 'Household Product',
      productName: 'Cecair Pencuci Pinggan Ekstrak Lemon',
      productCategory: 'Keperluan Rumah',
      confirmedBenefit: 'Menanggalkan kesan minyak dengan pantas',
      expectedFormat: 'bottle',
      testStyleId: 'RH03', // RunningHub Pick Up & Put Down 15s
    },
  ];

  it('1. verifies Product Intelligence truthful source-grounding across all 5 distinct categories', () => {
    for (const cat of categories) {
      const profile = AICreativeDirector.extractProductProfile({
        productName: cat.productName,
        productCategory: cat.productCategory,
        productFacts: [cat.confirmedBenefit],
      });

      expect(profile.name).toBe(cat.productName);
      expect(profile.packagingFormat).toBe(cat.expectedFormat);
      expect(profile.confirmedFeatures).toContain(cat.confirmedBenefit);
      // Confirms no hallucinated ingredients or unverified clinical claims
      expect(profile.prohibitedClaims).toBeDefined();
      expect(profile.prohibitedClaims.length).toBeGreaterThan(0);
      expect(profile.sourceConfidence).toBe('verified_user');
    }
  });

  it('2. verifies Nexabot 10s dynamic prompt specification for beauty, food, and fashion', () => {
    const nexabotItems = categories.filter((c) => c.testStyleId.startsWith('NX'));

    for (const item of nexabotItems) {
      const style = getVideoStyle(item.testStyleId)!;
      const profile = AICreativeDirector.extractProductProfile({
        productName: item.productName,
        productCategory: item.productCategory,
        productFacts: [item.confirmedBenefit],
      });

      const scenePlan = AICreativeDirector.createScenePlan(profile, style);
      const compiled = DynamicPromptCompiler.compile(profile, style, scenePlan, {
        callToAction: 'spoken_button',
        isMuslimahModest: true,
      });

      expect(compiled.preflightValid).toBe(true);
      expect(compiled.provider).toBe('nexabot');
      expect(compiled.spokenScript).toBeDefined();

      // Check spoken script word count budget (12 to 26 words)
      const words = compiled.spokenScript!.split(/\s+/).filter(Boolean);
      expect(words.length).toBeGreaterThanOrEqual(12);
      expect(words.length).toBeLessThanOrEqual(26);

      // Check Bahasa Melayu and no prohibited Indonesian slang
      expect(compiled.spokenScript).not.toMatch(/\b(kamu|kalian|nggak|banget|cobain|keranjang kuning)\b/i);

      // Check visual camera specifications (UGC, vertical 9:16, 5500K daylight, realistic product scale 20-30%)
      expect(compiled.visualPrompt).toContain('9:16 aspect ratio');
      expect(compiled.visualPrompt).toContain('5500K');
      expect(compiled.visualPrompt).toContain('scale (approximately 20-30% of the frame)');
      expect(compiled.visualPrompt).toContain('One single continuous 10-second shot');
      expect(compiled.visualPrompt).toContain('NO phone UI overlays');
      expect(compiled.visualPrompt).toContain('NO fake buttons');

      // Check modesty guardrail
      expect(compiled.visualPrompt).toContain('Modesty Guardrail');
    }
  });

  it('3. verifies RunningHub 15s visual prompt specification for gadget and household products', () => {
    const runninghubItems = categories.filter((c) => c.testStyleId.startsWith('RH'));

    for (const item of runninghubItems) {
      const style = getVideoStyle(item.testStyleId)!;
      const profile = AICreativeDirector.extractProductProfile({
        productName: item.productName,
        productCategory: item.productCategory,
        productFacts: [item.confirmedBenefit],
      });

      const scenePlan = AICreativeDirector.createScenePlan(profile, style);
      const compiled = DynamicPromptCompiler.compile(profile, style, scenePlan);

      expect(compiled.preflightValid).toBe(true);
      expect(compiled.provider).toBe('runninghub');
      expect(compiled.spokenScript).toBeUndefined(); // Strictly no spoken dialogue

      // Check 15-second creative timeline progression (0-4s, 4-10s, 10-15s)
      expect(compiled.visualPrompt).toContain('15-second');
      expect(compiled.visualPrompt).toContain('0s to 4s');
      expect(compiled.visualPrompt).toContain('4s to 10s');
      expect(compiled.visualPrompt).toContain('10s to 15s');
      expect(compiled.visualPrompt).toContain('NO spoken dialogue');
      expect(compiled.visualPrompt).toContain('NO lip-sync movement');
    }
  });

  it('4. verifies prompt preview functionality without deducting customer credits', () => {
    const style = getVideoStyle('NX01')!;
    const profile = AICreativeDirector.extractProductProfile({
      productName: 'Jus Halia Organik',
      productCategory: 'Makanan',
      productFacts: ['Membantu menyegarkan badan'],
    });

    const scenePlan = AICreativeDirector.createScenePlan(profile, style);
    const preview = DynamicPromptCompiler.previewPrompt(profile, style, scenePlan, {
      callToAction: 'spoken_button',
    });

    expect(preview.provider).toBe('nexabot');
    expect(preview.durationSeconds).toBe(10);
    expect(preview.creditCost).toBe(10);
    expect(preview.spokenScript).toBeDefined();
    expect(preview.visualSummary).toContain('10 saat');
    expect(preview.modestyRules).toBeDefined();
    expect(preview.productIdentityRules).toContain('Jus Halia Organik');
  });

  it('5. verifies priority order of script generation (Custom > Product Facts > Fallback)', () => {
    const style = getVideoStyle('NX01')!;
    const profileWithFacts = AICreativeDirector.extractProductProfile({
      productName: 'Minyak Aromaterapi Bidara',
      productCategory: 'Kesihatan',
      productFacts: ['Memberikan aroma menenangkan'],
    });

    // Priority 1: Customer custom script
    const customScript = 'Korang cuba tengok minyak bidara ni, bau dia memang wangi dan sesuai bawa solat. Tekan bawah sekarang.';
    const customResult = DynamicPromptCompiler.resolveSpokenScript(profileWithFacts, style, {
      customScript,
    });
    expect(customResult).toBe(customScript);

    // Priority 2: Product facts dynamically integrated
    const dynamicResult = DynamicPromptCompiler.resolveSpokenScript(profileWithFacts, style, {
      callToAction: 'spoken_button',
    });
    expect(dynamicResult).toContain('memberikan aroma menenangkan');

    // Priority 3: Fallback when facts are empty (truthful visual observation without overclaim)
    const profileWithoutFacts = AICreativeDirector.extractProductProfile({
      productName: 'Minyak Wangi X',
      productCategory: 'Kecantikan',
    });
    const fallbackResult = DynamicPromptCompiler.resolveSpokenScript(profileWithoutFacts, style, {
      callToAction: 'spoken_button',
    });
    expect(fallbackResult).not.toContain('kualiti terjamin');
    expect(fallbackResult).not.toContain('mudah meresap');
    expect(fallbackResult).toContain('Tekan butang di bawah');
  });
});
