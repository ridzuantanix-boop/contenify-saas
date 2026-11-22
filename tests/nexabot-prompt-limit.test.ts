import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { NexabotAdapter } from '../src/lib/providers/nexabot';
import { VIDEO_STYLES_REGISTRY, getVideoStyle } from '../src/lib/styles/registry';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';

const product: ProductProfile = { name:'IMG_0650-affimatik.jpg', category:'unknown', packagingFormat:'general', confirmedFeatures:[], prohibitedClaims:[], unknownFields:[], sourceConfidence:'manual_fallback' };
const scene: ScenePlan = { mainSubject:'product', location:'provider choice', lighting:'daylight', cameraDistance:'1x', cameraMovement:'natural', startPose:'natural', actionProgression:'style action', endPose:'natural', primaryAction:'style action', audioPolicy:'spoken_bm', targetDurationSeconds:15 };

describe('owner-confirmed Nexabot 1000-character limit', () => {
  it('fits all 30 styles with avatar, background, voice and selected CTA', () => {
    for (const style of VIDEO_STYLES_REGISTRY) {
      const compiled = DynamicPromptCompiler.compile(product, style, scene, { avatarName:'Pawarna', backgroundName:'Gaming Room RGB', voicePersonality:'energetic', callToAction:'tiktok_shop' });
      expect(compiled.preflightValid, style.id).toBe(true);
      expect(compiled.providerPrompt.length, style.id).toBeLessThanOrEqual(1000);
      expect(compiled.providerPrompt, style.id).toContain('Refs: 1 product, 2 avatar, 3 background');
      expect(compiled.providerPrompt, style.id).toContain('Beg Kuning');
    }
  });

  it('rejects an overlong customer direction before job admission without truncation', () => {
    const direction = 'ARAH_PELANGGAN_' + 'x'.repeat(400);
    const compiled = DynamicPromptCompiler.compile(product, getVideoStyle('NX14')!, scene, { callToAction:'tiktok_shop', creativeInstruction:direction });
    expect(compiled.preflightValid).toBe(false);
    expect(compiled.providerPrompt).toContain(direction);
    expect(compiled.validationErrors.join(' ')).toContain('1000 aksara');
  });

  it('keeps every customer CTA inside the cap across all styles', () => {
    const modes = ['none','tiktok_shop','click_button','tap_button','check_bio','dm_info','custom'] as const;
    for (const style of VIDEO_STYLES_REGISTRY) for (const mode of modes) {
      const compiled = DynamicPromptCompiler.compile(product, style, scene, {avatarName:'Pawarna',backgroundName:'Gaming Room RGB',callToAction:mode,customCta:mode === 'custom' ? 'Tekan beg kuning sekarang.' : undefined});
      expect(compiled.preflightValid, `${style.id}/${mode}`).toBe(true);
      expect(compiled.providerPrompt.length, `${style.id}/${mode}`).toBeLessThanOrEqual(1000);
    }
  });

  it('rejects an overlong stored prompt at the provider transport boundary', () => {
    const adapter = new NexabotAdapter({apiKey:'test-key'});
    const checked = adapter.validateInput({jobId:'job',idempotencyKey:'idem',workspaceId:'workspace',prompt:'x'.repeat(1001),durationSeconds:15,aspectRatio:'9:16',mainImageKeyOrUrl:'data:image/png;base64,AA=='});
    expect(checked.isValid).toBe(false);
    expect(checked.error).toContain('1000-character limit');
  });
});
