import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GET as getBackgrounds } from '../src/app/api/backgrounds/route';
import { GET as getPresets } from '../src/app/api/creator-presets/route';
import { sanitizePersonalizationSettings } from '../src/lib/personalization/config';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle } from '../src/lib/styles/registry';
import { ProductProfile, ScenePlan } from '../src/lib/engine/types';
import { NexabotAdapter } from '../src/lib/providers/nexabot';

const product: ProductProfile = {
  name: 'Reference Product', category: 'kitchen', packagingFormat: 'box', spokenShortName: 'produk ini',
  coreFunction: 'purpose visible in the image', usageContext: 'ordinary home use', buyerProblem: 'ordinary buyer situation',
  allowedQaQuestion: 'what is it for', confirmedFeatures: [], verifiedBenefits: [], verifiedFacts: [], unknownFields: [],
  prohibitedClaims: [], sourceConfidence: 'manual_fallback', provenance: 'manual_user_entry', isVisionSupported: false,
};
const scene: ScenePlan = {
  mainSubject: product.name, location: 'home', lighting: 'daylight', cameraDistance: 'medium', cameraMovement: 'handheld',
  startPose: 'holding product', actionProgression: 'show product naturally', endPose: 'hold', primaryAction: 'show product',
  audioPolicy: 'spoken_bm', targetDurationSeconds: 15,
};

