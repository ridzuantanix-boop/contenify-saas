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

  it('compiles 30 distinct compact style configurations with universal locks', () => {
    const prompts = VIDEO_STYLES_REGISTRY.map((style) => {
      const compiled = DynamicPromptCompiler.compile(product, style, { ...scene, audioPolicy:style.audioMode });
      expect(compiled.promptVersion).toBe(GEMS_PROMPT_VERSION);
      expect(GEMS_PROMPT_VERSION).toBe('affimatik-real-v3-creative-freedom-no-fake-self-use');
      expect(compiled.spokenScript, style.id).toBeUndefined();
      expect(compiled.providerPrompt, style.id).toContain('[REAL V3 COMPACT GLOBAL CONTRACT]');
      expect(compiled.providerPrompt, style.id).toContain('[NEXABOT NATIVE PRODUCT INTERPRETATION]');
      expect(compiled.providerPrompt, style.id).toContain(`[STYLE ${style.id} — PREDEFINED CONFIGURATION]`);
      expect(compiled.providerPrompt, style.id).toContain('[PRODUCT IDENTITY LOCK]');
      expect(compiled.providerPrompt, style.id).toContain('[PRODUCT SCALE LOCK]');
      expect(compiled.providerPrompt, style.id).toContain('about 8–12% of full frame height');
      expect(compiled.providerPrompt, style.id).toContain('larger products retain their plausible real dimensions');
      expect(compiled.providerPrompt, style.id).not.toMatch(/20\s*(?:%|percent)?\s*(?:–|-|to)\s*30%/i);
      expect(compiled.providerPrompt, style.id).toContain('[CLEAN VIDEO LOCK]');
      expect(compiled.providerPrompt, style.id).toContain('[REALISTIC HUMAN AND PRODUCT PHYSICS]');
      expect(compiled.providerPrompt, style.id).toContain('[SHARIAH MODESTY LOCK');
      expect(compiled.providerPrompt, style.id).toContain('[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]');
      expect(compiled.providerPrompt, style.id).toContain('[PAWARNA CREATIVE DNA]');
      expect(compiled.providerPrompt, style.id).toContain('[TRUE-WHITE REAL PHONE COLOUR]');
      expect(compiled.providerPrompt, style.id).toContain('[NATURAL MALAYSIAN VOICE]');
      expect(compiled.providerPrompt, style.id).toContain('[NO FAKE SELF-USE TESTIMONIAL — STRICT]');
      expect(compiled.providerPrompt, style.id).toContain('Nexabot retains broad freedom to create product-relevant hooks, storytelling, selling angles, subjective enthusiasm and FOMO');
      expect(compiled.providerPrompt, style.id).toContain('Ordinary product handling, wearing, styling or demonstration is allowed');
      expect(compiled.providerPrompt.match(/\[PRODUCT SCALE LOCK\]/g), style.id).toHaveLength(1);
      expect(compiled.providerPrompt.match(/\[UNSEEN PRODUCT CONTENTS LOCK\]/g), style.id).toHaveLength(1);
      expect(compiled.providerPrompt, style.id).not.toMatch(/Script: ""|\$\{p\.spokenScript\}|\{script_body\}|V8 SMART SCRIPT CONTROL/i);
      expect(compiled.providerPrompt, style.id).not.toMatch(/ordinary buyer benefit|supported buyer benefit|supported FOMO|mandatory benefit/i);
      return compiled.providerPrompt;
    });
    expect(new Set(prompts).size).toBe(30);
    // REAL V2's measured average was 24,828 characters; retain the actual compact-architecture improvement.
    expect(prompts.reduce((sum, prompt) => sum + prompt.length, 0) / prompts.length).toBeLessThan(24_828);
  });

  it('ignores legacy scripts while preserving customer direction and the selected CTA', () => {
    const marker = 'MUST_NOT_REACH_PROVIDER';
    const directive = 'Gunakan suasana meja belajar yang tenang.';
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX14')!, scene, { scriptMode:'custom', customScript:marker, creativeInstruction:directive, callToAction:'custom', customCta:'DM untuk info lanjut.' });
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).not.toContain(marker);
    expect(compiled.providerPrompt.match(/Gunakan suasana meja belajar yang tenang\./g)).toHaveLength(1);
    expect(compiled.providerPrompt).toContain('Customer Creative Directive (verbatim)');
    expect(compiled.providerPrompt.match(/DM untuk info lanjut\./g)).toHaveLength(1);
    expect(compiled.providerPrompt).toContain('Speak it naturally once as the final utterance, fully before the cut');
  });

  it('gives Nexabot sole ownership of hooks, dialogue and selling approach', () => {
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('Nexabot alone creates the product-specific hook, story, dialogue, selling angle, FOMO');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('AffiMatik supplies no script, benefit sentence, FOMO sentence, hook wording or per-product creative prompt');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('Never fabricate the presenter’s personal use, testing, consumption or personal result');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('12.5–13 seconds');
    expect(NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10).toContain('not rush or start a sentence that cannot finish');
    const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('NX02')!, scene).providerPrompt;
    expect(prompt.indexOf('[REAL V3 NATIVE SPEECH CONTRACT]')).toBeLessThan(prompt.indexOf('[STYLE NX02'));
    expect(prompt).toContain('Nexabot independently creates the NX02 hook, dialogue, selling approach and visual actions');
  });

  it('normalizes historical personalization script settings to inert values', () => {
    expect(sanitizePersonalizationSettings({scriptMode:'custom',scriptVariant:'story',customScript:'JANGAN HANTAR'})).toMatchObject({scriptMode:'provider_auto',scriptVariant:'style',customScript:''});
  });

  it('separates customer metadata from verified facts without making AffiMatik the creative writer', () => {
    const grounded: ProductProfile = { ...product, name:'POTONGGO Manual Chopper', category:'manual kitchen chopper', observedPhysicalFacts:['clear container with turquoise lid and visible internal blades'], confirmedFeatures:['customer confirms the pull handle is manually operated'], unknownFields:['capacity','blade material'] };
    const prompt=DynamicPromptCompiler.compile(grounded,getVideoStyle('NX17')!,scene).providerPrompt;
    expect(prompt).toContain('[PRODUCT FACT BOUNDARY]');
    expect(prompt).toContain('Category identifies ordinary function only and proves no result or quality');
    expect(prompt).toContain('Customer-supplied visible facts:');
    expect(prompt).toContain('Explicit customer facts:');
    expect(prompt).toContain('They are context, not prewritten dialogue');
    expect(prompt).toContain('Unverified customer metadata:');
    expect(prompt).toContain('Do not present it as customer-confirmed fact or verified research');
    expect(prompt).toContain('AffiMatik does not preselect benefits or promotional claims');
    expect(prompt).toContain('[NO FAKE SELF-USE TESTIMONIAL — STRICT]');
    expect(prompt).not.toContain('When evidence is limited, use visible characteristics or ordinary category function—not an inferred benefit');
  });

  it('uses duplicate product identity references without treating them as start frames', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene);
    const payload = new NexabotAdapter({ apiKey:'test-key' }).preparePayload({ jobId:'job', idempotencyKey:'idem', workspaceId:'workspace', prompt:compiled.providerPrompt, durationSeconds:15, aspectRatio:'9:16', mainImageKeyOrUrl:image }) as {mode:string;prompt:string;media:string[]};
    expect(payload.mode).toBe('i2v');
    expect(payload.prompt).toBe(compiled.providerPrompt);
    expect(payload.media).toEqual([image,image]);
    expect(payload.prompt).toContain('References 1 and 2 are byte-identical views of one product identity');
    expect(payload.prompt).toContain('References are not start frames or composition templates');
    expect(payload.prompt).toContain('ignore screenshot UI');
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

  it('produces exactly one non-contradictory effective audio mode', () => {
    const spoken = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene, { audioTreatment:'asmr' }).providerPrompt;
    expect(spoken).toContain('Effective audio mode: SPOKEN PRESENTER');
    expect(spoken).not.toContain('Effective audio mode: ASMR');
    for (const mode of ['ambient','asmr'] as const) {
      const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('RH03')!, scene, { audioTreatment:mode }).providerPrompt;
      expect(prompt).toContain(`Effective audio mode: ${mode.toUpperCase()}`);
      expect(prompt.match(/Effective audio mode:/g)).toHaveLength(1);
      expect(prompt).not.toContain('[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]');
      expect(prompt).toContain('Absolutely no spoken words, voiceover, narration, lip-sync or music');
    }
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
