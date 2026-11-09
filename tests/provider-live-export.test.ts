import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle } from '../src/lib/styles/registry';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function compileFor(name: string, styleId: string, fact = 'only the purpose supported by the reference image', category = 'product shown in uploaded image', spokenShortName = 'produk ini') {
  const style = getVideoStyle(styleId)!;
  const product: ProductProfile = {
    name, category, packagingFormat: 'general', spokenShortName,
    coreFunction: fact, usageContext: 'ordinary Malaysian use inferred cautiously from the image',
    buyerProblem: 'a grounded problem relevant to the actual product', allowedQaQuestion: 'what this product is actually for',
    confirmedFeatures: [fact], prohibitedClaims: ['invented ingredients','certifications','medical outcomes','prices','testimonials'],
    unknownFields: ['ingredients','certifications','performance'], sourceConfidence: 'manual_fallback',
    provenance: 'manual_user_entry', isVisionSupported: false,
  };
  const scene: ScenePlan = {
    mainSubject: name, location: 'ordinary Malaysian setting chosen by provider', lighting: 'natural daylight',
    cameraDistance: 'smartphone 1x', cameraMovement: 'single continuous take', startPose: 'natural',
    actionProgression: 'style-specific action', endPose: 'natural', primaryAction: 'style-specific action',
    audioPolicy: style.audioMode, targetDurationSeconds: style.durationSeconds,
  };
  return DynamicPromptCompiler.compile(product, style, scene).providerPrompt;
}

describe('real-provider QA prompt export', () => {
  it('compiles complete distinct prompts for two unrelated synthetic products', () => {
    const prompts = {
      dishSoapVoice: compileFor('LUMA DISH SOAP', 'NX01'),
      lampVoice: compileFor('NOVA LAMP', 'NX05'),
      lampMotion: compileFor('NOVA LAMP', 'RH01'),
    };
    for (const prompt of Object.values(prompts)) {
      expect(prompt.length).toBeGreaterThan(2000);
      expect(prompt).toContain('[PRODUCT IDENTITY MAX LOCK]');
      expect(prompt).toContain('never paste it in as a still introductory frame');
      expect(prompt).toContain('No decorative sparkles, glints, star stickers');
    }
    expect(prompts.dishSoapVoice).not.toBe(prompts.lampVoice);
    for (const prompt of [prompts.dishSoapVoice, prompts.lampVoice, prompts.lampMotion]) {
      expect(prompt).toContain('If the image and customer-confirmed facts do not establish a claim, omit it entirely');
      expect(prompt).toContain('Never invent a special formula, ingredients, certifications, medical outcomes');
      expect(prompt).toContain('approximately 12.5 to 14 seconds');
      expect(prompt).not.toContain('before second 11');
    }
    expect(prompts.lampMotion).toContain('[V8 SMART SCRIPT CONTROL]');
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
    }
  });
});
