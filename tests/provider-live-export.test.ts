import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle } from '../src/lib/styles/registry';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function compileFor(name: string, styleId: string) {
  const style = getVideoStyle(styleId)!;
  const product: ProductProfile = {
    name, category: 'product shown in uploaded image', packagingFormat: 'general', spokenShortName: 'produk ini',
    coreFunction: 'only the purpose supported by the reference image', usageContext: 'ordinary Malaysian use inferred cautiously from the image',
    buyerProblem: 'a grounded problem relevant to the actual product', allowedQaQuestion: 'what this product is actually for',
    confirmedFeatures: [], prohibitedClaims: ['invented ingredients','certifications','medical outcomes','prices','testimonials'],
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
      expect(prompt).toContain('If the image and optional user notes do not establish a fact, omit the claim entirely');
      expect(prompt).toContain('Never invent a special formula, ingredients, certifications, medical outcomes');
      expect(prompt).toContain('Keep these factual checks internal');
      expect(prompt).toContain('before second 11.5');
    }
    expect(prompts.lampMotion).toContain('[PROVIDER-CREATED DIALOGUE');
    if (process.env.AFFIMATIK_QA_EXPORT === '1') {
      const directory = resolve(process.cwd(), 'output', 'provider-qa');
      mkdirSync(directory, { recursive: true });
      writeFileSync(resolve(directory, 'prompts.json'), JSON.stringify(prompts, null, 2));
      const styleSamples = Object.fromEntries(
        ['NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10', 'RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19', 'NX11', 'NX12', 'NX13', 'NX14', 'NX15', 'NX16', 'NX17']
          .map((id) => [id, compileFor('NOVA LAMP', id)])
      );
      writeFileSync(resolve(directory, 'style-sample-prompts.json'), JSON.stringify(styleSamples, null, 2));
      const health = ['NX17'];
      const food = ['NX02', 'NX10', 'RH04', 'NX11', 'NX13'];
      const manifest = Object.keys(styleSamples).map((styleId) => {
        const isHealth = health.includes(styleId);
        const isFood = food.includes(styleId);
        const productName = isHealth ? 'Del Venus Supa Omega-3' : isFood ? 'Nestle Milo Malt Chocolate Drink' : 'Portable Touch Lamp';
        const imagePath = isHealth
          ? 'output/release/journey-ui/health-omega3.png'
          : isFood
            ? 'output/release/smoke-test/milo-product.png'
            : 'output/release/journey-ui/home-portable-lamp.jpg';
        return { styleId, productName, imagePath, prompt: compileFor(productName, styleId) };
      });
      writeFileSync(resolve(directory, 'v6-sample-manifest.json'), JSON.stringify(manifest, null, 2));
    }
  });
});
