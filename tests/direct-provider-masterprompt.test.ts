import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle, VIDEO_STYLES_REGISTRY } from '../src/lib/styles/registry';
import { NexabotAdapter } from '../src/lib/providers/nexabot';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const product: ProductProfile = {
  name: 'the uploaded product image',
  category: 'the product shown in the reference image',
  packagingFormat: 'general',
  spokenShortName: 'produk ini',
  coreFunction: 'the actual purpose supported by the image only',
  usageContext: 'a cautious ordinary context inferred from the image',
  buyerProblem: 'a buyer problem grounded in visible evidence only',
  allowedQaQuestion: 'what this product is actually for, if supported',
  confirmedFeatures: [],
  prohibitedClaims: ['invented ingredients', 'medical outcomes', 'prices', 'testimonials'],
  unknownFields: ['ingredients', 'certifications', 'medical outcomes'],
  sourceConfidence: 'manual_fallback',
  provenance: 'manual_user_entry',
  isVisionSupported: false,
};

const scene: ScenePlan = {
  mainSubject: product.name,
  location: 'ordinary Malaysian setting chosen by provider',
  lighting: 'neutral daylight',
  cameraDistance: 'smartphone 1x',
  cameraMovement: 'single continuous take',
  startPose: 'natural start',
  actionProgression: 'style-specific action',
  endPose: 'natural end',
  primaryAction: 'style-specific action',
  audioPolicy: 'spoken_bm',
  targetDurationSeconds: 15,
};

describe('V8 direct-to-provider masterprompt architecture', () => {
  it('compiles all 20 distinct Smart Script prompts with human realism locks', () => {
    const prompts = VIDEO_STYLES_REGISTRY.map((style) => {
      const compiled = DynamicPromptCompiler.compile(product, style, {
        ...scene,
        audioPolicy: style.audioMode,
        targetDurationSeconds: style.durationSeconds,
      });
      expect(compiled.preflightValid, style.id).toBe(true);
      expect(compiled.providerPrompt, style.id).toContain('[PRODUCT IDENTITY MAX LOCK]');
      expect(compiled.providerPrompt, style.id).toContain('[ZERO UI & WATERMARK LOCK]');
      expect(compiled.providerPrompt, style.id).toContain('[REALISTIC UGC PROFILE]');
      expect(compiled.providerPrompt, style.id).toContain('[HUMAN REALISM MASTERPROMPT V8]');
      expect(compiled.providerPrompt, style.id).toContain('[SHARIAH MODESTY LOCK');
      expect(compiled.providerPrompt, style.id).not.toMatch(/Script: ""|\$\{p\.spokenScript\}|\{script_body\}/i);
      expect(style.engine, style.id).toBe('nexabot');
      expect(compiled.providerPrompt, style.id).toContain('[V8 SMART SCRIPT CONTROL]');
      expect(compiled.providerPrompt, style.id).toContain('approximately 12.5 to 14 seconds');
      expect(compiled.providerPrompt, style.id).not.toContain('before second 11');
      expect(compiled.providerPrompt, style.id).toContain('Never repeat or semantically paraphrase');
      expect(compiled.providerPrompt, style.id).not.toContain('exactly TWO short spoken sentences');
      expect(compiled.providerPrompt, style.id).not.toContain('16-22 words');
      expect(compiled.providerPrompt, style.id).toContain('Omni-Flash provider watermark is permitted');
      expect(compiled.providerPrompt, style.id).toContain('Never invent a special formula');
      expect(compiled.providerPrompt, style.id).toContain('No decorative sparkles, glints, star stickers');
      return compiled.providerPrompt;
    });
    expect(new Set(prompts).size).toBe(20);
  });
  it('uses a neutral curated Smart Script by default', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene);
    expect(compiled.spokenScript).toContain('Jom tengok dekat-dekat dulu');
    expect(compiled.spokenScript).not.toMatch(/fakta yang disahkan|nilai kesesuaiannya/i);
    expect(compiled.providerPrompt).toContain('[V8 SMART SCRIPT CONTROL]');
    expect(compiled.providerPrompt).toContain('Never invent a special formula, ingredients, certifications, medical outcomes');
    expect(compiled.providerPrompt).toContain('Bahasa Melayu Malaysia');
  });

  it('respects a customer choice to omit a spoken CTA', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene, { callToAction: 'none' });
    expect(compiled.providerPrompt).toContain('The customer chose no CTA');
    expect(compiled.providerPrompt).not.toContain('Finish one complete neutral spoken CTA');
  });

  it('preserves Provider Auto as an optional legacy mode', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene, { scriptMode: 'provider_auto', callToAction: 'none' });
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).toContain('[PROVIDER AUTO DIALOGUE — AFFIMATIK V8 LEGACY MODE]');
    expect(compiled.providerPrompt).toContain('one distinct hook, one grounded product point');
  });

  it('sends the complete prompt and actual reference image to Nexabot', () => {
    const adapter = new NexabotAdapter({ apiKey: 'test-key' });
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene);
    const payload = adapter.preparePayload({
      jobId: 'job',
      idempotencyKey: 'idem',
      workspaceId: 'workspace',
      prompt: compiled.providerPrompt,
      durationSeconds: 15,
      aspectRatio: '9:16',
      mainImageKeyOrUrl: image,
    }) as Record<string, unknown>;
    expect(payload.mode).toBe('i2v');
    expect(payload.prompt).toBe(compiled.providerPrompt);
    expect(payload.media).toEqual([image]);
  });

  it('routes legacy RH identities through Nexabot without changing their IDs', () => {
    const legacyStyle = getVideoStyle('RH01')!;
    const compiled = DynamicPromptCompiler.compile(product, legacyStyle, { ...scene, audioPolicy: legacyStyle.audioMode });
    expect(legacyStyle.engine).toBe('nexabot');
    expect(compiled.provider).toBe('nexabot');
    expect(compiled.providerPrompt).toContain('[STYLE RH01 — Goyang Produk Natural]');
    expect(compiled.providerPrompt).toContain('Hold stabil selepas VO selesai');
  });
});
