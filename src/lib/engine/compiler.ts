/**
 * AFFIMATIK by Pawarna — REAL V3 direct-provider prompt compiler
 * Translates Product Profile + Video Style + Scene Plan into Provider-Specific Payloads
 * 
 * AffiMatik compiles a canonical, style-specific masterprompt and references.
 * Nexabot owns product interpretation, creative concept, dialogue, acting and media.
 */

import { ProductProfile, ScenePlan, CompiledGenerationPrompt } from './types';
import { VideoStyle } from '../styles/types';
import { getBuiltInScene } from '../personalization/config';
import {
  STYLE_DIRECTORS,
  compileEffectiveAudioDirective,
  compileStyleDirector,
  resolveEffectiveAudioMode,
} from './style-directors';
import {
  CtaMode,
  resolveCtaPhrase,
  validateCustomCta,
  validateCustomerFact,
} from './cta-control';

export const GEMS_PROMPT_VERSION = 'affimatik-real-v3-creative-freedom-no-fake-self-use';

export const NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10 = [
  '[REAL V3 NATIVE SPEECH CONTRACT]',
  'Nexabot alone creates the product-specific hook, story, dialogue, selling angle, FOMO, Malaysian delivery and visual actions. AffiMatik supplies no script, benefit sentence, FOMO sentence, hook wording or per-product creative prompt.',
  'Use conversational Bahasa Melayu Malaysia with spontaneous affiliate energy, natural pauses, varied emphasis and clear product and CTA pronunciation. Keep one consistent speaker and avoid announcer cadence, forced slang or mechanical word-by-word delivery. Choose the wording and persuasive structure freely for the product and selected style.',
  'Never fabricate the presenter’s personal use, testing, consumption or personal result. Ordinary visible handling, possession and demonstration are not automatically personal-use testimonials.',
  'Fit the dialogue naturally within 15 seconds. Aim to finish speech around 12.5–13 seconds where practical, leaving roughly 1.5–2 seconds for a natural closing beat. Choose fewer spoken points when needed, not rush or start a sentence that cannot finish; CTA completion takes priority over another selling point. Speak the selected CTA once as the complete final utterance without fading an unfinished word or adding speech afterward.',
].join(' ');

export const MASTERPROMPT_PRIORITY_SYSTEM_V10 = [
  '[REAL V3 COMPACT GLOBAL CONTRACT]',
  'Create one continuous 15-second vertical 9:16 live-action affiliate video. Nexabot owns product interpretation, concept, scene details, hook, dialogue, voice, action and final video.',
  'Follow the selected style identity and effective audio mode. Preserve the uploaded product, reference roles, realistic physics, selected CTA and modesty requirements.',
  'Do not reproduce marketplace UI, the source screenshot composition, fake overlays or unsupported product claims.',
].join(' ');

export const NEXABOT_PRODUCT_UNDERSTANDING_V10 = [
  '[NEXABOT NATIVE PRODUCT INTERPRETATION]',
  'Inspect the uploaded image and independently recognize the product, readable identity, visible characteristics and ordinary category function. Do not assume live web research.',
  'Independently create the concept, hook, selling angle, storytelling, FOMO, dialogue and actions within the selected style. AffiMatik does not preselect benefits or promotional claims. Never present inference as verified research, and never fabricate personal-use experience or personal results.',
].join(' ');

export const MALAYSIAN_AFFILIATE_VOICE_DNA_V6 = [
  '[PAWARNA CREATIVE DNA]',
  'Sound like a real Malaysian affiliate speaking spontaneously to another person: persuasive, product-specific and alive, never corporate or scripted.',
  'Nexabot chooses the hook, wording, rhythm and selling approach. Preserve the selected style’s friendly, energetic, calm, premium, faceless or practical personality without reusing one universal catchphrase.',
].join(' ');

export const HUMAN_REALISM_MASTERPROMPT_V8 = [
  '[REALISTIC HUMAN AND PRODUCT PHYSICS]',
  'Use ordinary Malaysian creator behaviour, natural gaze, blinking, breathing and purposeful restrained gestures. Keep face, hands, grip, object weight, geometry, labels, contact shadows and background stable and physically believable.',
  'Use plausible smartphone 1x framing and everyday light; no floating camera, unnecessary dramatic motion, morphing, plastic skin or artificial sharpening. Natural stillness is allowed.',
].join(' ');

