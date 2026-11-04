import { describe, it, expect } from 'vitest';
import { VIDEO_STYLES_REGISTRY, getVideoStyle, filterVideoStyles } from '../src/lib/styles/registry';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { SmartStyleMatcher } from '../src/lib/engine/smart-match';

describe('AFFIMATIK V2.0 — Dynamic Prompt Engine & Video Style Registry', () => {
  it('loads pilot styles with complete action plans and valid metadata', () => {
    expect(VIDEO_STYLES_REGISTRY.length).toBeGreaterThanOrEqual(12);

    // Verify Nexabot pilot styles
    const nx01 = getVideoStyle('NX01');
    expect(nx01).toBeDefined();
    expect(nx01?.engine).toBe('nexabot');
    expect(nx01?.durationSeconds).toBe(10);
    expect(nx01?.audioMode).toBe('spoken_bm');

    // Verify RunningHub pilot styles
    const rh01 = getVideoStyle('RH01');
    expect(rh01).toBeDefined();
    expect(rh01?.engine).toBe('runninghub');
    expect(rh01?.durationSeconds).toBe(15);
    expect(rh01?.audioMode).toBe('no_speech');
  });

  it('supports backward-compatible lookup using legacy preset IDs', () => {
    const affiliate = getVideoStyle('gem_real_affiliate');
    expect(affiliate).toBeDefined();
    expect(affiliate?.id).toBe('NX02');

    const ugc = getVideoStyle('gem_realistic_ugc');
    expect(ugc).toBeDefined();
    expect(ugc?.id).toBe('NX05');

    const handDemo = getVideoStyle('gem_product_hand_demo');
    expect(handDemo).toBeDefined();
    expect(handDemo?.id).toBe('RH01');
  });

  it('extracts product intelligence accurately from category and keywords', () => {
    const tudungProfile = AICreativeDirector.extractProductProfile({
      productName: 'Tudung Bawal Sejuk',
      productCategory: 'Fesyen Muslimah',
    });
    expect(tudungProfile.packagingFormat).toBe('apparel');
    expect(tudungProfile.isWearableOrFashion).toBe(true);

    const serumProfile = AICreativeDirector.extractProductProfile({
      productName: 'Serum Muka Glow',
      productCategory: 'Skincare',
    });
    expect(serumProfile.packagingFormat).toBe('bottle');
    expect(serumProfile.isLiquidOrPowder).toBe(true);
  });

  it('Smart Style Match recommends appropriate styles based on product format', () => {
    const serumProfile = AICreativeDirector.extractProductProfile({
      productName: 'Serum Vitamin C',
      productCategory: 'Skincare',
    });

    const recommendations = SmartStyleMatcher.recommend(serumProfile, VIDEO_STYLES_REGISTRY);
    expect(recommendations.length).toBe(3);
    // Skincare/bottle should rank bottle/tilt/label styles highly
    const topIds = recommendations.map((r) => r.style.id);
    expect(topIds.some((id) => ['RH01', 'RH02', 'NX10', 'NX02'].includes(id))).toBe(true);
  });

  it('compiles Nexabot prompt with 100% Malaysian Malay spoken dialogue', () => {
    const style = getVideoStyle('NX01')!;
    const profile = AICreativeDirector.extractProductProfile({
      productName: 'Sambal Hijau Padu',
      productCategory: 'Makanan',
    });
    const scenePlan = AICreativeDirector.createScenePlan(profile, style);
    const compiled = DynamicPromptCompiler.compile(profile, style, scenePlan, {
      isMuslimahModest: true,
      callToAction: 'spoken_button',
    });

    expect(compiled.preflightValid).toBe(true);
    expect(compiled.provider).toBe('nexabot');
    expect(compiled.providerPrompt).toContain('Bahasa Melayu standard Malaysia');
    expect(compiled.providerPrompt).toContain('Strictly avoid Indonesian loanwords');
    expect(compiled.providerPrompt).toContain('Strictly NO English dialogue');
    expect(compiled.providerPrompt).toContain('iPhone 15 Pro');
    expect(compiled.spokenScript).toBeDefined();
  });

  it('enforces HARD RULE: RunningHub 15s styles strictly prohibit spoken voiceover', () => {
    const style = getVideoStyle('RH01')!;
    const profile = AICreativeDirector.extractProductProfile({
      productName: 'Krim Muka',
      productCategory: 'Skincare',
    });
    const scenePlan = AICreativeDirector.createScenePlan(profile, style);

    // Normal compilation has no spoken script
    const compiled = DynamicPromptCompiler.compile(profile, style, scenePlan);
    expect(compiled.preflightValid).toBe(true);
    expect(compiled.provider).toBe('runninghub');
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).toContain('Strictly NO spoken dialogue');
    expect(compiled.continuityAnchor).toContain('14.8s mark');

    // Attempting to pass custom script to RunningHub must fail preflight
    const invalidCompilation = DynamicPromptCompiler.compile(profile, style, scenePlan, {
      customScript: 'Cuba dengar suara saya bercakap ini',
    });
    expect(invalidCompilation.preflightValid).toBe(false);
    expect(invalidCompilation.validationErrors[0]).toContain('RunningHub');
  });

  it('filters styles by category and voice capability', () => {
    const voiceOnly = filterVideoStyles({ hasVoice: true });
    expect(voiceOnly.every((s) => s.audioMode === 'spoken_bm')).toBe(true);

    const noVoiceOnly = filterVideoStyles({ hasVoice: false });
    expect(noVoiceOnly.every((s) => s.audioMode === 'no_speech')).toBe(true);
  });
});
