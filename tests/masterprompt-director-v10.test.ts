import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DynamicPromptCompiler, GEMS_PROMPT_VERSION, HUMAN_REALISM_MASTERPROMPT_V8, NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10 } from '../src/lib/engine/compiler';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { getVideoStyle, VIDEO_STYLES_REGISTRY } from '../src/lib/styles/registry';
import { sanitizePersonalizationSettings } from '../src/lib/personalization/config';
import { NexabotAdapter } from '../src/lib/providers/nexabot';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';
import { PAWARNA_STYLE_CREATIVE_APPLICATIONS, STYLE_DIRECTORS } from '../src/lib/engine/style-directors';

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
      expect(compiled.providerPrompt, style.id).toMatch(/^\[1\. CRITICAL PRODUCTION CONTRACT\]/);
      expect(compiled.providerPrompt, style.id).toContain('[PAWARNA CREATIVE DNA — TEST A OWNER GOLD STANDARD]');
      expect(compiled.providerPrompt, style.id).toContain('approximately 45–55 spoken Malay words as an initial creative pacing target, not an inflexible limit');
      expect(compiled.providerPrompt, style.id).toContain('Pawarna Creative DNA application:');
      expect(compiled.providerPrompt, style.id).not.toContain('second 11.5');
      expect(compiled.providerPrompt, style.id).toContain('Never invent ingredients, efficacy, medical outcomes, certification, price, popularity, review counts, testimonials, discounts or personal experience');
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
    expect(compiled.providerPrompt).toContain('rather than a generic category description or placeholder');
  });

  it('front-loads the provider-owned speech contract without hardcoding dialogue', () => {
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('Nexabot independently writes the dialogue');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('45–55 spoken Malay words');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('supported FOMO only when evidence exists');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('Preserve persuasive energy and natural imperfection');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).not.toContain('two, or at most three');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).not.toContain('second 11.5');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).not.toMatch(/[“”"](?:korang|saya|aku|produk)/i);
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX02')!, scene);
    expect(compiled.providerPrompt.indexOf('[PAWARNA 15-SECOND SPOKEN OUTPUT CONTRACT')).toBeLessThan(compiled.providerPrompt.indexOf('[STYLE NX02'));
  });

  it('normalizes historical personalization script settings to inert values', () => {
    expect(sanitizePersonalizationSettings({scriptMode:'custom',scriptVariant:'story',customScript:'JANGAN HANTAR'})).toMatchObject({scriptMode:'provider_auto',scriptVariant:'style',customScript:''});
  });

  it('preserves customer creative direction and CTA target without accepting a script', () => {
    const compiled=DynamicPromptCompiler.compile(product,getVideoStyle('NX14')!,scene,{customScript:'JANGAN HANTAR',creativeInstruction:'Gunakan suasana meja belajar yang tenang.',callToAction:'custom',customCta:'DM untuk info lanjut.'});
    expect(compiled.providerPrompt).not.toContain('JANGAN HANTAR');
    expect(compiled.providerPrompt).toContain('Gunakan suasana meja belajar yang tenang.');
    expect(compiled.providerPrompt.match(/DM untuk info lanjut\./g)).toHaveLength(1);
    expect(compiled.providerPrompt).toContain('This CTA is the final spoken utterance');
    expect(compiled.providerPrompt).toContain('add no new word, syllable, phoneme');
  });

  it('separates image identity, category, physical observations, customer facts and unsupported claims', () => {
    const grounded: ProductProfile = {
      ...product,
      name:'POTONGGO Manual Chopper',
      category:'manual kitchen chopper',
      observedPhysicalFacts:['clear container with turquoise lid and visible internal blades'],
      confirmedFeatures:['customer confirms the pull handle is manually operated'],
      unknownFields:['capacity','blade material'],
    };
    const prompt=DynamicPromptCompiler.compile(grounded,getVideoStyle('NX17')!,scene,{callToAction:'custom',customCta:'Tekan butang di bawah.'}).providerPrompt;
    expect(prompt).toContain('[PRODUCT EVIDENCE CONTRACT — KEEP SOURCES SEPARATE]');
    expect(prompt).toContain('A category never proves efficacy, suitability, quality or a buyer outcome');
    expect(prompt).toContain('Image-observable physical facts:');
    expect(prompt).toContain('Customer-confirmed facts:');
    expect(prompt).toContain('Treat them as factual context only, never as prewritten dialogue');
    expect(prompt).toContain('Unsupported or unresolved claims:');
    expect(prompt).not.toContain('customer confirms the pull handle is manually operated” as dialogue');
  });

  it('sends full prompt and duplicated identity references without making them the first frame', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene);
    const payload = new NexabotAdapter({ apiKey:'test-key' }).preparePayload({ jobId:'job', idempotencyKey:'idem', workspaceId:'workspace', prompt:compiled.providerPrompt, durationSeconds:15, aspectRatio:'9:16', mainImageKeyOrUrl:image }) as {mode:string;prompt:string;media:string[]};
    expect(payload.mode).toBe('i2v');
    expect(payload.prompt).toBe(compiled.providerPrompt);
    expect(payload.media).toEqual([image,image]);
    expect(payload.prompt).toContain('Reference images 1 and 2 are intentionally IDENTICAL');
    expect(payload.prompt).toContain('neither may become the first video frame');
    expect(payload.prompt).toContain('exclude its source composition');
    expect(payload.prompt).toContain('do not copy the original surface, decorative props, lighting pattern');
  });

  it('has one complete authoritative director specification for every official style', () => {
    expect(Object.keys(STYLE_DIRECTORS).sort()).toEqual(VIDEO_STYLES_REGISTRY.map((style) => style.id).sort());
    expect(Object.keys(PAWARNA_STYLE_CREATIVE_APPLICATIONS).sort()).toEqual(VIDEO_STYLES_REGISTRY.map((style) => style.id).sort());
    for (const style of VIDEO_STYLES_REGISTRY) {
      const director = STYLE_DIRECTORS[style.id];
      for (const field of ['concept','audienceExperience','openingVisual','shotComposition','sceneSelection','productInteraction','presenterVisibility','humanPerformance','voiceOrAudio','storytellingObjective','relevantProductInformation','naturalEnding'] as const) {
        expect(director[field].length, `${style.id}.${field}`).toBeGreaterThan(20);
      }
      expect(director.hardFailures.length, style.id).toBeGreaterThanOrEqual(4);
      expect(PAWARNA_STYLE_CREATIVE_APPLICATIONS[style.id].length, `${style.id}.pawarnaCreativeDna`).toBeGreaterThan(80);
      const compiled = DynamicPromptCompiler.compile(product, style, { ...scene, audioPolicy:style.audioMode });
      expect(compiled.providerPrompt, style.id).toContain(`Pawarna Creative DNA application: ${PAWARNA_STYLE_CREATIVE_APPLICATIONS[style.id]}`);
    }
    const compilerSource = readFileSync('src/lib/engine/compiler.ts','utf8');
    expect(compilerSource).not.toContain('AUTHORITATIVE_STYLE_MASTERPROMPTS');
    expect(compilerSource).not.toMatch(/for\s*\([^)]*VIDEO_STYLES_REGISTRY[^)]*\)\s*\{/);
  });

  it('removes the V10.2 restrictions that flattened Test B while preserving factual safety', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX09')!, scene, { callToAction:'tiktok_shop' }).providerPrompt;
    expect(compiled).toContain('energetic, spontaneous off-camera Malaysian affiliate Malay');
    expect(compiled).toContain('meaningful speech across most of the 15-second clip');
    expect(compiled).toContain('Natural benefit-oriented storytelling is allowed');
    expect(compiled).toContain('supported FOMO only when evidence exists');
    expect(compiled).not.toContain('two, or at most three, short clauses');
    expect(compiled).not.toContain('one compact spoken turn');
    expect(compiled).not.toContain('Finish every spoken word by second 11.5');
    expect(compiled).not.toContain('finish speech early');
    expect(compiled).not.toContain('Default is calm off-camera');
    expect(compiled).toContain('Never invent ingredients, efficacy, medical outcomes, certification, price, popularity, review counts, testimonials, discounts or personal experience');
    expect(compiled).toContain('After its last word, generate no additional word, syllable, phoneme');
  });

  it('does not force an ungrounded kitchen, desk, bedroom or domestic fallback', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene);
    expect(compiled.providerPrompt).not.toContain('dapur atau ruang santai');
    expect(compiled.providerPrompt).not.toContain('ordinary domestic context');
    expect(compiled.providerPrompt).toContain('No customer-confirmed usage context was supplied');
    expect(compiled.providerPrompt).toContain('without assuming a kitchen, desk, bedroom, bathroom');
    const profile = AICreativeDirector.extractProductProfile({ productName:'Produk Tidak Dikenali' });
    expect(profile.usageContext).toBeUndefined();
    expect(profile.coreFunction).toBeUndefined();
    expect(profile.buyerProblem).toBeUndefined();
    expect(profile.verifiedBenefits).toEqual([]);
    const planned = AICreativeDirector.createScenePlan(profile, getVideoStyle('NX01')!);
    expect(planned.location).toContain('jangan andaikan dapur, meja kerja, bilik tidur, bilik air atau vanity tanpa bukti');
  });

  it('produces exactly one non-contradictory effective audio mode in final payloads', () => {
    const spoken = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene, { audioTreatment:'asmr' }).providerPrompt;
    expect(spoken).toContain('Effective audio mode: SPOKEN PRESENTER');
    expect(spoken).not.toContain('Effective audio mode: ASMR');

    for (const mode of ['ambient','asmr'] as const) {
      const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('RH03')!, scene, { audioTreatment:mode }).providerPrompt;
      expect(prompt).toContain(`Effective audio mode: ${mode.toUpperCase()}`);
      expect(prompt).not.toContain('[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]');
      expect(prompt).not.toContain('[PRIORITY 0 SPOKEN OUTPUT CONTRACT');
      expect(prompt).not.toContain('Effective audio mode: OFF-CAMERA VOICEOVER');
      expect(prompt).toContain('Absolutely no spoken words, voiceover, narration, lip-sync or music');
    }
  });

  it('keeps the requested seven-section payload order', () => {
    const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('NX17')!, scene).providerPrompt;
    const sections = [
      '[1. CRITICAL PRODUCTION CONTRACT]',
      '[2. SELECTED STYLE FULL CREATIVE DIRECTION]',
      '[3. PRODUCT UNDERSTANDING AND CONTEXT]',
      '[4. HUMAN PERFORMANCE AND SCENE BEHAVIOUR]',
      '[5. VOICE OR AUDIO DIRECTION]',
      '[6. NECESSARY SAFETY AND VISUAL LOCKS]',
      '[7. ENDING REQUIREMENTS]',
    ];
    const positions = sections.map((section) => prompt.indexOf(section));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a,b) => a-b));
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
