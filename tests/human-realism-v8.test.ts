import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler, HUMAN_REALISM_MASTERPROMPT_V8 } from '../src/lib/engine/compiler';
import {
  APPROVED_CTA_PHRASES,
  CURATED_STYLE_SCRIPT_PATTERNS,
  buildSmartScript,
  validateCustomCta,
  validateHumanScript,
} from '../src/lib/engine/script-control';
import { getVideoStyle, VIDEO_STYLES_REGISTRY } from '../src/lib/styles/registry';
import type { ProductProfile, ScenePlan } from '../src/lib/engine/types';

const product = (fact = ''): ProductProfile => ({
  name: 'Lampu Nova', category: 'home', packagingFormat: 'general', spokenShortName: 'lampu ini',
  confirmedFeatures: fact ? [fact] : [], verifiedFacts: fact ? [fact] : [], verifiedBenefits: [],
  unknownFields: ['battery', 'certification'], prohibitedClaims: ['medical outcomes'],
  sourceConfidence: fact ? 'verified_user' : 'manual_fallback', provenance: 'manual_user_entry', isVisionSupported: false,
});

const scene: ScenePlan = {
  mainSubject: 'Lampu Nova', location: 'home', lighting: 'neutral daylight', cameraDistance: 'smartphone 1x',
  cameraMovement: 'handheld', startPose: 'natural', actionProgression: 'small movement', endPose: 'hold',
  primaryAction: 'show product', audioPolicy: 'spoken_bm', targetDurationSeconds: 15,
};

