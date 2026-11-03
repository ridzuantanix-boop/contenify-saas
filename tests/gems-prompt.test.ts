import { describe, it, expect } from 'vitest';
import { OFFICIAL_GEMS_PRESETS } from '../src/lib/gems/presets';
import { buildUniversalMasterprompt } from '../src/lib/gems/prompt-builder';

describe('Official Gems Presets & Prompt Builder', () => {
  it('loads official presets with valid metadata', () => {
    expect(OFFICIAL_GEMS_PRESETS.length).toBeGreaterThanOrEqual(4);
    const affiliate = OFFICIAL_GEMS_PRESETS.find(p => p.id === 'gem_real_affiliate');
    expect(affiliate).toBeDefined();
    expect(affiliate?.targetDurationSeconds).toBe(10);
  });

  it('compiles universal masterprompt with Malaysian Malay guardrails', () => {
    const affiliatePreset = OFFICIAL_GEMS_PRESETS.find(p => p.id === 'gem_real_affiliate')!;
    const result = buildUniversalMasterprompt({
      preset: affiliatePreset,
      productName: 'Sambal Hijau Opah',
      productCategory: 'Makanan',
      productFacts: ['Resepi asli 50 tahun', 'Pedas nikmat'],
      callToAction: 'spoken_button',
      isMuslimahModest: true,
    });

    // Check Malaysian Malay voice requirements
    expect(result.masterPrompt).toContain('Bahasa Melayu standard Malaysia');
    expect(result.masterPrompt).toContain('Strictly avoid Indonesian loanwords');

    // Check Muslimah modesty
    expect(result.masterPrompt).toContain('proper hijab securely covering hair, ears, and chest');

    // Check CTA rule (spoken only, no fake yellow basket button)
    expect(result.masterPrompt).toContain('Tekan butang di bawah');
    expect(result.masterPrompt).toContain('Do NOT generate any onscreen yellow basket');
  });

  it('includes continuity anchor for 15s hand demo', () => {
    const handDemoPreset = OFFICIAL_GEMS_PRESETS.find(p => p.id === 'gem_product_hand_demo')!;
    const result = buildUniversalMasterprompt({
      preset: handDemoPreset,
      productName: 'Serum Muka Glow',
      productFacts: ['Vitamin C', 'Tekstur ringan'],
    });

    expect(result.continuityAnchor).toBeDefined();
    expect(result.continuityAnchor).toContain('14.8s mark');
  });
});
