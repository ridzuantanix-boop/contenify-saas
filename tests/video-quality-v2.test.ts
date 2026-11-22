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

describe('V2 all-style prompt safety', () => {
  it('keeps distinct styles while adding plausible motion and CTA ending', () => {
    const prompts = VIDEO_STYLES_REGISTRY.map(style => DynamicPromptCompiler.compile(product, style, scene, {callToAction:'tiktok_shop'}).providerPrompt);
    expect(new Set(prompts).size).toBe(30);
    for (const prompt of prompts) {
      expect(prompt).toContain('plausible smartphone 1x framing');
      expect(prompt).toContain('[PRODUCT SCALE LOCK]');
    }
  });
  it('protects a niqab reference and does not ask to show its lips', () => {
    const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('NX01')!, scene, {avatarName:'Customer avatar',callToAction:'tiktok_shop'}).providerPrompt;
    expect(prompt).toContain('[ABSOLUTE NIQAB REFERENCE LOCK]');
    expect(prompt).toContain('visible eyes');
    expect(prompt).toContain('CTA completion takes priority');
  });
  it('does not force speech or a smile on explicitly silent output', () => {
    const prompt = DynamicPromptCompiler.compile(product, getVideoStyle('NX09')!, scene, {audioTreatment:'asmr'}).providerPrompt;
    expect(prompt).not.toContain('[SPEAKING AVATAR ENDING]');
    expect(prompt).toContain('no spoken words');
  });
});
