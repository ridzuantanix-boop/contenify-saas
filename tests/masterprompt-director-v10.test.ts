import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DynamicPromptCompiler, GEMS_PROMPT_VERSION, NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10 } from '../src/lib/engine/compiler';
import { getVideoStyle, VIDEO_STYLES_REGISTRY } from '../src/lib/styles/registry';
import { sanitizePersonalizationSettings } from '../src/lib/personalization/config';
import { NexabotAdapter } from '../src/lib/providers/nexabot';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';
import { PAWARNA_STYLE_CREATIVE_APPLICATIONS, STYLE_DIRECTORS } from '../src/lib/engine/style-directors';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const product: ProductProfile = { name:'the uploaded product image', category:'product shown', packagingFormat:'general', spokenShortName:'produk ini', confirmedFeatures:[], prohibitedClaims:['invented claims'], unknownFields:['ingredients'], sourceConfidence:'manual_fallback', provenance:'manual_user_entry', isVisionSupported:false };
const scene: ScenePlan = { mainSubject:product.name, location:'ordinary Malaysian setting', lighting:'neutral daylight', cameraDistance:'smartphone 1x', cameraMovement:'single continuous take', startPose:'natural', actionProgression:'style-specific action', endPose:'natural', primaryAction:'style-specific action', audioPolicy:'spoken_bm', targetDurationSeconds:15 };

