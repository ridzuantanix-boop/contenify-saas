import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle } from '../src/lib/styles/registry';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function compileFor(name: string, styleId: string, fact = 'only the physical identity supported by the reference image', category = 'product shown in uploaded image', spokenShortName = 'produk ini', options: { audioTreatment?: 'voiceover' | 'ambient' | 'asmr'; voicePersonality?: string; callToAction?: 'tiktok_shop' | 'click_button' | 'tap_button' | 'check_bio' | 'dm_info' | 'none' | 'custom'; customCta?: string; buyerProblem?: string; packagingFormat?: ProductProfile['packagingFormat']; usageContext?: string | null; confirmedFacts?: string[] } = {}) {
  const style = getVideoStyle(styleId)!;
  const product: ProductProfile = {
    name, category, packagingFormat: options.packagingFormat || 'general', spokenShortName,
    observedPhysicalFacts: [fact], usageContext: options.usageContext === null ? undefined : options.usageContext,
    buyerProblem: options.buyerProblem,
    confirmedFeatures: options.confirmedFacts || [], prohibitedClaims: ['invented ingredients','certifications','medical outcomes','prices','testimonials','unverified performance or suitability'],
    unknownFields: ['ingredients','certifications','performance'], sourceConfidence: 'manual_fallback',
    provenance: 'manual_user_entry', isVisionSupported: false,
  };
  const scene: ScenePlan = {
    mainSubject: name, location: 'ordinary Malaysian setting chosen by provider', lighting: 'natural daylight',
    cameraDistance: 'smartphone 1x', cameraMovement: 'single continuous take', startPose: 'natural',
    actionProgression: 'style-specific action', endPose: 'natural', primaryAction: 'style-specific action',
    audioPolicy: style.audioMode, targetDurationSeconds: style.durationSeconds,
  };
  return DynamicPromptCompiler.compile(product, style, scene, options).providerPrompt;
}