const NIQAB_REFERENCE_LOCK = '[ABSOLUTE NIQAB REFERENCE LOCK] If the supplied presenter reference wears a niqab, preserve the same opaque niqab over nose, mouth, lips, chin and lower face in every frame, including speech and ending. Never remove, lift, replace, make transparent or reveal the face for lip-sync or smiling; the reference takes priority over generic wardrobe styling. After the CTA, stop speaking and convey a friendly expression only through visible eyes while keeping full coverage.';

const SPEAKING_AVATAR_ENDING = '[SPEAKING AVATAR ENDING] After the final CTA, stop speech and mouth movement; relax into a subtle friendly expression and comfortable pose until the cut. No new gesture, exaggerated smile or frozen animation loop. For a niqab reference, follow the absolute niqab lock instead of showing lips or teeth.';

const FACELESS_ENDING = '[FACELESS ENDING] Finish narration if selected, then hold a stable natural product presentation without introducing a face or new action.';

export const PAWARNA_TRUE_COLOR_REAL_V2 = [
  '[TRUE-WHITE REAL PHONE COLOUR]',
  'Use bright neutral everyday lighting and accurate natural skin and product colours. Genuinely white surfaces stay white; cream, beige, amber or coloured products keep their real source colour.',
  'Avoid global yellow, cream, amber, sepia or muddy grading, synthetic HDR glow, skin smoothing and artificial sharpening. Keep the style-specific environment.',
].join(' ');

export const PAWARNA_HUMAN_VOICE_REAL_V2 = [
  '[NATURAL MALAYSIAN VOICE]',
  'Use authentic contemporary Bahasa Melayu Malaysia with conversational sentence structure, natural emphasis, varied pace and age-appropriate delivery.',
  'Nexabot freely chooses natural local wording, reactions, rhythm and persuasive energy for the selected style. Do not force a universal catchphrase, banned-word list or identical presenter personality. Nexabot remains the sole writer of every spoken sentence.',
].join(' ');

const VOICE_PERSONALITY_DIRECTIONS: Record<string, string> = {
  friendly: 'Warm and relaxed, like speaking to a friend; soft hook, easy sentence linking and a small reassuring finish.',
  energetic: 'Start quickly with lively but controlled energy, vary pace after the hook and emphasize only the useful product point; never shout.',
  calm: 'Low-pressure and measured with clear articulation, soft pauses and an unhurried CTA; never monotone.',
  confident: 'Direct and convincing with a firm hook and clean ending, but still conversational and never like a commercial announcer.',
  helpful: 'Naturally offer one useful buying consideration, with a caring matter-of-fact tone rather than a warning or disclaimer.',
  premium: 'Polished and composed with restrained warmth and precise articulation, while remaining a real phone creator rather than luxury-ad narration.',
};

function productScaleDirective(product: ProductProfile): string {
  void product;
  return '[PRODUCT SCALE LOCK] Keep believable real-world scale against hands, body, furniture and surroundings. Compact handheld products should occupy approximately 12–18% of frame height, preferably about 15%; larger products retain their plausible real dimensions. Never enlarge for emphasis or label readability. Keep scale stable while moving.';
}

/**
 * Internal Provider to AffiMatik White-Label Display Name Mapping
 */
export function getEngineDisplayName(engine: 'nexabot' | 'runninghub' | string): string {
  if (engine === 'nexabot') return 'AffiMatik Voice (15s)';
  if (engine === 'runninghub') return 'AffiMatik Motion (15s)';
  return 'AffiMatik Engine';
}

export function getEngineDescription(engine: 'nexabot' | 'runninghub' | string): string {
  if (engine === 'nexabot') return 'Video pertuturan Bahasa Melayu santai semula jadi (15 saat)';
  if (engine === 'runninghub') return 'Video visual realistik, pergerakan lembut, ASMR / audio bersesuaian (15 saat)';
  return 'Enjin penjanaan video AffiMatik';
}