describe('REAL V3 Nexabot creative autonomy', () => {
  it('preserves all 30 published Nexabot styles', () => {
    expect(VIDEO_STYLES_REGISTRY).toHaveLength(30);
    expect(VIDEO_STYLES_REGISTRY.every((style) => style.engine === 'nexabot' && style.durationSeconds === 15 && style.publicationStatus === 'published')).toBe(true);
  });

  it('compiles 30 distinct prompts under the provider limit with essential locks', () => {
    const prompts = VIDEO_STYLES_REGISTRY.map(style => {
      const compiled = DynamicPromptCompiler.compile(product, style, scene, {callToAction:'tiktok_shop'});
      expect(compiled.promptVersion).toBe(GEMS_PROMPT_VERSION);
      expect(compiled.spokenScript).toBeUndefined();
      expect(compiled.preflightValid, style.id).toBe(true);
      expect(compiled.providerPrompt.length, style.id).toBeLessThanOrEqual(1000);
      expect(compiled.providerPrompt).toContain(`[${style.id}]`);
      expect(compiled.providerPrompt).toContain('Nexabot writes hook, story and speech');
      expect(compiled.providerPrompt).toContain('8-12% frame, max 15%');
      expect(compiled.providerPrompt).toContain('unseen contents closed');
      expect(compiled.providerPrompt).toContain('No invented benefits/results or fake self-use');
      expect(compiled.providerPrompt).toContain('Neutral daylight, true whites');
      expect(compiled.providerPrompt).toContain('Final CTA once');
      return compiled.providerPrompt;
    });
    expect(new Set(prompts).size).toBe(30);
  });

  it('ignores legacy scripts while preserving customer direction and CTA', () => {
    const directive = 'Gunakan suasana meja belajar yang tenang.';
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX14')!, scene, {scriptMode:'custom',customScript:'MUST_NOT_REACH_PROVIDER',creativeInstruction:directive,callToAction:'custom',customCta:'DM untuk info lanjut.'});
    expect(compiled.preflightValid).toBe(true);
    expect(compiled.providerPrompt).not.toContain('MUST_NOT_REACH_PROVIDER');
    expect(compiled.providerPrompt).toContain(`Customer direction (verbatim): ${directive}`);
    expect(compiled.providerPrompt.match(/DM untuk info lanjut\./g)).toHaveLength(1);
    expect(compiled.providerPrompt.length).toBeLessThanOrEqual(1000);
  });

  it('gives Nexabot sole ownership of hooks and dialogue', () => {
    const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('NX02')!, scene).providerPrompt;
    expect(prompt).toContain('Nexabot writes hook, story and speech');
    expect(prompt).not.toContain('Script:');
  });

  it('normalizes historical personalization script settings to inert values', () => {
    expect(sanitizePersonalizationSettings({scriptMode:'custom',scriptVariant:'story',customScript:'JANGAN HANTAR'})).toMatchObject({scriptMode:'provider_auto',scriptVariant:'style',customScript:''});
  });

  it('passes customer facts as context without writing dialogue', () => {
    const grounded: ProductProfile = {...product,name:'POTONGGO Manual Chopper',observedPhysicalFacts:['clear container'],confirmedFeatures:['manual pull handle']};
    const compiled = DynamicPromptCompiler.compile(grounded,getVideoStyle('NX17')!,scene);
    expect(compiled.preflightValid).toBe(true);
    expect(compiled.providerPrompt).toContain('Visible: clear container.');
    expect(compiled.providerPrompt).toContain('Confirmed: manual pull handle.');
    expect(compiled.providerPrompt).not.toContain('Script:');
  });

  it('sends the product twice as identity references', () => {
    const compiled = DynamicPromptCompiler.compile(product,getVideoStyle('NX01')!,scene);
    const payload = new NexabotAdapter({apiKey:'test-key'}).preparePayload({jobId:'job',idempotencyKey:'idem',workspaceId:'workspace',prompt:compiled.providerPrompt,durationSeconds:15,aspectRatio:'9:16',mainImageKeyOrUrl:image}) as {mode:string;prompt:string;media:string[]};
    expect(payload.mode).toBe('i2v');
    expect(payload.media).toEqual([image,image]);
    expect(payload.prompt).toContain('Refs 1&2 same product');
    expect(payload.prompt).toContain('not start frames');
  });

  it('keeps one source specification per style and excludes legacy creative prose from active prompts', () => {
    expect(Object.keys(STYLE_DIRECTORS).sort()).toEqual(VIDEO_STYLES_REGISTRY.map((style) => style.id).sort());
    for (const style of VIDEO_STYLES_REGISTRY) {
      const director = STYLE_DIRECTORS[style.id];
      expect(director.concept.length, style.id).toBeGreaterThan(20);
      expect(director.hardFailures.length, style.id).toBeGreaterThanOrEqual(4);
      const compiled = DynamicPromptCompiler.compile(product, style, { ...scene, audioPolicy:style.audioMode });
      expect(compiled.providerPrompt, style.id).not.toContain(PAWARNA_STYLE_CREATIVE_APPLICATIONS[style.id]);
    }
    expect(readFileSync('src/lib/engine/compiler.ts','utf8')).not.toContain('AUTHORITATIVE_STYLE_MASTERPROMPTS');
  });

  it('uses one non-contradictory effective audio mode', () => {
    const spoken = DynamicPromptCompiler.compile(product,getVideoStyle('NX01')!,scene,{audioTreatment:'asmr'}).providerPrompt;
    expect(spoken).toContain('Lively BM Malaysia presenter');
    expect(spoken).not.toContain('Only synchronized handling ASMR');
    const asmr = DynamicPromptCompiler.compile(product,getVideoStyle('RH03')!,scene,{audioTreatment:'asmr'}).providerPrompt;
    expect(asmr).toContain('Only natural handling ASMR; no speech');
    expect(asmr).not.toContain('Final spoken CTA');
  });

  it('keeps active job creation free of vision AI and scriptwriter calls', () => {
    const compiler = readFileSync('src/lib/engine/compiler.ts','utf8');
    const jobRoute = readFileSync('src/app/api/jobs/route.ts','utf8');
    expect(compiler).not.toContain("from './script-control'");
    for (const forbidden of ['analyzeProductImage(', 'generateScript(', 'resolveSpokenScript(', 'createEvidencePacket(']) expect(jobRoute).not.toContain(forbidden);
  });

  it('refuses to save JSON error responses as MP4 downloads', () => {
    const helper=readFileSync('src/lib/download/client-download.ts','utf8');
    expect(helper).toContain("contentType.startsWith('video/mp4')");
    expect(helper).toContain("contentType.includes('application/json')");
    expect(helper).toContain('blob.size < 1024');
  });
});
