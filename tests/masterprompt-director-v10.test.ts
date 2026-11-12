import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DynamicPromptCompiler, GEMS_PROMPT_VERSION, HUMAN_REALISM_MASTERPROMPT_V8 } from '../src/lib/engine/compiler';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { getVideoStyle, VIDEO_STYLES_REGISTRY } from '../src/lib/styles/registry';
import { sanitizePersonalizationSettings } from '../src/lib/personalization/config';
import { NexabotAdapter } from '../src/lib/providers/nexabot';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const product: ProductProfile = { name:'the uploaded product image', category:'product shown', packagingFormat:'general', spokenShortName:'produk ini', confirmedFeatures:[], prohibitedClaims:['invented claims'], unknownFields:['ingredients'], sourceConfidence:'manual_fallback', provenance:'manual_user_entry', isVisionSupported:false };
const scene: ScenePlan = { mainSubject:product.name, location:'ordinary Malaysian setting', lighting:'neutral daylight', cameraDistance:'smartphone 1x', cameraMovement:'single continuous take', startPose:'natural', actionProgression:'style-specific action', endPose:'natural', primaryAction:'style-specific action', audioPolicy:'spoken_bm', targetDurationSeconds:15 };

describe('V10 Pawarna Masterprompt Director', () => {
  it('preserves exactly 20 published Nexabot 15-second styles', () => {
    expect(VIDEO_STYLES_REGISTRY).toHaveLength(20);
    expect(VIDEO_STYLES_REGISTRY.every((style) => style.engine === 'nexabot' && style.durationSeconds === 15 && style.publicationStatus === 'published')).toBe(true);
  });

  it('compiles 20 independent provider-owned masterprompts with all hard locks', () => {
    const prompts = VIDEO_STYLES_REGISTRY.map((style) => {
      const compiled = DynamicPromptCompiler.compile(product, style, { ...scene, audioPolicy:style.audioMode });
      expect(compiled.promptVersion).toBe(GEMS_PROMPT_VERSION);
      expect(compiled.spokenScript, style.id).toBeUndefined();
      expect(compiled.providerPrompt, style.id).toContain('[PAWARNA MASTERPROMPT DIRECTOR V10 — PRIORITY SYSTEM]');
      expect(compiled.providerPrompt, style.id).toContain('[NEXABOT NATIVE PRODUCT UNDERSTANDING — PROVIDER OWNS CREATIVE THINKING]');
      expect(compiled.providerPrompt, style.id).toContain(`[STYLE ${style.id} —`);
      expect(compiled.providerPrompt, style.id).toContain('[PRODUCT IDENTITY MAX LOCK]');
      expect(compiled.providerPrompt, style.id).toContain('[ZERO UI & WATERMARK LOCK]');
      expect(compiled.providerPrompt, style.id).toContain('[HUMAN REALISM MASTERPROMPT V8]');
      expect(compiled.providerPrompt, style.id).toContain('[SHARIAH MODESTY LOCK');
      expect(compiled.providerPrompt, style.id).toContain('[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]');
      expect(compiled.providerPrompt, style.id).not.toMatch(/Script: ""|\$\{p\.spokenScript\}|\{script_body\}|V8 SMART SCRIPT CONTROL/i);
      return compiled.providerPrompt;
    });
    expect(new Set(prompts).size).toBe(20);
  });

  it('ignores legacy script inputs and rejects the former generic fallback', () => {
    const marker = 'MUST_NOT_REACH_PROVIDER';
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene, { scriptMode:'custom', scriptVariant:'story', customScript:marker });
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).not.toContain(marker);
    expect(compiled.providerPrompt).not.toContain('kalau memang tengah survey produk ini, tengok yang ni dulu');
    expect(compiled.providerPrompt).toContain('never use a generic placeholder');
  });

  it('normalizes historical personalization script settings to inert values', () => {
    expect(sanitizePersonalizationSettings({scriptMode:'custom',scriptVariant:'story',customScript:'JANGAN HANTAR'})).toMatchObject({scriptMode:'provider_auto',scriptVariant:'style',customScript:''});
  });

  it('preserves customer creative direction and CTA target without accepting a script', () => {
    const compiled=DynamicPromptCompiler.compile(product,getVideoStyle('NX14')!,scene,{customScript:'JANGAN HANTAR',creativeInstruction:'Gunakan suasana meja belajar yang tenang.',callToAction:'custom',customCta:'DM untuk info lanjut.'});
    expect(compiled.providerPrompt).not.toContain('JANGAN HANTAR');
    expect(compiled.providerPrompt).toContain('Gunakan suasana meja belajar yang tenang.');
    expect(compiled.providerPrompt.match(/DM untuk info lanjut\./g)).toHaveLength(1);
  });

  it('sends full prompt and duplicated identity references without making them the first frame', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene);
    const payload = new NexabotAdapter({ apiKey:'test-key' }).preparePayload({ jobId:'job', idempotencyKey:'idem', workspaceId:'workspace', prompt:compiled.providerPrompt, durationSeconds:15, aspectRatio:'9:16', mainImageKeyOrUrl:image }) as {mode:string;prompt:string;media:string[]};
    expect(payload.mode).toBe('i2v');
    expect(payload.prompt).toBe(compiled.providerPrompt);
    expect(payload.media).toEqual([image,image]);
    expect(payload.prompt).toContain('Reference images 1 and 2 are intentionally IDENTICAL');
    expect(payload.prompt).toContain('never a mandatory first frame');
  });

  it('keeps product realism and has no production import of the historical scriptwriter', () => {
    expect(HUMAN_REALISM_MASTERPROMPT_V8).toContain('Creator review:');
    const profile=AICreativeDirector.extractProductProfile({productName:'Lampu Nova',productCategory:'Lampu'});
    const compiled=DynamicPromptCompiler.compile(profile,getVideoStyle('NX01')!,AICreativeDirector.createScenePlan(profile,getVideoStyle('NX01')!));
    expect(compiled.providerPrompt).toContain('[PLAUSIBLE PRODUCT SCALE LOCK]');
    expect(readFileSync('src/lib/engine/compiler.ts','utf8')).not.toContain("from './script-control'");
    expect(readFileSync('src/lib/personalization/config.ts','utf8')).not.toContain('engine/script-control');
  });

  it('refuses to save JSON error responses as MP4 downloads', () => {
    const helper=readFileSync('src/lib/download/client-download.ts','utf8');
    const library=readFileSync('src/app/(dashboard)/library/page.tsx','utf8');
    expect(helper).toContain("contentType.startsWith('video/mp4')");
    expect(helper).toContain("contentType.includes('application/json')");
    expect(helper).toContain('blob.size < 1024');
    expect(library).toContain('downloadPrivateMp4');
  });
});
