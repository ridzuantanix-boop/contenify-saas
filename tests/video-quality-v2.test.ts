import { describe, expect, it } from 'vitest';
import { assessMediaQuality } from '../src/lib/quality/media-quality';
import { DynamicPromptCompiler } from '../src/lib/engine/compiler';
import { getVideoStyle, VIDEO_STYLES_REGISTRY } from '../src/lib/styles/registry';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';

const product: ProductProfile = { name:'uploaded image', category:'unknown', packagingFormat:'general', confirmedFeatures:[], prohibitedClaims:[], unknownFields:[], sourceConfidence:'manual_fallback' };
const scene: ScenePlan = { mainSubject:'product', location:'chosen by provider', lighting:'daylight', cameraDistance:'1x', cameraMovement:'natural', startPose:'natural', actionProgression:'style direction', endPose:'natural', primaryAction:'style action', audioPolicy:'spoken_bm', targetDurationSeconds:15 };

describe('V2 conservative media gate', () => {
  it('flags missing audio on speaking outputs', () => {
    expect(assessMediaQuality({ expectedDurationSeconds:15, actualDurationSeconds:15.04, hasAudio:false, sizeBytes:4_000_000, speechExpected:true }).state).toBe('QUALITY_FAIL');
  });
  it('flags a corrupt or wrong-duration output', () => {
    expect(assessMediaQuality({ expectedDurationSeconds:15, actualDurationSeconds:11, hasAudio:true, sizeBytes:4_000_000, speechExpected:true }).checks).toContain('duration_mismatch');
  });
  it('does not call a structurally valid talking video perfect', () => {
    const assessment = assessMediaQuality({ expectedDurationSeconds:15, actualDurationSeconds:15.04, hasAudio:true, sizeBytes:4_000_000, speechExpected:true });
    expect(assessment.state).toBe('QUALITY_UNCERTAIN');
    expect(assessment.limitations).toContain('cta_completeness_not_verified');
  });
  it('treats missing measurements as uncertain rather than a proven media failure', () => {
    const assessment = assessMediaQuality({ expectedDurationSeconds:15, speechExpected:true });
    expect(assessment.state).toBe('QUALITY_UNCERTAIN');
    expect(assessment.limitations).toContain('duration_not_measured');
  });
});

describe('all-style compact prompt safety', () => {
  it('keeps 30 distinct prompts inside the confirmed provider limit', () => {
    const prompts = VIDEO_STYLES_REGISTRY.map(style => DynamicPromptCompiler.compile(product, style, scene, {callToAction:'tiktok_shop'}));
    expect(new Set(prompts.map(item => item.providerPrompt)).size).toBe(30);
    for (const item of prompts) {
      expect(item.preflightValid).toBe(true);
      expect(item.providerPrompt.length).toBeLessThanOrEqual(1000);
      expect(item.providerPrompt).toContain('8–12% frame height');
      expect(item.providerPrompt).toContain('Keep unseen contents closed');
      expect(item.providerPrompt).toContain('Final spoken CTA once before cut');
      expect(item.providerPrompt).not.toContain('12–18% of frame height');
    }
  });
  it('protects a niqab reference in the submitted text', () => {
    const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene, {avatarName:'Customer avatar',callToAction:'tiktok_shop'}).providerPrompt;
    expect(prompt).toContain('If niqab in avatar, keep it throughout');
    expect(prompt).toContain('No speech after');
  });
  it('keeps unseen contents closed in appliance styles', () => {
    for (const id of ['NX28', 'NX29']) {
      const prompt = DynamicPromptCompiler.compile(product, getVideoStyle(id)!, scene).providerPrompt;
      expect(prompt).toContain('Keep unseen contents closed; invent nothing inside');
    }
  });
  it('does not force speech on explicitly silent output', () => {
    const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('NX09')!, scene, {audioTreatment:'asmr'}).providerPrompt;
    expect(prompt).toContain('Only synchronized handling ASMR; no speech');
    expect(prompt).not.toContain('Final spoken CTA');
  });
});
