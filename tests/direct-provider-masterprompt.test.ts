import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle } from '../src/lib/styles/registry';
import { NexabotAdapter } from '../src/lib/providers/nexabot';
import { RunningHubAdapter } from '../src/lib/providers/runninghub';
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
  targetDurationSeconds: 10,
};

describe('direct-to-provider masterprompt architecture', () => {
  it('does not generate or expose a local spoken script by default', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene);
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).toContain('[PROVIDER-CREATED DIALOGUE — AFFIMATIK VOICE 10s]');
    expect(compiled.providerPrompt).toContain('Never invent ingredients, certifications, medical outcomes');
    expect(compiled.providerPrompt).toContain('Bahasa Melayu standard Malaysia');
  });

  it('sends the complete prompt and actual reference image to Nexabot', () => {
    const adapter = new NexabotAdapter({ apiKey: 'test-key' });
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene);
    const payload = adapter.preparePayload({
      jobId: 'job',
      idempotencyKey: 'idem',
      workspaceId: 'workspace',
      prompt: compiled.providerPrompt,
      durationSeconds: 10,
      aspectRatio: '9:16',
      mainImageKeyOrUrl: image,
    }) as Record<string, unknown>;
    expect(payload.mode).toBe('i2v');
    expect(payload.prompt).toBe(compiled.providerPrompt);
    expect(payload.media).toEqual([image]);
  });

  it('sends the complete prompt and actual reference image to RunningHub', () => {
    const adapter = new RunningHubAdapter({ apiKey: 'test-key' });
    const motionStyle = getVideoStyle('RH01')!;
    const motionScene = { ...scene, audioPolicy: 'no_speech' as const, targetDurationSeconds: 15 as const };
    const compiled = DynamicPromptCompiler.compile(product, motionStyle, motionScene);
    const payload = adapter.preparePayload({
      jobId: 'job',
      idempotencyKey: 'idem',
      workspaceId: 'workspace',
      prompt: compiled.providerPrompt,
      durationSeconds: 15,
      aspectRatio: '9:16',
      mainImageKeyOrUrl: image,
    }) as { nodeInfoList: Array<{ nodeId: string; fieldValue: string }> };
    expect(compiled.spokenScript).toBeUndefined();
    expect(payload.nodeInfoList.find((node) => node.nodeId === '136')?.fieldValue).toBe(compiled.providerPrompt);
    expect(payload.nodeInfoList.find((node) => node.nodeId === '114')?.fieldValue).toBe(image);
  });
});