describe('AffiMatik V7 Personalization Studio', () => {
  it('keeps all personalization fields optional and rejects malformed IDs or unbounded instructions', () => {
    expect(sanitizePersonalizationSettings({})).toMatchObject({ styleId: 'NX01', avatarId: null, backgroundId: null, niche: 'auto', scriptVariant: 'style', audioTreatment: 'voiceover' });
    const settings = sanitizePersonalizationSettings({ avatarId: '../../other-workspace', backgroundId: 'bad', builtInSceneId: 'scene:unknown', creativeInstruction: 'x'.repeat(2000) });
    expect(settings.avatarId).toBeNull(); expect(settings.backgroundId).toBeNull(); expect(settings.builtInSceneId).toBeNull();
    expect(settings.creativeInstruction).toHaveLength(1000);
  });

  it('requires authentication for both new persistent libraries', async () => {
    expect((await getBackgrounds(new NextRequest('https://affimatik.test/api/backgrounds'))).status).toBe(401);
    expect((await getPresets(new NextRequest('https://affimatik.test/api/creator-presets'))).status).toBe(401);
  });

  it('compiles explicit product, avatar and background roles without making product the first frame', () => {
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene, {
      avatarName: 'Aina Creator', backgroundName: 'Dapur Putih', niche: 'kitchen', voicePersonality: 'friendly',
      storyboard: 'step_by_step', callToAction: 'none', creativeInstruction: 'Demonstrate one safe ordinary action.',
    });
    expect(compiled.providerPrompt).toContain('Reference image 1 is the PRODUCT IDENTITY authority');
    expect(compiled.providerPrompt).toContain('Reference image 2 is the selected PRESENTER IDENTITY');
    expect(compiled.providerPrompt).toContain('Reference image 3 is the BACKGROUND/ENVIRONMENT');
    expect(compiled.providerPrompt).toContain('not a mandatory first video frame');
    expect(compiled.providerPrompt).toContain('Customer-selected storyboard: step_by_step');
    expect(compiled.providerPrompt).toContain('Do not add a spoken call to action');
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).toContain('[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]');
  });

  it('orders and caps Nexabot media exactly as product, avatar, background', () => {
    const adapter = new NexabotAdapter({ apiKey: 'test' });
    const payload = adapter.preparePayload({
      jobId: 'job', idempotencyKey: 'idem', workspaceId: 'ws', prompt: 'full prompt', durationSeconds: 15,
      aspectRatio: '9:16', mainImageKeyOrUrl: 'data:image/png;base64,PRODUCT',
      referenceImageKeysOrUrls: ['data:image/png;base64,AVATAR', 'data:image/png;base64,BACKGROUND'],
    }) as { mode: string; media: string[] };
    expect(payload.mode).toBe('i2v');
    expect(payload.media).toEqual(['data:image/png;base64,PRODUCT', 'data:image/png;base64,AVATAR', 'data:image/png;base64,BACKGROUND']);
    expect(() => adapter.preparePayload({
      jobId: 'job', idempotencyKey: 'idem', workspaceId: 'ws', prompt: 'full prompt', durationSeconds: 15,
      aspectRatio: '9:16', mainImageKeyOrUrl: 'data:image/png;base64,PRODUCT',
      referenceImageKeysOrUrls: ['data:image/png;base64,AVATAR', 'data:image/png;base64,BACKGROUND', 'data:image/png;base64,EXTRA'],
    })).toThrow('at most two personalization references');
    expect(() => adapter.preparePayload({
      jobId: 'job', idempotencyKey: 'idem', workspaceId: 'ws', prompt: 'full prompt', durationSeconds: 15,
      aspectRatio: '9:16', mainImageKeyOrUrl: 'data:image/png;base64,PRODUCT', referenceImageKeysOrUrls: ['invalid-reference'],
    })).toThrow('no selected reference was silently omitted');
  });

  it('uses spare media capacity for a duplicate product without dropping one selected reference', () => {
    const adapter = new NexabotAdapter({ apiKey: 'test' });
    const productOnly = adapter.preparePayload({
      jobId: 'product', idempotencyKey: 'idem-product', workspaceId: 'ws', prompt: 'full prompt', durationSeconds: 15,
      aspectRatio: '9:16', mainImageKeyOrUrl: 'data:image/png;base64,PRODUCT',
    }) as { media: string[] };
    const withAvatar = adapter.preparePayload({
      jobId: 'avatar', idempotencyKey: 'idem-avatar', workspaceId: 'ws', prompt: 'full prompt', durationSeconds: 15,
      aspectRatio: '9:16', mainImageKeyOrUrl: 'data:image/png;base64,PRODUCT',
      referenceImageKeysOrUrls: ['data:image/png;base64,AVATAR'],
    }) as { media: string[] };
    expect(productOnly.media).toEqual(['data:image/png;base64,PRODUCT', 'data:image/png;base64,PRODUCT']);
    expect(withAvatar.media).toEqual(['data:image/png;base64,PRODUCT', 'data:image/png;base64,PRODUCT', 'data:image/png;base64,AVATAR']);
  });

  it('defines additive workspace-scoped migration, RLS and safe rollback', () => {
    const migration = fs.readFileSync(path.resolve('supabase/migrations/00019_personalization_studio.sql'), 'utf8');
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.background_assets/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.creator_presets/);
    expect(migration.match(/workspace_id UUID NOT NULL/g)).toHaveLength(2);
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('uq_creator_presets_one_default');
    expect(migration).toContain('set_creator_preset_default');
    expect(fs.existsSync(path.resolve('supabase/rollback/00019_personalization_studio.sql'))).toBe(true);
  });

  it('keeps production protections and exposes real connected Factory controls', () => {
    const jobs = fs.readFileSync(path.resolve('src/app/api/jobs/route.ts'), 'utf8');
    const factory = fs.readFileSync(path.resolve('src/app/(dashboard)/factory/page.tsx'), 'utf8');
    expect(jobs).toContain('workspace_id=eq.${encodeURIComponent(workspaceId)}');
    expect(jobs).toContain('consent_confirmed=eq.true');
    expect(jobs).toContain('referenceImageKeysOrUrls: personalizationReferences');
    expect(factory).toContain('avatarId: avatarId || undefined');
    expect(factory).toContain('backgroundId: backgroundId || undefined');
    expect(factory).toContain('Simpan sebagai Preset');
    expect(factory).toContain('Jana Video Sekarang');
    expect(factory).toContain('Status Personalisasi Provider');
    expect(factory).toContain('produk sahaja, latar imej');
    expect(factory).toContain('Beta:');
    expect(factory).toContain('Produk + Avatar + Latar');
    expect(factory).toContain('tiada rujukan dipadam secara senyap');
    expect(factory).toContain('submitLockRef.current');
    expect(factory).toContain('isUploadingImage || images.length === 0');
    expect(factory).toContain('Menyimpan Imej Produk...');
    expect(factory).toContain('Muat Naik Gambar Produk Dahulu');
    expect(factory).toContain('role="alert"');
    expect(factory).toContain('syncActiveJobStatus(activeJobId)');
    expect(factory).toContain("document.addEventListener('visibilitychange'");
    expect(factory).toContain('Semak Status Sekarang');
    expect(factory).toContain('Auto / Tanpa Preset');
    expect(factory).toContain('Arah Kreatif & CTA');
    expect(factory).toContain('Ambient — Eksperimental');
    expect(factory).not.toContain('Smart Script');
    expect(factory).not.toContain('Custom Script');
  });
});
