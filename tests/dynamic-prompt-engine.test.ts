import { describe, expect, it } from 'vitest';
import { VIDEO_STYLES_REGISTRY, filterVideoStyles, getVideoStyle } from '../src/lib/styles/registry';
import { AICreativeDirector } from '../src/lib/engine/creative-director';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { SmartStyleMatcher } from '../src/lib/engine/smart-match';

describe('AFFIMATIK V6 — prompt engine and style registry', () => {
  it('loads 20 Nexabot-native styles and preserves legacy IDs', () => {
    expect(VIDEO_STYLES_REGISTRY).toHaveLength(20);
    expect(VIDEO_STYLES_REGISTRY.every((style) => style.engine === 'nexabot' && style.durationSeconds === 15)).toBe(true);
    expect(getVideoStyle('RH01')?.audioMode).toBe('off_camera_narration');
    expect(getVideoStyle('gem_product_hand_demo')?.id).toBe('RH01');
    expect(getVideoStyle('gem_real_affiliate')?.id).toBe('NX02');
  });

  it('keeps product profile extraction and smart matching operational', () => {
    const profile = AICreativeDirector.extractProductProfile({ productName: 'Serum Muka Glow', productCategory: 'Skincare' });
    expect(profile.packagingFormat).toBe('bottle');
    const recommendations = SmartStyleMatcher.recommend(profile, VIDEO_STYLES_REGISTRY);
    expect(recommendations).toHaveLength(3);
    expect(recommendations.every((item) => item.style.engine === 'nexabot')).toBe(true);
  });

  it('compiles Malaysian direct-provider dialogue instructions without a local script', () => {
    const style = getVideoStyle('NX01')!;
    const product = AICreativeDirector.extractProductProfile({ productName: 'Sambal Hijau Padu', productCategory: 'Makanan' });
    const compiled = DynamicPromptCompiler.compile(product, style, AICreativeDirector.createScenePlan(product, style));
    expect(compiled.preflightValid).toBe(true);
    expect(compiled.provider).toBe('nexabot');
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).toContain('Bahasa Melayu Malaysia');
    expect(compiled.providerPrompt).toContain('No Indonesian forms');
    expect(compiled.providerPrompt).toContain('AffiMatik supplies no generated script');
  });

  it('filters voice, off-camera and category styles correctly', () => {
    expect(filterVideoStyles({ hasVoice: true })).toHaveLength(20);
    expect(filterVideoStyles({ hasVoice: false })).toHaveLength(0);
    expect(filterVideoStyles({ category: 'pov' }).map((style) => style.id)).toEqual(['NX11']);
    expect(filterVideoStyles({ category: 'soft_sell' }).map((style) => style.id)).toEqual(['NX16']);
  });
});