describe('AffiMatik V8 Human Realism Script Control', () => {
  it('has one curated human-written pattern for every official style', () => {
    expect(Object.keys(CURATED_STYLE_SCRIPT_PATTERNS).sort()).toEqual(VIDEO_STYLES_REGISTRY.map((style) => style.id).sort());
    const neutralScripts = VIDEO_STYLES_REGISTRY.map((style) => buildSmartScript(product(), style, 'none'));
    expect(new Set(neutralScripts).size).toBe(20);
    expect(neutralScripts.join(' ')).not.toMatch(/wireless|rechargeable|menyembuhkan|berkesan/i);
    expect(neutralScripts.every((script) => script.split(/\s+/).length <= 48)).toBe(true);
    expect(neutralScripts.join(' ')).not.toMatch(/fakta yang disahkan|maklumat yang disahkan|nilai kesesuaiannya|perkara utama untuk dipertimbangkan|rujuk maklumat yang sah/i);
  });

  it('only interpolates a customer-confirmed fact into Smart Script', () => {
    const style = getVideoStyle('NX02')!;
    expect(buildSmartScript(product(), style, 'none')).not.toContain('tiga tahap kecerahan');
    expect(buildSmartScript(product('mempunyai tiga tahap kecerahan'), style, 'none')).toContain('mempunyai tiga tahap kecerahan');
  });

  it('does not append formal filler merely to reach a word target', () => {
    const script = buildSmartScript(product(), getVideoStyle('NX17')!, 'none');
    expect(script.split(/\s+/).length).toBeLessThan(38);
    expect(script).toContain('Eh, korang yang tengah cari Lampu Nova');
    expect(script).toContain('check fungsi yang korang perlukan');
  });

  it('supports all approved CTA phrases and exact bounded custom CTA', () => {
    expect(APPROVED_CTA_PHRASES.tiktok_shop).toContain('Beg Kuning');
    expect(APPROVED_CTA_PHRASES.click_button).toBe('Nak tengok detail? Klik butang dekat bawah.');
    expect(APPROVED_CTA_PHRASES.tap_button).toBe('Kalau nak tahu lagi, tekan butang dekat bawah.');
    expect(APPROVED_CTA_PHRASES.check_bio).toContain('bio');
    expect(APPROVED_CTA_PHRASES.dm_info).toContain('DM');
    expect(APPROVED_CTA_PHRASES.none).toBe('');
    expect(validateCustomCta('DM untuk warna yang ada.')).toEqual([]);
    expect(validateCustomCta('x'.repeat(81))).not.toEqual([]);
  });

  it('sends a Custom Script and CTA once while warning against provider additions', () => {
    const customScript = 'Lampu ini sesuai dipertimbangkan untuk meja kerja yang memerlukan pencahayaan tambahan.';
    const customCta = 'DM untuk info lanjut.';
    const compiled = DynamicPromptCompiler.compile(product(), getVideoStyle('NX14')!, scene, {
      scriptMode: 'custom', customScript, callToAction: 'custom', customCta,
    });
    expect(compiled.preflightValid).toBe(true);
    expect(compiled.spokenScript).toBe(`${customScript} ${customCta}`);
    expect(compiled.providerPrompt.match(/DM untuk info lanjut\./g)).toHaveLength(1);
    expect(compiled.providerPrompt).toContain('without adding claims, testimonials, a second CTA');
    expect(compiled.providerPrompt).toContain('Speak that CTA exactly once');
  });

  it('keeps Provider Auto optional and removes the forced second-11 ending', () => {
    const compiled = DynamicPromptCompiler.compile(product(), getVideoStyle('NX03')!, scene, {
      scriptMode: 'provider_auto', callToAction: 'none',
    });
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).toContain('[PROVIDER AUTO DIALOGUE — AFFIMATIK V8 LEGACY MODE]');
    expect(compiled.providerPrompt).toContain('10 to 13 seconds of speech');
    expect(compiled.providerPrompt).not.toMatch(/before second 11|remaining video silent/i);
  });

  it('validates custom scripts without requiring full-length narration', () => {
    expect(validateHumanScript('Ini lampu meja.').isValid).toBe(true);
    expect(validateHumanScript('Kalian wajib cobain produk ini!').isValid).toBe(false);
    expect(validateHumanScript(Array.from({ length: 49 }, () => 'perkataan').join(' ')).isValid).toBe(false);
  });

  it('contains all required style-specific physical realism behaviours', () => {
    expect(HUMAN_REALISM_MASTERPROMPT_V8).toContain('Creator review:');
    expect(HUMAN_REALISM_MASTERPROMPT_V8).toContain('First impression:');
    expect(HUMAN_REALISM_MASTERPROMPT_V8).toContain('Question and answer:');
    expect(HUMAN_REALISM_MASTERPROMPT_V8).toContain('Hand demonstration:');
    expect(HUMAN_REALISM_MASTERPROMPT_V8).toContain('POV:');
    expect(HUMAN_REALISM_MASTERPROMPT_V8).toContain('Lifestyle:');
    expect(HUMAN_REALISM_MASTERPROMPT_V8).toContain('Soft sell:');
  });

  it('keeps product-handling voiceover useful instead of narrating camera action', () => {
    for (const id of ['RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19']) {
      const script = buildSmartScript(product(), getVideoStyle(id)!, 'none');
      expect(script).not.toMatch(/aku (pusing|sengetkan|angkat|pegang|letak)|bagi nampak bentuk|cahaya siang|bungkusan|packaging|jangan (terus )?pilih|sesuai tak dengan keperluan/i);
      expect(script).not.toMatch(/fakta yang disahkan|maklumat yang disahkan|nilai kesesuaiannya|rujuk maklumat yang sah/i);
    }
  });

  it('gives the six RH styles distinct buyer-facing scripts and keeps the selected CTA once', () => {
    const scripts = ['RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19'].map((id) =>
      buildSmartScript(product('boleh laras arah cahaya'), getVideoStyle(id)!, 'click_button'),
    );
    expect(new Set(scripts).size).toBe(6);
    for (const script of scripts) {
      expect(script.match(/Klik butang dekat bawah\./g)).toHaveLength(1);
      expect(script).not.toMatch(/pusing|sengetkan|angkat|pegang|letak produk|rupa bungkusan|packaging/i);
    }
  });

  it('uses category-safe buying considerations and concrete vocal performance', () => {
    const supplement = { ...product(), category: 'wellness', name: 'Suplemen ini' };
    expect(buildSmartScript(supplement, getVideoStyle('NX01')!, 'none')).toContain('semak kandungan dan cara pengambilan');
    const compiled = DynamicPromptCompiler.compile(product(), getVideoStyle('NX01')!, scene, { voicePersonality: 'energetic' });
    expect(compiled.providerPrompt).toContain('Start quickly with lively but controlled energy');
    expect(compiled.providerPrompt).not.toMatch(/20.?30%/);
    expect(compiled.providerPrompt).toContain('[PLAUSIBLE PRODUCT SCALE LOCK]');
  });

  it('supports experimental ambient and ASMR without silently injecting dialogue', () => {
    const compiled = DynamicPromptCompiler.compile(product(), getVideoStyle('RH03')!, scene, {
      audioTreatment: 'asmr', scriptMode: 'smart', callToAction: 'tiktok_shop',
    });
    expect(compiled.spokenScript).toBeUndefined();
    expect(compiled.providerPrompt).toContain('[EXPERIMENTAL ASMR AUDIO MODE]');
    expect(compiled.providerPrompt).toContain('Strictly no spoken dialogue');
  });
});