export interface CompilerOptions {
  callToAction?: CtaMode;
  isMuslimahModest?: boolean;
  /** Historical input only. REAL V3 never injects it into a new automatic job. */
  customScript?: string;
  customCta?: string;
  /** Historical input only. Normalized to provider-owned dialogue in REAL V3. */
  scriptMode?: 'smart' | 'custom' | 'provider_auto' | string;
  creativeInstruction?: string;
  imageRole?: 'reference' | 'start_frame';
  variationIndex?: number;
  productionProfile?: 'ugc_creator' | 'studio_commercial';
  avatarName?: string;
  backgroundName?: string;
  builtInSceneId?: string;
  niche?: string;
  voicePersonality?: string;
  storyboard?: string;
  /** Historical input only. Ignored by the REAL V3 compiler. */
  scriptVariant?: 'style' | 'direct' | 'helpful' | 'short' | 'story' | string;
  audioTreatment?: 'voiceover' | 'ambient' | 'asmr';
}

export interface PromptPreviewResult {
  provider: 'nexabot' | 'runninghub';
  engineDisplayName: string;
  durationSeconds: number;
  creditCost: number;
  spokenScript: null;
  visualSummary: string;
  sceneEnvironment: string;
  cameraProfile: string;
  modestyRules: string;
  productIdentityRules: string;
  audioDirective: string;
  promptVersion: string;
}

interface UniversalPromptModules {
  criticalContract: string;
  productUnderstanding: string;
  humanPerformance: string;
  safetyLocks: string;
}

