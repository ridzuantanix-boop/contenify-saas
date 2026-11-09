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

  it('compiles the default Malaysian Smart Script and V8 realism controls', () => {
    const style = getVideoStyle('NX01')!;
    const product = AICreativeDirector.extractProductProfile({ productName: 'Sambal Hijau Padu', productCategory: 'Makanan' });
    const compiled = DynamicPromptCompiler.compile(product, style, AICreativeDirector.createScenePlan(product, style));
    expect(compiled.preflightValid).toBe(true);
    expect(compiled.provider).toBe('nexabot');
    expect(compiled.spokenScript).toContain('Sambal Hijau Padu');
    expect(compiled.providerPrompt).toContain('Bahasa Melayu Malaysia');
    expect(compiled.providerPrompt).toContain('No Indonesian forms');
    expect(compiled.providerPrompt).toContain('[HUMAN REALISM MASTERPROMPT V8]');
    expect(compiled.providerPrompt).toContain('[V8 SMART SCRIPT CONTROL]');
  });

  it('filters voice, off-camera and category styles correctly', () => {
    expect(filterVideoStyles({ hasVoice: true })).toHaveLength(20);
    expect(filterVideoStyles({ hasVoice: false })).toHaveLength(0);
    expect(filterVideoStyles({ category: 'pov' }).map((style) => style.id)).toEqual(['NX11']);
    expect(filterVideoStyles({ category: 'soft_sell' }).map((style) => style.id)).toEqual(['NX16']);
  });
});
