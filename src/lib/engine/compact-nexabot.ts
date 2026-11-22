import type { ProductProfile } from './types';
import type { CompilerOptions } from './compiler';
import type { StyleDirectorSpec } from './style-directors';
import { resolveEffectiveAudioMode } from './style-directors';
import { resolveCtaPhrase } from './cta-control';
import { getBuiltInScene } from '../personalization/config';

// Owner-confirmed current Nexabot video-prompt limit. Count the entire submitted string.
export const NEXABOT_VIDEO_PROMPT_MAX_CHARS = 1000;

export function compileCompactNexabotPrompt(
  product: ProductProfile,
  director: StyleDirectorSpec,
  options: CompilerOptions,
  isMuslimah: boolean,
  isHandOnly: boolean,
): { prompt: string; audioDirective: string; errors: string[] } {
  const mode = resolveEffectiveAudioMode(director, options.audioTreatment);
  const spoken = mode === 'spoken_presenter' || mode === 'off_camera_voiceover';
  const cta = resolveCtaPhrase(options.callToAction || 'none', options.customCta || '');
  const hasAvatar = Boolean(options.avatarName);
  const hasBackground = Boolean(options.backgroundName);
  const duplicatedProduct = Number(hasAvatar) + Number(hasBackground) < 2;
  const references = duplicatedProduct
    ? `Refs 1&2: same product${hasAvatar ? '; 3 avatar' : hasBackground ? '; 3 background' : ''}.`
    : 'Refs: 1 product, 2 avatar, 3 background.';
  const audioDirective = mode === 'spoken_presenter'
    ? 'Presenter: lively, natural BM Malaysia.'
    : mode === 'off_camera_voiceover'
      ? 'Lively off-camera BM Malaysia voice; no talking face.'
      : mode === 'asmr'
        ? 'Only synchronized handling ASMR; no speech.'
        : mode === 'ambient'
          ? 'Only natural ambience; no speech.'
          : 'No speech or lip-sync.';
  const modesty = isMuslimah
    ? isHandOnly
      ? 'Covered wrists and forearms; modest hands.'
      : 'Muslimah: hijab covers hair, neck, chest; loose opaque clothes, wrists covered.'
    : 'Modest everyday clothing.';
  const selectedScene = getBuiltInScene(options.builtInSceneId);
  const productName = product.name.trim();
  const usefulProductName = productName !== 'the uploaded product image'
    && productName !== 'uploaded image'
    && !/\.(?:jpe?g|png|webp|heic)$/i.test(productName);
  const extras = [
    usefulProductName ? `Product name: ${productName}.` : '',
    product.usageContext ? `Customer context: ${product.usageContext}.` : '',
    ...(product.observedPhysicalFacts || []).map((fact) => `Visible fact: ${fact}.`),
    ...(product.confirmedFeatures || []).map((fact) => `Customer fact: ${fact}.`),
    selectedScene && !hasBackground ? `Scene: ${selectedScene.directive}.` : '',
    options.niche && options.niche !== 'auto' ? `Niche: ${options.niche}.` : '',
    options.voicePersonality && options.voicePersonality !== 'auto' ? `Voice: ${options.voicePersonality}.` : '',
    options.storyboard && options.storyboard !== 'auto' ? `Flow: ${options.storyboard}.` : '',
    options.creativeInstruction ? `Customer direction (verbatim): ${options.creativeInstruction}` : '',
  ].filter(Boolean);
  const parts = [
    '15s 9:16 Malaysian affiliate phone video. Nexabot creates the hook, story, speech and actions; no script supplied.',
    `[STYLE ${director.id}] ${director.concept}`,
    references,
    'Identity refs, not start frames; no screenshot UI. Preserve product shape, label, colour. Compact products 8–12% frame height, max 15% lifted; larger products real scale. No zoom. Keep unseen contents closed; invent nothing inside.',
    'No unsupported results or fake self-use. Neutral daylight, true whites, natural motion.',
    modesty,
    director.id === 'NX25' ? 'No child actor; show garment only.' : '',
    hasAvatar ? 'If niqab in avatar, keep it throughout.' : '',
    audioDirective,
    spoken
      ? cta
        ? `Final spoken CTA once before cut: “${cta}” No speech after.`
        : 'No CTA selected; do not invent one.'
      : cta ? 'Selected CTA cannot be spoken in this silent audio mode.' : '',
    ...extras,
  ].filter(Boolean);
  const prompt = parts.join(' ');
  const errors: string[] = [];
  if (!spoken && cta) errors.push('CTA bersuara tidak serasi dengan mod audio tanpa suara. Pilih mod suara atau Tiada CTA.');
  if (prompt.length > NEXABOT_VIDEO_PROMPT_MAX_CHARS) {
    errors.push(`Arahan video melebihi had Nexabot ${NEXABOT_VIDEO_PROMPT_MAX_CHARS} aksara (${prompt.length}). Pendekkan arahan kreatif atau fakta produk sebelum jana; tiada teks dipotong.`);
  }
  return { prompt, audioDirective, errors };
}
