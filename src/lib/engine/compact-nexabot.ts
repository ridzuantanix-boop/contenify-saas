import type { ProductProfile } from './types';
import type { CompilerOptions } from './compiler';
import type { StyleDirectorSpec } from './style-directors';
import { resolveEffectiveAudioMode } from './style-directors';
import { resolveCtaPhrase } from './cta-control';
import { getBuiltInScene } from '../personalization/config';

// Owner-confirmed video limit. Public Nexabot docs expose one `prompt` field but
// do not state its counting rule, so enforce the strictest common measurement.
export const NEXABOT_VIDEO_PROMPT_MAX_CHARS = 1000;
export type CompactPromptCandidate = 'A' | 'B' | 'C';
type Part = { kind: 'global' | 'style' | 'cta' | 'context' | 'niqab'; text: string };

export function nexabotPromptCounts(prompt: string) {
  return {
    utf16: prompt.length,
    codePoints: Array.from(prompt).length,
    utf8Bytes: new TextEncoder().encode(prompt).length,
  };
}

export function compileCompactNexabotPrompt(
  product: ProductProfile,
  director: StyleDirectorSpec,
  options: CompilerOptions,
  isMuslimah: boolean,
  isHandOnly: boolean,
  candidate: CompactPromptCandidate = 'A',
): { prompt: string; audioDirective: string; errors: string[]; budget: Record<string, number> } {
  const mode = resolveEffectiveAudioMode(director, options.audioTreatment);
  const spoken = mode === 'spoken_presenter' || mode === 'off_camera_voiceover';
  const cta = resolveCtaPhrase(options.callToAction || 'none', options.customCta || '');
  const hasAvatar = Boolean(options.avatarName);
  const hasBackground = Boolean(options.backgroundName);
  const duplicatedProduct = Number(hasAvatar) + Number(hasBackground) < 2;
  const references = duplicatedProduct
    ? `Refs 1&2 same product${hasAvatar ? ', 3 avatar' : hasBackground ? ', 3 background' : ''}; not start frames.`
    : 'Refs: 1 product, 2 avatar, 3 background; not start frames.';
  const audioDirective = mode === 'spoken_presenter'
    ? 'Lively BM Malaysia presenter; natural pace.'
    : mode === 'off_camera_voiceover'
      ? 'Lively BM Malaysia voiceover; no talking face.'
      : mode === 'asmr'
        ? 'Only natural handling ASMR; no speech.'
        : mode === 'ambient'
          ? 'Only natural ambience; no speech.'
          : 'No speech or lip-sync.';
  const modesty = isMuslimah
    ? isHandOnly
      ? 'Sleeves cover wrists and forearms throughout.'
      : 'Muslimah: hijab covers hair/neck/chest; loose opaque clothes, wrists covered.'
    : 'Modest everyday dress.';
  const selectedScene = getBuiltInScene(options.builtInSceneId);
  const productName = product.name.trim();
  const usefulProductName = productName !== 'the uploaded product image'
    && productName !== 'uploaded image'
    && !/\.(?:jpe?g|png|webp|heic)$/i.test(productName);
  // Customer-authored text and confirmed facts are preserved whole or rejected.
  const context = [
    usefulProductName ? `Product: ${productName}.` : '',
    product.category && !/^(?:image provided|product shown|the product shown|unknown|produk pengguna|produk)(?:\b|$)/i.test(product.category.trim()) ? `Category: ${product.category}.` : '',
    product.usageContext ? `Customer context: ${product.usageContext}.` : '',
    product.buyerProblem ? `Customer buyer context: ${product.buyerProblem}.` : '',
    product.coreFunction ? `Customer purpose: ${product.coreFunction}.` : '',
    ...(product.observedPhysicalFacts || []).map(fact => `Visible: ${fact}.`),
    ...(product.confirmedFeatures || []).map(fact => `Customer info: ${fact}.`),
    ...(product.verifiedBenefits || []).map(fact => `Customer-supported benefit: ${fact}.`),
    selectedScene && !hasBackground ? `Scene: ${selectedScene.directive}.` : '',
    options.niche && options.niche !== 'auto' ? `Niche: ${options.niche}.` : '',
    options.voicePersonality && options.voicePersonality !== 'auto' ? `Voice: ${options.voicePersonality}.` : '',
    options.storyboard && options.storyboard !== 'auto' ? `Flow: ${options.storyboard}.` : '',
    options.creativeInstruction ? `Customer direction (verbatim): ${options.creativeInstruction}` : '',
  ].filter(Boolean).join(' ');
  const ending = spoken
    ? cta
      ? candidate === 'B'
        ? `CTA once: "${cta}". Start ~11s, end ~13s; no repeat/tail speech. ${mode === 'spoken_presenter' ? 'Presenter settles; smile if visible.' : 'Hands settle.'}`
        : candidate === 'C'
          ? `One complete CTA: "${cta}" ends speech ~13s. Then visual-only to 15s: no voice/lip-sync; room sound. ${mode === 'spoken_presenter' ? 'Presenter settles; smile if visible.' : 'Hands settle.'}`
          : `Final CTA once: "${cta}". End by ~13s; no more words. ${mode === 'spoken_presenter' ? 'Presenter settles; smile if visible.' : 'Hands settle.'}`
      : 'No CTA selected; do not invent one.'
    : cta ? '' : 'End with a natural physical settle; no speech.';
  const parts = [
    { kind: 'global', text: '15s 9:16 UGC. Nexabot writes hook and speech.' },
    { kind: 'style', text: `[${director.id}] ${director.concept}` },
    { kind: 'global', text: `${references} Keep product/label/colour/avatar; no source UI/layout.` },
    { kind: 'global', text: '1x; compact product 8-12% frame, max 15%; no close-up. Real scale; unseen contents closed.' },
    { kind: 'global', text: "Label purpose/ingredients/use and category context guide buyer need, supported benefit and angle. Label claims aren't proof. No packaging monologue, fake self-use/reviews/sales, cures, guarantees or false facts." },
    { kind: 'global', text: 'Daylight, true whites, natural motion; no sharpening.' },
    { kind: 'global', text: modesty },
    hasAvatar ? { kind: 'niqab', text: 'Niqab: full cover; friendly eyes.' } : { kind: 'niqab', text: '' },
    director.id === 'NX25' ? { kind: 'style', text: 'No child actor; garment only.' } : { kind: 'style', text: '' },
    { kind: 'style', text: audioDirective },
    { kind: 'cta', text: ending },
    { kind: 'context', text: context },
  ].filter(part => part.text) as Part[];
  const prompt = parts.map(part => part.text).join(' ');
  const counts = nexabotPromptCounts(prompt);
  const budget: Record<string, number> = { global: 0, style: 0, cta: 0, context: 0, niqab: 0, separators: parts.length - 1, ...counts };
  for (const part of parts) budget[part.kind] += new TextEncoder().encode(part.text).length;
  const errors: string[] = [];
  if (!spoken && cta) errors.push('CTA bersuara tidak serasi dengan mod audio tanpa suara. Pilih mod suara atau Tiada CTA.');
  if (Math.max(counts.utf16, counts.codePoints, counts.utf8Bytes) > NEXABOT_VIDEO_PROMPT_MAX_CHARS) {
    errors.push(`Arahan video melebihi had Nexabot ${NEXABOT_VIDEO_PROMPT_MAX_CHARS} aksara (UTF-16 ${counts.utf16}, Unicode ${counts.codePoints}, UTF-8 ${counts.utf8Bytes}). Pendekkan arahan atau fakta; tiada teks dipotong.`);
  }
  return { prompt, audioDirective, errors, budget };
}
