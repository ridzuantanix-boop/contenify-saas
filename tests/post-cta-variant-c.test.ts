import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compileCompactNexabotPrompt, nexabotPromptCounts } from '../src/lib/engine/compact-nexabot';
import { STYLE_DIRECTORS } from '../src/lib/engine/style-directors';
import type { ProductProfile } from '../src/lib/engine/types';

const fixtures = [
  { style: 'NX01', name: 'Minyak Herba S-HERB', cta: 'tekan beg kuning', modest: false, hash: 'eecfa80810900174a150e263b5acc0c5b9d9cc116fe8b519eba4cb7967326a79' },
  { style: 'NX07', name: 'Kapsul Resdung SB', cta: 'tekan butang di bawah', modest: false, hash: 'a014dbeb79fe5ca2c9f058f004a5fd03bfca41b1ff44de820a4f07f252930d66' },
  { style: 'NX03', name: 'MakeScents Vanilla 28', cta: 'tengok detail dekat beg kuning', modest: true, hash: 'a4d3dae8f0ee2399df1adb6bec3896f99b8a7f49bca3d1ecc2b1babc532cc57c' },
  { style: 'NX02', name: 'Vitamin C+E', cta: 'tekan beg kuning', modest: false, hash: '90754f37025d1e3e6eb648769a7611c32c90ec2ff7f0a850d710d91392785792' },
] as const;

const product = (name: string): ProductProfile => ({ name, category: 'image provided', packagingFormat: 'general', confirmedFeatures: [], prohibitedClaims: [], sourceConfidence: 'verified_user' });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

describe('isolated post-CTA visual-only diagnostic', () => {
  it.each(fixtures)('keeps the exact submitted Candidate A prompt for $style', item => {
    const result = compileCompactNexabotPrompt(product(item.name), STYLE_DIRECTORS[item.style], { avatarName: `Owner avatar ${String.fromCharCode(65 + fixtures.indexOf(item))}`, callToAction: 'custom', customCta: item.cta }, item.modest, false, 'A');
    expect(sha(result.prompt)).toBe(item.hash);
  });

  it.each(fixtures)('changes only the final spoken-event directive for $style', item => {
    const options = { avatarName: `Owner avatar ${String.fromCharCode(65 + fixtures.indexOf(item))}`, callToAction: 'custom' as const, customCta: item.cta };
    const before = compileCompactNexabotPrompt(product(item.name), STYLE_DIRECTORS[item.style], options, item.modest, false, 'A');
    const after = compileCompactNexabotPrompt(product(item.name), STYLE_DIRECTORS[item.style], options, item.modest, false, 'C');
    const oldEnding = `Final CTA once: "${item.cta}". End by ~13s; no more words. Presenter settles; smile if visible.`;
    const newEnding = `One complete CTA: "${item.cta}" ends speech ~13s. Then visual-only to 15s: no voice/lip-sync; room sound. Presenter settles; smile if visible.`;
    expect(before.prompt.replace(oldEnding, newEnding)).toBe(after.prompt);
    expect(after.errors).toEqual([]);
    expect(Math.max(...Object.values(nexabotPromptCounts(after.prompt)))).toBeLessThanOrEqual(1000);
    expect(after.prompt).toContain('buyer need, supported benefit and angle');
    expect(after.prompt).toContain(item.modest ? 'Muslimah: hijab covers hair/neck/chest' : 'Modest everyday dress');
  });
});
