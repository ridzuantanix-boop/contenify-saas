import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { validateCustomerFact } from '../src/lib/engine/cta-control';
import { nexabotPromptCounts } from '../src/lib/engine/compact-nexabot';
import { sanitizePersonalizationSettings } from '../src/lib/personalization/config';
import { NexabotAdapter } from '../src/lib/providers/nexabot';
import { VIDEO_STYLES_REGISTRY, getVideoStyle } from '../src/lib/styles/registry';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';

const scene: ScenePlan = { mainSubject:'product', location:'provider selected', lighting:'daylight', cameraDistance:'1x', cameraMovement:'natural', startPose:'natural', actionProgression:'style action', endPose:'natural', primaryAction:'style action', audioPolicy:'spoken_bm', targetDurationSeconds:15 };
const product = (name: string, category: string, fact?: string): ProductProfile => ({ name, category, packagingFormat:'general', confirmedFeatures:fact?[fact]:[], prohibitedClaims:[], sourceConfidence:'verified_user' });

describe('owner-approved Nexabot creative freedom', () => {
  it('keeps a relevant buyer angle and category context within the cap for all 30 styles', () => {
    for (const style of VIDEO_STYLES_REGISTRY) {
      const compiled = DynamicPromptCompiler.compile(product('Rice Cooker', 'Kitchen'), style, scene, {avatarName:'Pawarna', backgroundName:'Home', callToAction:'tiktok_shop'});
      expect(compiled.preflightValid, style.id).toBe(true);
      expect(nexabotPromptCounts(compiled.providerPrompt).utf8Bytes, style.id).toBeLessThanOrEqual(1000);
      expect(compiled.providerPrompt).toContain('Category: Kitchen.');
      expect(compiled.providerPrompt).toContain('buyer need, supported benefit and angle');
      expect(compiled.providerPrompt).toContain('No packaging monologue');
      expect(compiled.providerPrompt).toContain('Nexabot writes hook and speech');
    }
  });

  it('preserves customer label information as context without making it proven performance', () => {
    const label = 'Label states moringa and bitter melon for an adult daily routine';
    const compiled = DynamicPromptCompiler.compile(product('Kapsul Moringa', 'Supplement', label), getVideoStyle('NX01')!, scene, {callToAction:'tiktok_shop'});
    expect(compiled.preflightValid).toBe(true);
    expect(compiled.providerPrompt).toContain(`Customer info: ${label}.`);
    expect(compiled.providerPrompt).toContain("Label claims aren't proof");
    expect(compiled.providerPrompt).toContain('supported benefit and angle');
    expect(compiled.providerPrompt).not.toMatch(/boosts immunity|cures illness|guaranteed results/i);
  });

  it('allows label-stated wording as context while keeping specific false-claim guardrails', () => {
    expect(validateCustomerFact('Label states: untuk merawat kulit')).toEqual([]);
    const compiled = DynamicPromptCompiler.compile(product('Serum A', 'Skincare', 'Label states: untuk merawat kulit'), getVideoStyle('NX02')!, scene);
    expect(compiled.preflightValid).toBe(true);
    expect(compiled.providerPrompt).toContain('Customer info: Label states: untuk merawat kulit.');
    expect(compiled.providerPrompt).toContain('cures, guarantees or false facts');
  });

  it('retains non-health product uses and transmits the exact final prompt', () => {
    const examples = [
      ['NX17','Manual Chopper','Kitchen tool','Customer says: manual pull handle'],
      ['NX23','Tudung Bawal','Fashion','Customer says: cotton fabric'],
      ['NX29','Air Fryer','Kitchen appliance','Customer says: removable basket'],
    ] as const;
    const adapter = new NexabotAdapter({apiKey:'offline'});
    for (const [id,name,category,fact] of examples) {
      const compiled = DynamicPromptCompiler.compile(product(name,category,fact), getVideoStyle(id)!, scene, {callToAction:'tiktok_shop'});
      expect(compiled.preflightValid,id).toBe(true);
      const payload = adapter.preparePayload({jobId:'offline',idempotencyKey:'offline',workspaceId:'offline',prompt:compiled.providerPrompt,durationSeconds:15,aspectRatio:'9:16',mainImageKeyOrUrl:'data:image/png;base64,AA=='}) as {prompt:string};
      expect(payload.prompt).toBe(compiled.providerPrompt);
      expect(payload.prompt).toContain(`Category: ${category}.`);
      expect(payload.prompt).toContain(`Customer info: ${fact}.`);
      expect(nexabotPromptCounts(payload.prompt).utf8Bytes,id).toBeLessThanOrEqual(1000);
    }
  });

  it('does not silently shorten a customer product note', () => {
    const note = 'Label says this is a manual kitchen tool. '.repeat(10);
    expect(sanitizePersonalizationSettings({productFact:note}).productFact).toBe(note.trim());
  });
});