describe('real-provider QA prompt export', () => {
  it('compiles complete distinct prompts for two unrelated synthetic products', () => {
    const prompts = {
      dishSoapVoice: compileFor('LUMA DISH SOAP', 'NX01'),
      lampVoice: compileFor('NOVA LAMP', 'NX05'),
      lampMotion: compileFor('NOVA LAMP', 'RH01'),
    };
    for (const prompt of Object.values(prompts)) {
      expect(prompt.length).toBeLessThanOrEqual(1000);
      expect(prompt).toContain('Keep product/label/colour');
      expect(prompt).toContain('not start frames');
    }
    expect(prompts.dishSoapVoice).not.toBe(prompts.lampVoice);
    for (const prompt of [prompts.dishSoapVoice, prompts.lampVoice, prompts.lampMotion]) {
      expect(prompt).toContain('Nexabot writes hook, story and speech');
      expect(prompt).toContain('No invented benefits/results or fake self-use');
      expect(prompt).not.toContain('If no benefit is supported, discuss a visible characteristic or the ordinary category function');
      expect(prompt).not.toMatch(/ordinary buyer benefit|supported FOMO|mandatory benefit/i);
    }
    expect(prompts.lampMotion).toContain('BM Malaysia');
    if (process.env.AFFIMATIK_QA_EXPORT === '1') {
      const directory = resolve(process.cwd(), 'output', 'provider-qa');
      mkdirSync(directory, { recursive: true });
      writeFileSync(resolve(directory, 'prompts.json'), JSON.stringify(prompts, null, 2));
      const styleSamples = Object.fromEntries(
        ['NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10', 'RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19', 'NX11', 'NX12', 'NX13', 'NX14', 'NX15', 'NX16', 'NX17']
          .map((id) => [id, compileFor('NOVA LAMP', id)])
      );
      writeFileSync(resolve(directory, 'style-sample-prompts.json'), JSON.stringify(styleSamples, null, 2));
      const premiumProducts = {
        collagen: { productName: 'LUMÉA Collagen Glow Plus', imagePath: 'scripts/release/assets/premium-products/lumea-collagen.png', fact: 'suplemen kecantikan dalam bekas merah jambu', category: 'beauty supplement', spoken: 'Luméa Collagen Glow Plus' },
        serum: { productName: 'SERIYA Radiance Serum', imagePath: 'scripts/release/assets/premium-products/seriya-serum.png', fact: 'serum wajah dalam botol penitis', category: 'skincare', spoken: 'Seriya Radiance Serum' },
        omega: { productName: 'NURIVA Omega-3', imagePath: 'scripts/release/assets/premium-products/nuriva-omega3.png', fact: 'suplemen berlabel Omega-3', category: 'wellness supplement', spoken: 'Nuriva Omega-3' },
        lamp: { productName: 'NOVA LUMI Table Lamp', imagePath: 'scripts/release/assets/premium-products/nova-lumi-lamp.png', fact: 'lampu meja berbentuk kubah', category: 'home lighting', spoken: 'lampu meja Nova Lumi' },
        mist: { productName: 'AROMAÉ Home Mist', imagePath: 'scripts/release/assets/premium-products/aromae-home-mist.png', fact: 'semburan pewangi untuk ruang rumah', category: 'home fragrance', spoken: 'Aromae Home Mist' },
        sun: { productName: 'VEILÉ Sun Fluid SPF 50', imagePath: 'scripts/release/assets/premium-products/veile-sun-fluid.png', fact: 'sun fluid berlabel SPF 50', category: 'sun care', spoken: 'Veilé Sun Fluid' },
        kitchen: { productName: 'POTONGGO Manual Chopper', imagePath: 'scripts/release/assets/premium-products/potonggo-chopper.png', fact: 'pemotong manual untuk bahan dapur', category: 'kitchen', spoken: 'Potonggo' },
      } as const;
      const productByStyle: Record<string, keyof typeof premiumProducts> = {
        NX01: 'collagen', NX02: 'serum', NX03: 'lamp', NX05: 'mist', NX07: 'omega', NX09: 'sun', NX10: 'omega',
        RH01: 'mist', RH02: 'serum', RH03: 'lamp', RH04: 'sun', RH17: 'lamp', RH19: 'serum',
        NX11: 'sun', NX12: 'mist', NX13: 'kitchen', NX14: 'lamp', NX15: 'omega', NX16: 'collagen', NX17: 'serum',
      };
      const manifest = Object.keys(styleSamples).map((styleId) => {
        const product = premiumProducts[productByStyle[styleId]];
        return { styleId, ...product, prompt: compileFor(product.productName, styleId, product.fact, product.category, product.spoken) };
      });
      writeFileSync(resolve(directory, 'v6-sample-manifest.json'), JSON.stringify(manifest, null, 2));
      const rhIds = ['RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19'];
      const rhManifest = manifest.filter((item) => rhIds.includes(item.styleId));
      rhManifest.push({
        styleId: 'RH03_ASMR', ...premiumProducts.lamp,
        prompt: compileFor(premiumProducts.lamp.productName, 'RH03', premiumProducts.lamp.fact, premiumProducts.lamp.category, premiumProducts.lamp.spoken, { audioTreatment: 'asmr' }),
      });
      writeFileSync(resolve(directory, 'v8-3-rh-manifest.json'), JSON.stringify(rhManifest, null, 2));
      writeFileSync(resolve(directory, 'v8-3-rh-retry-manifest.json'), JSON.stringify(
        rhManifest.filter((item) => ['RH01', 'RH04', 'RH17', 'RH19'].includes(item.styleId)), null, 2,
      ));
      const emergencySalesDemos = [
        {
          styleId: 'NX01', productName: 'SERIYA Radiance Serum', spoken: 'Seriya Radiance Serum',
          imagePath: 'scripts/release/assets/premium-products/seriya-serum.png',
          category: 'skincare serum', fact: 'serum wajah berlabel Radiance Serum',
          cta: 'tiktok_shop' as const, buyerProblem: 'sedang membandingkan pilihan serum wajah', packagingFormat: 'bottle' as const,
        },
        {
          styleId: 'NX17', productName: 'NURIVA Omega-3', spoken: 'Nuriva Omega-3',
          imagePath: 'scripts/release/assets/premium-products/nuriva-omega3.png',
          category: 'supplement', fact: 'suplemen berlabel Omega-3',
          cta: 'custom' as const, customCta: 'Tekan butang di bawah.', buyerProblem: 'sedang menyemak pilihan suplemen Omega-3', packagingFormat: 'bottle' as const,
        },
        {
          styleId: 'NX09', productName: 'AROMAÉ Home Mist', spoken: 'Aromae Home Mist',
          imagePath: 'scripts/release/assets/premium-products/aromae-home-mist.png',
          category: 'home fragrance', fact: 'semburan pewangi ruang berlabel Home Mist',
          cta: 'tiktok_shop' as const, buyerProblem: 'mahu memilih semburan pewangi untuk ruang rumah', packagingFormat: 'bottle' as const,
        },
      ].map((item) => ({
        ...item,
        prompt: compileFor(item.productName, item.styleId, item.fact, item.category, item.spoken, {
          callToAction: item.cta,
          customCta: item.customCta,
          buyerProblem: item.buyerProblem,
          packagingFormat: item.packagingFormat,
          usageContext: null,
        }),
      }));
      writeFileSync(resolve(directory, 'emergency-sales-demo-manifest.json'), JSON.stringify(emergencySalesDemos, null, 2));
      const recoverySalesDemos = [
        {
          styleId: 'NX01', productName: 'SERIYA Radiance Serum', spoken: 'Seriya Radiance Serum',
          imagePath: 'scripts/release/assets/premium-products/seriya-serum.png', category: 'skincare serum',
          fact: 'small frosted dropper bottle with a separate matching box; both visibly read SERIYA Radiance Serum',
          cta: 'tiktok_shop' as const, packagingFormat: 'bottle' as const,
          usageContext: 'owner-authorized skincare comparison in a neutral lived-in room, with composition independent from the source image',
        },
        {
          styleId: 'NX17', productName: 'POTONGGO Manual Chopper', spoken: 'Potonggo',
          imagePath: 'scripts/release/assets/premium-products/potonggo-chopper.png', category: 'manual kitchen chopper',
          fact: 'clear container, turquoise lid, white pull handle and visible internal blades; the lid visibly reads POTONGGO',
          cta: 'custom' as const, customCta: 'Tekan butang di bawah.', packagingFormat: 'general' as const,
          usageContext: 'owner-authorized ordinary food-preparation counter with adult hands and a standard bowl as scale anchors',
        },
        {
          styleId: 'NX09', productName: 'AROMAÉ Home Mist', spoken: 'Aromae Home Mist',
          imagePath: 'scripts/release/assets/premium-products/aromae-home-mist.png', category: 'home fragrance spray',
          fact: 'amber trigger-spray bottle with a separate floral box; both visibly read AROMAÉ Home Mist',
          cta: 'custom' as const, customCta: 'Tengok detail dekat beg kuning.', packagingFormat: 'bottle' as const,
          usageContext: 'owner-authorized home entryway shelf, excluding the source image counter, flowers, box arrangement and lighting composition',
        },
      ].map((item) => ({
        ...item,
        confirmedFacts: [] as string[],
        prompt: compileFor(item.productName, item.styleId, item.fact, item.category, item.spoken, {
          callToAction: item.cta,
          customCta: item.customCta,
          packagingFormat: item.packagingFormat,
          usageContext: item.usageContext,
          confirmedFacts: [],
        }),
      }));
      writeFileSync(resolve(directory, 'sales-demo-recovery-manifest.json'), JSON.stringify(recoverySalesDemos, null, 2));
    }
  });
});
