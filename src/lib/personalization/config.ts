import { findOfficialAvatar, findOfficialBackground } from './official-assets';
import { CTA_MODES, SCRIPT_MODES, SCRIPT_VARIANTS, CtaMode, ScriptMode, ScriptVariant } from '../engine/script-control';

export const BUILT_IN_SCENES = [
  { id: 'scene:home', name: 'Rumah', directive: 'an ordinary bright Malaysian home with lived-in details' },
  { id: 'scene:kitchen', name: 'Dapur', directive: 'a clean practical Malaysian home kitchen suited to a real product demonstration' },
  { id: 'scene:vanity', name: 'Meja Solek', directive: 'a tidy naturally lit vanity area with realistic beauty-use context' },
  { id: 'scene:office', name: 'Pejabat', directive: 'a believable modern Malaysian desk or small-office setting' },
  { id: 'scene:gaming', name: 'Bilik Gaming', directive: 'a realistic home gaming setup without floating UI or fake screens' },
  { id: 'scene:garage', name: 'Garaj', directive: 'a tidy practical residential garage suited to hands-on product use' },
  { id: 'scene:car', name: 'Dalam Kereta', directive: 'a stationary, safely parked Malaysian car interior; never show unsafe driving' },
  { id: 'scene:studio', name: 'Studio Ringkas', directive: 'a restrained creator studio that still looks like authentic smartphone UGC' },
  { id: 'scene:outdoor', name: 'Luar Rumah', directive: 'a believable shaded Malaysian outdoor setting with neutral daylight' },
] as const;

export const NICHE_OPTIONS = ['auto', 'wellness', 'beauty', 'kitchen', 'automotive', 'gadgets', 'home', 'fashion', 'gardening'] as const;
export const VOICE_PERSONALITIES = ['auto', 'friendly', 'confident', 'calm', 'energetic', 'helpful', 'premium'] as const;
export const STORYBOARD_OPTIONS = ['auto', 'conversation', 'problem_demo', 'step_by_step', 'before_after_context', 'q_and_a', 'product_showcase'] as const;
export const CTA_OPTIONS = CTA_MODES;
export const AUDIO_TREATMENTS = ['voiceover', 'ambient', 'asmr'] as const;

export type PersonalizationSettings = {
  styleId: string;
  avatarId: string | null;
  backgroundId: string | null;
  builtInSceneId: string | null;
  niche: typeof NICHE_OPTIONS[number];
  voicePersonality: typeof VOICE_PERSONALITIES[number];
  storyboard: typeof STORYBOARD_OPTIONS[number];
  callToAction: CtaMode;
  scriptMode: ScriptMode;
  scriptVariant: ScriptVariant;
  audioTreatment: typeof AUDIO_TREATMENTS[number];
  customScript: string;
  customCta: string;
  productFact: string;
  isMuslimahModest: boolean;
  creativeInstruction: string;
};

const oneOf = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] =>
  typeof value === 'string' && allowed.includes(value as T[number]) ? value as T[number] : fallback;

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const assetIdOrNull = (value: unknown, type: 'avatar' | 'background'): string | null =>
  typeof value === 'string' && (uuid(value) || (type === 'avatar' ? findOfficialAvatar(value) : findOfficialBackground(value))) ? value : null;

export function sanitizePersonalizationSettings(value: unknown): PersonalizationSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const scene = typeof input.builtInSceneId === 'string' && BUILT_IN_SCENES.some((item) => item.id === input.builtInSceneId)
    ? input.builtInSceneId : null;
  const legacyCta = input.callToAction === 'spoken_button' ? 'click_button'
    : input.callToAction === 'spoken_bio' ? 'check_bio'
      : input.callToAction === 'auto' ? 'none' : input.callToAction;
  return {
    styleId: typeof input.styleId === 'string' && /^[A-Z]{2}\d{2}$/.test(input.styleId) ? input.styleId : 'NX01',
    avatarId: assetIdOrNull(input.avatarId, 'avatar'),
    backgroundId: assetIdOrNull(input.backgroundId, 'background'),
    builtInSceneId: scene,
    niche: oneOf(input.niche, NICHE_OPTIONS, 'auto'),
    voicePersonality: oneOf(input.voicePersonality, VOICE_PERSONALITIES, 'auto'),
    storyboard: oneOf(input.storyboard, STORYBOARD_OPTIONS, 'auto'),
    callToAction: oneOf(legacyCta, CTA_OPTIONS, 'none'),
    scriptMode: oneOf(input.scriptMode, SCRIPT_MODES, 'smart'),
    scriptVariant: oneOf(input.scriptVariant, SCRIPT_VARIANTS, 'style'),
    audioTreatment: oneOf(input.audioTreatment, AUDIO_TREATMENTS, 'voiceover'),
    customScript: typeof input.customScript === 'string' ? input.customScript.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 600) : '',
    customCta: typeof input.customCta === 'string' ? input.customCta.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 80) : '',
    productFact: typeof input.productFact === 'string' ? input.productFact.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 180) : '',
    isMuslimahModest: input.isMuslimahModest !== false,
    creativeInstruction: typeof input.creativeInstruction === 'string' ? input.creativeInstruction.trim().slice(0, 1000) : '',
  };
}

export function getBuiltInScene(id: string | null | undefined) {
  return BUILT_IN_SCENES.find((item) => item.id === id) || null;
}