export class DynamicPromptCompiler {
  /**
   * Deterministic preflight validation with sanitized white-label error messages
   */
  static validatePreflight(
    product: ProductProfile,
    style: VideoStyle,
    options?: CompilerOptions
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Engine and duration validation
    if (style.engine === 'nexabot' && style.durationSeconds !== 15) {
      errors.push(`Gaya AffiMatik Voice (${style.id}) mesti tepat 15 saat.`);
    }
    if (style.engine === 'runninghub' && style.durationSeconds !== 15) {
      errors.push(`Gaya AffiMatik Motion (${style.id}) mesti tepat 15 saat.`);
    }

    // Hard Rule: Motion 15s styles must NOT have spoken voiceover
    if (style.engine === 'runninghub' && style.audioMode !== 'no_speech' && style.audioMode !== 'ambient') {
      errors.push(`Gaya AffiMatik Motion (${style.id}) tidak menyokong suara percakapan.`);
    }

    if (style.engine === 'nexabot') {
      if (options?.callToAction === 'custom') errors.push(...validateCustomCta(options?.customCta || ''));
      for (const fact of product.confirmedFeatures || []) errors.push(...validateCustomerFact(fact));
      for (const fact of product.observedPhysicalFacts || []) errors.push(...validateCustomerFact(fact));
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generates a comprehensive customer-facing preview before launching generation
   */
  static previewPrompt(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions = {}
  ): PromptPreviewResult {
    const isMuslimah = options.isMuslimahModest ?? style.modestyLock;
    const engineDisplayName = getEngineDisplayName(style.engine);

    let modestyRules = 'Pemakaian santai kontemporari sopan bersesuaian khalayak Malaysia.';
    if (isMuslimah) {
      if (style.category === 'hand_demo' || style.category === 'product_handling' || style.category === 'pov' || style.id.startsWith('RH')) {
        modestyRules = 'Satu tangan sahaja dengan pergelangan tangan bertutup lengan baju, tiada cincin/gelang/pengilat kuku.';
      } else {
        modestyRules = 'Tudung labuh menutup rambut, leher dan dada; pakaian longgar berlengan panjang hingga pergelangan.';
      }
    }

    const visualSummary = `Satu babak visual berterusan ${style.durationSeconds} saat. ${scenePlan.primaryAction}. Produk kekal pada skala fizikal dunia sebenar yang munasabah tanpa morphing atau hilang.`;
    const styleDirector = STYLE_DIRECTORS[style.id];
    const effectiveAudioMode = styleDirector ? resolveEffectiveAudioMode(styleDirector, options.audioTreatment) : 'no_speech';
    const previewAudioDirective = effectiveAudioMode === 'ambient'
      ? 'Bunyi persekitaran semula jadi sahaja; tiada dialog, voice-over atau lip-sync.'
      : effectiveAudioMode === 'asmr'
        ? 'Bunyi ASMR fizikal yang segerak sahaja; tiada dialog, voice-over atau lip-sync.'
        : effectiveAudioMode === 'off_camera_voiceover'
          ? 'Nexabot mencipta voice-over Bahasa Melayu Malaysia dari luar kamera; tiada mulut presenter bercakap.'
          : effectiveAudioMode === 'spoken_presenter'
            ? 'Nexabot mencipta dialog Bahasa Melayu Malaysia untuk presenter yang kelihatan dengan lip-sync tepat.'
            : 'Tiada suara pertuturan atau lip-sync.';

    return {
      provider: style.engine,
      engineDisplayName,
      durationSeconds: style.durationSeconds,
      creditCost: style.engine === 'nexabot' ? 10 : 15,
      spokenScript: null,
      visualSummary,
      sceneEnvironment: scenePlan.location,
      cameraProfile: 'Kamera telefon pintar 9:16 menegak, 1x perspektif tanpa sempadan telefon atau mockup bingkai.',
      modestyRules,
      productIdentityRules: `Mengekalkan identiti visual produk ${product.name} (bentuk botol/bungkusan, warna, logo dan label).`,
      audioDirective: style.engine === 'nexabot'
        ? previewAudioDirective
        : 'Tiada suara pertuturan (visual tulen, bunyi persekitaran / ASMR / audio bersesuaian).',
      promptVersion: GEMS_PROMPT_VERSION,
    };
  }

  /**
   * Compiles the complete Creative V6 payload for the specified provider.
   */
  static compile(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions = {}
  ): CompiledGenerationPrompt {
    const preflight = this.validatePreflight(product, style, options);
    const isMuslimah = options.isMuslimahModest ?? style.modestyLock;
    const isHandOnly = style.category === 'hand_demo' || style.category === 'product_handling' || style.category === 'pov' || style.id.startsWith('RH');

    const identityLockDirectives = [
      '[PRODUCT IDENTITY LOCK]',
      `The uploaded image is the authority for “${product.name}”. Preserve its recognizable shape, geometry, packaging, label, logo, colours and visible components consistently.`,
      productScaleDirective(product),
      'No morphing, duplication, missing components, changed label, invented printed detail or floating object. Leave unreadable text indistinct.',
    ].join(' ');

    const hasAvatarReference = Boolean(options.avatarName);
    const hasBackgroundReference = Boolean(options.backgroundName);
    const duplicateProductReference = Number(hasAvatarReference) + Number(hasBackgroundReference) < 2;
    const avatarReferenceIndex = duplicateProductReference ? 3 : 2;
    const backgroundReferenceIndex = hasAvatarReference
      ? (duplicateProductReference ? 3 : 3)
      : (duplicateProductReference ? 3 : 2);
    const ingredientReferenceDirectives = [
      '[REFERENCE ROLE LOCK]',
      duplicateProductReference
        ? 'References 1 and 2 are byte-identical views of one product identity, never two products.'
        : 'Reference 1 is the product identity; remaining references retain their assigned presenter or environment roles.',
      'References are not start frames or composition templates. Build a fresh live-action scene and ignore screenshot UI, prices, ratings, app borders, buttons and source-image decoration.',
    ].join(' ');

    const zeroUiLockDirectives = [
      '[CLEAN VIDEO LOCK]',
      'Full-frame physical 9:16 footage with no marketplace/social UI, phone frame, fake buttons, captions, shopping graphics, decorative sparkles or fabricated watermark. An unavoidable provider watermark is permitted.',
    ].join(' ');

    const realismDirectives = [
      HUMAN_REALISM_MASTERPROMPT_V8,
      PAWARNA_TRUE_COLOR_REAL_V2,
    ].filter(Boolean).join(' ');

    let modestyDirectives = '';
    if (isMuslimah) {
      if (isHandOnly) {
        modestyDirectives = [
          '[SHARIAH MODESTY LOCK — HAND DEMO]',
          'Use the style-required number of naturally proportioned adult hands. Sleeves cover wrists and forearms throughout; no rings, bracelets, nail polish or artificial nails.',
        ].join(' ');
      } else {
        modestyDirectives = [
          '[SHARIAH MODESTY LOCK — PRESENTER]',
          'Adult Malaysian Muslimah: hijab fully covers hair, neck and chest; clothing is loose and opaque; sleeves cover wrists and forearms throughout. No jewellery or unintended exposure.',
        ].join(' ');
      }
    } else {
      modestyDirectives = '[MODESTY GUIDELINE] Use neat, non-revealing everyday attire appropriate for a general Malaysian audience.';
    }

    const promptModules: UniversalPromptModules = {
      criticalContract: MASTERPROMPT_PRIORITY_SYSTEM_V10,
      productUnderstanding: NEXABOT_PRODUCT_UNDERSTANDING_V10,
      humanPerformance: realismDirectives,
      safetyLocks: [identityLockDirectives, ingredientReferenceDirectives, zeroUiLockDirectives, modestyDirectives].join(' '),
    };

    // Route to provider compiler
    if (style.engine === 'runninghub') {
      return this.compileRunningHub(
        product,
        style,
        scenePlan,
        options,
        promptModules,
        preflight
      );
    } else {
      return this.compileNexabot(
        product,
        style,
        scenePlan,
        options,
        promptModules,
        preflight
      );
    }
  }

  /**
   * Nexabot Compiler (AffiMatik Voice, 15s, Malaysian Malay Spoken Dialogue)
   */
  private static compileNexabot(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions,
    promptModules: UniversalPromptModules,
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    const selectedCta = resolveCtaPhrase(options.callToAction || 'none', options.customCta || '');
    const styleDirector = STYLE_DIRECTORS[style.id];
    if (!styleDirector) {
      preflight.errors.push(`Gaya ${style.id} tiada masterprompt rasmi.`);
      preflight.isValid = false;
    }
    const effectiveAudioMode = styleDirector
      ? resolveEffectiveAudioMode(styleDirector, options.audioTreatment)
      : 'no_speech';
    const hasSpeech = effectiveAudioMode === 'spoken_presenter' || effectiveAudioMode === 'off_camera_voiceover';
    const styleSpecificPrompt = styleDirector ? compileStyleDirector(styleDirector, product.name) : '';
    const effectiveAudioDirective = styleDirector
      ? `[AUTHORITATIVE EFFECTIVE AUDIO MODE] ${compileEffectiveAudioDirective(styleDirector, effectiveAudioMode)}`
      : '[AUTHORITATIVE EFFECTIVE AUDIO MODE] Effective audio mode: NO SPEECH.';
    const audioDirective = effectiveAudioMode === 'ambient'
      ? 'Natural room ambience only; no speech, voiceover, narration or lip-sync.'
      : effectiveAudioMode === 'asmr'
        ? 'Natural synchronized product-handling ASMR only; no speech, voiceover, narration or lip-sync.'
        : effectiveAudioMode === 'spoken_presenter'
          ? 'Visible presenter creates original product-specific Malaysian Malay dialogue with accurate lip-sync.'
          : effectiveAudioMode === 'off_camera_voiceover'
            ? 'Off-camera narrator creates original product-specific Malaysian Malay dialogue; no visible mouth speaks.'
            : 'No spoken dialogue, voiceover, narration or lip-sync.';
    const productContextDirective = product.usageContext?.trim()
      ? `Customer-confirmed usage context: “${product.usageContext.trim()}”. Use it only when compatible with the product image and selected style.`
      : 'No customer-confirmed usage context. Nexabot chooses a believable Malaysian setting from the image, recognized category and selected style; use a neutral everyday setting when uncertain.';
    const observedPhysicalFacts = (product.observedPhysicalFacts || []).map((fact) => fact.trim()).filter(Boolean).slice(0, 10);
    const customerConfirmedFacts = (product.confirmedFeatures || []).map((fact) => fact.trim()).filter(Boolean).slice(0, 10);
    const unsupportedClaims = [...(product.unknownFields || []), ...(product.prohibitedClaims || [])].map((fact) => fact.trim()).filter(Boolean).slice(0, 20);
    const productEvidenceContract = [
      '[PRODUCT FACT BOUNDARY]',
      `Customer-supplied identity metadata: “${product.name}”; category: “${product.category}”. Verify identity against the image. Category identifies ordinary function only and proves no result or quality.`,
      observedPhysicalFacts.length
        ? `Customer-supplied visible facts: ${observedPhysicalFacts.map((fact) => `“${fact}”`).join('; ')}.`
        : 'No customer-supplied visible facts.',
      customerConfirmedFacts.length
        ? `Explicit customer facts: ${customerConfirmedFacts.map((fact) => `“${fact}”`).join('; ')}. They are context, not prewritten dialogue and not permission to infer another claim.`
        : 'No explicit customer fact was supplied. AffiMatik supplies no benefit, hook, FOMO or selling claim; Nexabot creates the product-specific presentation from the image and style context.',
      unsupportedClaims.length
        ? `Unverified customer metadata: ${unsupportedClaims.map((fact) => `“${fact}”`).join('; ')}. Do not present it as customer-confirmed fact or verified research.`
        : 'No additional customer-confirmed product facts were supplied.',
    ].join(' ');

    const selectedScene = getBuiltInScene(options.builtInSceneId);
    const hasAvatarReference = Boolean(options.avatarName);
    const hasBackgroundReference = Boolean(options.backgroundName);
    const duplicateProductReference = Number(hasAvatarReference) + Number(hasBackgroundReference) < 2;
    const avatarReferenceIndex = duplicateProductReference ? 3 : 2;
    const backgroundReferenceIndex = hasAvatarReference ? 3 : (duplicateProductReference ? 3 : 2);
    const personalizationDirectives = [
      '[CUSTOMER CONFIGURATION]',
      duplicateProductReference
        ? 'References 1 and 2 are identical copies of one product identity; never create two products.'
        : 'Reference 1 is the product identity.',
      options.avatarName
        ? `Reference ${avatarReferenceIndex} is presenter identity “${options.avatarName}”; preserve the adult face, skin tone and modest appearance without copying its background.`
        : 'No presenter reference; create an adult Malaysian presenter only if the style needs one.',
      options.backgroundName
        ? `Reference ${backgroundReferenceIndex} is environment “${options.backgroundName}”; use its setting only, never its objects as product or presenter.`
        : selectedScene
          ? `Customer-selected environment: ${selectedScene.directive}`
          : '',
      options.niche && options.niche !== 'auto' ? `Customer niche: ${options.niche}.` : '',
      options.voicePersonality && options.voicePersonality !== 'auto' ? `Voice personality: ${options.voicePersonality}. ${VOICE_PERSONALITY_DIRECTIONS[options.voicePersonality] || ''}` : '',
      options.storyboard && options.storyboard !== 'auto' ? `Storyboard preference: ${options.storyboard}.` : '',
    ].filter(Boolean).join(' ');

    const commonTruthfulness = [
      '[NO FAKE SELF-USE TESTIMONIAL — STRICT]',
      'Never state or imply that the presenter personally used, tried, tested, consumed, applied or experienced results from the product unless that experience was explicitly supplied by the customer as true.',
      'Never invent first-person outcomes such as a problem being solved or the product working for the presenter. Ordinary product handling, wearing, styling or demonstration is allowed and is not automatically a personal-use testimonial.',
      'Outside this strict rule, Nexabot retains broad freedom to create product-relevant hooks, storytelling, selling angles, subjective enthusiasm and FOMO while preserving the visible product identity and customer-selected style.',
    ].join(' ');

    const providerDialogueDirective = !hasSpeech
      ? [
          `[SOUND-ONLY EXECUTION CONTRACT]`,
          effectiveAudioMode === 'ambient'
            ? 'Create only believable low-level room ambience that matches the visible environment.'
            : effectiveAudioMode === 'asmr'
              ? 'Create only subtle, physically synchronized product-handling sounds from the visible grip, contact and placement.'
              : 'Create no dialogue, narration or lip-sync.',
          'Strictly no spoken dialogue, no voiceover, no lip-sync speech, no music and no artificial sound effects. Do not narrate the hand, camera, packaging or movement.',
        ].join(' ')
      : [
          MALAYSIAN_AFFILIATE_VOICE_DNA_V6,
          PAWARNA_HUMAN_VOICE_REAL_V2,
          '[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]',
          `Nexabot independently creates the ${style.id} hook, dialogue, selling approach and visual actions from the product image and customer facts. AffiMatik provides no spoken sentences.`,
          selectedCta ? `Customer CTA: “${selectedCta}”. Speak it naturally once as the final utterance, fully before the cut, with no later word or repetition.` : 'Customer selected no CTA. Do not invent one.',
          options.creativeInstruction ? 'Preserve the customer-authored Creative Directive unchanged as direction; do not quote it automatically as dialogue.' : '',
        ].filter(Boolean).join(' ');

    const endingDirective = !hasSpeech
      ? ''
      : effectiveAudioMode === 'spoken_presenter'
        ? [SPEAKING_AVATAR_ENDING, hasAvatarReference ? NIQAB_REFERENCE_LOCK : ''].filter(Boolean).join(' ')
        : FACELESS_ENDING;

    const criticalContract = [
      promptModules.criticalContract,
      hasSpeech ? NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10 : '',
    ].filter(Boolean).join(' ');
    const productAndContext = [
      promptModules.productUnderstanding,
      productEvidenceContract,
      productContextDirective,
      personalizationDirectives,
      options.creativeInstruction ? `Customer Creative Directive (verbatim): ${options.creativeInstruction}` : '',
    ].filter(Boolean).join(' ');
    const visualPrompt = [
      criticalContract,
      styleSpecificPrompt,
      productAndContext,
      promptModules.humanPerformance,
      effectiveAudioDirective,
      providerDialogueDirective,
      endingDirective,
      promptModules.safetyLocks,
      commonTruthfulness,
    ].filter(Boolean).join(' ');
    const fullPayload = visualPrompt;

    return {
      provider: 'nexabot',
      providerPrompt: fullPayload,
      visualPrompt,
      spokenScript: undefined,
      continuityAnchor: product.name,
      audioDirective,
      safetyRules: [
        `AffiMatik Voice (15s) effective audio mode: ${effectiveAudioMode}`,
        'AffiMatik REAL V3 compact provider contract enforced',
        'No Indonesia loanwords or slang',
        'Zero UI, no TikTok logo, no phone frame',
        'No unverified medical or cosmetic claims',
        'Product Identity Max Lock enforced',
        'Shariah Modesty Lock V5 enforced',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
      promptVersion: GEMS_PROMPT_VERSION,
    };
  }

  /**
   * RunningHub Compiler (AffiMatik Motion, 15s, Continuous Visual Scene, No Spoken Dialogue)
   */
  private static compileRunningHub(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions,
    promptModules: UniversalPromptModules,
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    // 15-second creative timeline progression (0-4s establish, 4-10s authentic action, 10-15s hold and conclude)
    const timelineGuideline = [
      'Timing Structure: One continuous 15-second physical shot.',
      '0s to 4s: Establish the product naturally in the setting with clear label visibility.',
      '4s to 10s: One simple authentic physical action matching the official style definition.',
      '10s to 15s: Hold naturally and conclude smoothly without abrupt cuts or sudden movements.',
    ].join(' ');

    const styleDirector = STYLE_DIRECTORS[style.id];
    if (!styleDirector) {
      preflight.errors.push(`Gaya ${style.id} tiada masterprompt rasmi.`);
      preflight.isValid = false;
    }
    const styleSpecificPrompt = styleDirector ? compileStyleDirector(styleDirector, product.name) : '';
    const contextDirective = product.usageContext?.trim()
      ? `Customer-confirmed usage context: ${product.usageContext.trim()}.`
      : 'No customer-confirmed setting exists. Choose a neutral or category-grounded physical setting without assuming a kitchen, desk, bedroom or bathroom.';

    const visualPrompt = [
      promptModules.criticalContract,
      styleSpecificPrompt,
      promptModules.productUnderstanding,
      contextDirective,
      timelineGuideline,
      promptModules.humanPerformance,
      promptModules.safetyLocks,
      options.creativeInstruction ? `Creative Directive: ${options.creativeInstruction}` : '',
      'Audio: Purely silent visuals, natural room ambience, packaging sounds or gentle ASMR background sound only. Strictly NO spoken dialogue and NO lip-sync movement.',
    ].filter(Boolean).join(' ');

    return {
      provider: 'runninghub',
      providerPrompt: visualPrompt,
      visualPrompt,
      continuityAnchor: `${product.name} (steady frame hold at 14.8s mark)`,
      audioDirective: 'No spoken dialogue or lip-sync movements (Visual showcase, ambient/ASMR sound only).',
      safetyRules: [
        'AffiMatik Motion (15s) visual realism showcase',
        'GEMS V5 Masterprompt Lock enforced',
        'No spoken voiceover or dialogue',
        'Zero UI, no TikTok logo, no phone frame',
        'Realistic physical movement without morphing',
        'Product Identity Max Lock enforced',
        'Shariah Modesty Lock V5 enforced',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
      promptVersion: GEMS_PROMPT_VERSION,
    };
  }
}
