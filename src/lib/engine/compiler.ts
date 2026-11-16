/**
 * AFFIMATIK by Pawarna — Creative V6 direct-provider prompt compiler
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

export const GEMS_PROMPT_VERSION = 'pawarna-masterprompt-director-v10.2-product-scale-12-18-cta-timing';

export const NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10 = [
  '[PAWARNA 15-SECOND SPOKEN OUTPUT CONTRACT — OWNER CREATIVE INTENT]',
  'Nexabot independently writes the dialogue; AffiMatik supplies no spoken script.',
  'Create a complete energetic Malaysian affiliate conversation across most of the 15-second clip: a spontaneous audience-relevant hook, natural product introduction, one meaningful supported selling point or buyer benefit, supported FOMO only when evidence exists, then the selected CTA or a complete natural ending.',
  'Use approximately 40–48 spoken Malay words as an initial creative pacing target, not an inflexible limit. Keep the original fast but believable human rhythm; never force an artificial speed-up, robotic compression or a premature silent gap.',
  'Let emphasis, breath, sentence linking and pace vary like a real creator speaking in one take. Preserve persuasive energy and natural imperfection rather than flattening the delivery into cautious category narration.',
  'When a CTA is selected, deliver it conversationally near the natural end and complete it before the clip ends. The CTA is the final spoken utterance: after its last word, add no new word, syllable, phoneme, repetition, thanks, tagline, filler or corrupted speech.',
  'Natural benefit-oriented storytelling is allowed when it follows a recognizable ordinary product purpose or customer-confirmed fact. Never invent an objectively false concrete specification, regulated outcome, price, review count, certification, popularity signal or personal testimonial.',
  'Keep factual safeguards silent. Never turn them into spoken disclaimers, compliance language or generic filler.',
].join(' ');

export const MASTERPROMPT_PRIORITY_SYSTEM_V10 = [
  '[PAWARNA MASTERPROMPT DIRECTOR V10 — PRIORITY SYSTEM]',
  'PRIORITY 0 HARD PRODUCTION CONSTRAINTS: exact supported product identity; correct image-reference roles; valid 15-second vertical 9:16 Nexabot i2v output; zero screenshot UI contamination; no fabricated claims, prices, reviews, medical outcomes or certifications; selected CTA intent; no AffiMatik-authored dialogue.',
  'PRIORITY 1 STYLE IDENTITY: preserve the selected presenter/faceless/POV/hand-led perspective, environment, physical action, emotional tone, buyer-information purpose and audio behaviour. Universal rules may not erase the style identity.',
  'PRIORITY 2 HUMAN REALISM: plausible physical scale, anatomy, grip, weight, gaze, body movement, smartphone optics, ambient environment and natural material rendering; use an ordinary Malaysian voice only when the effective audio mode includes speech.',
  'PRIORITY 3 NATIVE CREATIVE STORYTELLING: Nexabot independently chooses the relevant buyer situation, grounded product point and believable ending. When the effective audio mode includes speech, it also creates the hook, natural Malaysian wording and selected CTA wording.',
  'Resolve conflicts strictly in this priority order.',
].join(' ');

export const NEXABOT_PRODUCT_UNDERSTANDING_V10 = [
  '[NEXABOT NATIVE PRODUCT UNDERSTANDING — PROVIDER OWNS CREATIVE THINKING]',
  'Inspect the actual uploaded product reference. Identify readable brand and product name, recognizable category, ordinary intended purpose and the strongest relevant buyer situation supported by the image, customer context or reliable general product understanding.',
  'Build a believable Malaysian buyer situation specific to this product and selected style. When the authoritative effective audio mode includes speech, independently create original persuasive Bahasa Melayu Malaysia dialogue rather than a generic category description or placeholder such as “kalau tengah survey produk ini, tengok yang ni dulu”. When the mode is Ambient, ASMR or No Speech, create no words or lip-sync.',
  'Use a readable product name naturally when identifiable. Translate one supported function or confirmed fact into a meaningful everyday buyer benefit without claiming a measurable result that the evidence does not establish.',
  'Do not narrate packaging, label visibility, hand movement or camera action unless that detail is materially useful to a buyer.',
  'Image interpretation and model knowledge are not live internet research. Never invent ingredients, efficacy, medical outcomes, certification, price, popularity, review counts, testimonials, discounts or personal experience.',
].join(' ');

export const MALAYSIAN_AFFILIATE_VOICE_DNA_V6 = [
  '[PAWARNA CREATIVE DNA — TEST A OWNER GOLD STANDARD]',
  'Speak like a real Malaysian TikTok affiliate who has just noticed a useful selling angle and immediately shares it with another person: spontaneous, persuasive, product-specific and alive, never corporate, restrained, generic or compliance-led.',
  'Open with an audience-relevant situation or problem that earns attention immediately. Introduce the recognizable product naturally, develop one meaningful supported selling point or everyday buyer benefit, use a short FOMO beat only when the reference or customer context supports it, then flow into the selected CTA.',
  'Use fast but believable Malaysian Malay with irregular emphasis, connected words, small breaths, uneven yet fluent rhythm, natural pitch movement, occasional tiny hesitation and imperfect articulation. It must feel spoken in one take, not read from a script.',
  'Do not pronounce every word with studio perfection. Let some transitions blend naturally, vary speed between phrases and emphasize only the emotionally useful words.',
  'Nexabot chooses authentic local particles and wording from the product and style context. Never mechanically sprinkle eh, haa, weh, korang or tau, and never reuse one catalogue-wide hook or closing.',
  'Keep the selling energy appropriate to the selected style: friendly, confident, excited, story-led, soft-sell or off-camera, without erasing the style’s visual identity.',
  'Natural marketing language and benefit-led storytelling are welcome. Do not invent concrete specifications, regulated health or beauty outcomes, fake prices, unsupported review/sold counts, certifications or personal-use testimony.',
  'Keep factual safeguards internal and silent. Never make the presenter sound like a compliance officer or replace an uncertain detail with formal disclaimer narration.',
  'Deliver the selected CTA naturally once as part of the same conversation. When Tanpa CTA is selected, complete the selling thought naturally without inventing a CTA.',
].join(' ');

export const HUMAN_REALISM_MASTERPROMPT_V8 = [
  '[HUMAN REALISM MASTERPROMPT V8] [REAL HUMAN PERFORMANCE DIRECTOR V8.3]',
  'Create ordinary Malaysian creator behaviour, not polished commercial acting. Use irregular natural blinking, subtle breathing, relaxed jaw movement during pauses and believable facial-muscle transitions.',
  'Do not stare into the lens throughout. Alternate motivated eye contact with one or two brief product glances; never use periodic blinking, repeated nodding, a frozen smile or a frozen final pose.',
  'Maintain believable weight distribution, tiny posture and shoulder adjustments, and hands that react to the object’s plausible real weight. One purposeful gesture is better than decorative repeated motion.',
  'Creator review: alternate naturally between the lens and product, with one small head movement and a restrained hand gesture.',
  'First impression: use one spontaneous micro-reaction such as a slight eyebrow lift or half-smile; never exaggerated surprise.',
  'Question and answer: show a brief thinking expression before the answer, then return gaze naturally to the lens.',
  'Hand demonstration: use a real grip, believable object weight, correct finger contact, stable label and physical contact shadows.',
  'POV: use credible first-person reach and restrained handheld movement, never floating or impossible camera travel.',
  'Lifestyle: perform one small context-relevant action while speaking instead of posing motionless.',
  'Soft sell: relaxed local speaking tone, never a commercial announcer voice or over-rehearsed sales performance.',
  'Use environment-appropriate believable light, natural skin tones, consistent exposure and white balance, authentic material texture and physical shadows. No yellow cast, teal-orange grade, fake glow, excessive sharpening or plastic skin.',
].join(' ');

const EXPANSION_V1_STYLE_IDS = new Set([
  'NX21', 'NX22', 'NX23', 'NX24', 'NX25',
  'NX26', 'NX27', 'NX28', 'NX29', 'NX30',
]);

export const PAWARNA_TRUE_WHITE_PHONE_COLOR_DNA = [
  '[PAWARNA TRUE-WHITE REAL PHONE COLOR DNA — NX21–NX30]',
  'Bright, naturally exposed Malaysian smartphone footage. Neutral daylight-balanced white balance.',
  'White garments, walls, appliances and surfaces remain visually white, not cream or yellow.',
  'Preserve accurate garment, product and skin colours. Fresh, clean everyday exposure with natural contrast.',
  'No global yellow, amber, sepia, muddy brown or desaturated colour cast.',
  'No artificial cinematic colour grading, HDR glow, skin smoothing or additional sharpening.',
  'Keep the selected style’s own physically relevant environment; do not replace every Fashion and Kitchen setting with one generic room.',
].join(' ');

export const EXPANSION_ANTI_AI_MALAYSIAN_VOICE_DNA = [
  '[ANTI-AI MALAYSIAN VOICE — NX21–NX30]',
  'Speak in authentic contemporary Malaysian Malay, like a real creator explaining something spontaneously to a friend.',
  'Use conversational sentence structure, natural emphasis, varied pace and meaningful reactions to the visible product. Avoid formulaic promotional phrasing and forced local slang.',
  'Do not habitually use filler words or stock phrases such as “lah”, “la”, “memang best”, “game changer”, “worth it”, “wajib cuba”, “yang paling best” or “hari ini saya nak kongsikan”.',
  'Do not repeatedly open videos with the same catchphrase, and do not replace these phrases with a new universal catchphrase.',
  'Keep delivery natural and age-appropriate for the selected style; not every presenter should sound like a teenager.',
  'Nexabot remains the sole writer of every spoken sentence; AffiMatik supplies voice direction, not a script.',
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
  const category = `${product.category} ${product.packagingFormat}`.toLowerCase();
  const categoryGuide = /serum|beauty|cosmetic|bottle/.test(category)
    ? 'Treat a serum or cosmetic bottle as a small palm-sized retail object unless the customer supplied other dimensions.'
    : /supplement|health|wellness/.test(category)
      ? 'Treat a retail supplement bottle or box as a normal hand-held pharmacy-sized object, never a giant jar.'
      : /lamp|lighting/.test(category)
        ? 'Keep a desk lamp plausibly sized beside furniture, a laptop and the presenter.'
        : /organizer|kitchen|household/.test(category)
          ? 'Keep the object plausibly sized against hands, counters, shelves and nearby household items.'
          : 'Use conservative category-appropriate real-world scale against hands, furniture and the human body.';
  return `[PRODUCT SCALE LOCK] ${categoryGuide} The product must appear naturally small and physically believable relative to a real human hand, tabletop and surrounding environment. For compact handheld products such as serum bottles, supplement bottles, cosmetics, sprays and similar products, target approximately 12–18% of the full video frame height, preferably approximately 15%. Never artificially enlarge the product for emphasis or use oversized hero-product framing. Maintain believable hand-to-product proportions and preserve realistic size when the product is lifted or moved. For larger products, preserve believable real-world dimensions rather than forcing them into the compact-product target. Preserve one consistent physical size throughout. Product identity, packaging, logos, labels, colours and shape must remain unchanged. Never enlarge the product for label readability, never infer exact dimensions from a screenshot, and use realistic grip, contact shadows and perspective.`;
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
  /** Historical input only. V10 never injects it into a new automatic job. */
  customScript?: string;
  customCta?: string;
  /** Historical input only. Normalized to provider-owned dialogue in V10. */
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
  /** Historical input only. Ignored by the V10 compiler. */
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

    // -------------------------------------------------------------------------
    // MASTERPROMPT LOCK V6 — LAYER 1: UNIVERSAL MANDATORY LOCKS
    // -------------------------------------------------------------------------

    // 1. PRODUCT IDENTITY MAX LOCK
    const identityLockDirectives = [
      `[PRODUCT IDENTITY MAX LOCK]`,
      `The uploaded product image is an authoritative identity reference for "${product.name}".`,
      `Preserve exact product geometry, shape, proportions, cap, material, logo, brand, label, typography, and packaging colour with stable consistency across all frames.`,
      productScaleDirective(product),
      `Strictly NO product morphing, NO duplicate products, NO changing labels, NO changing packaging colours, NO missing caps, NO oversized containers, NO floating objects, NO artificial product rotation, NO sudden disappearance, NO unexpected object replacement.`,
      `Never add a printed volume, size, specification, certification, ingredient, icon or word that is absent from the reference image. If small text is unreadable, leave it indistinct instead of inventing letters or numbers.`,
      `[SCREENSHOT CONTAMINATION CONTROL] If the reference is a marketplace or social screenshot, isolate the physical product identity and ignore prices, ratings, reviews, usernames, comments, buttons, navigation bars, shopping icons, seller UI and app borders. Never reproduce the screenshot or phone screen in the footage.`,
    ].join(' ');

    const hasAvatarReference = Boolean(options.avatarName);
    const hasBackgroundReference = Boolean(options.backgroundName);
    const duplicateProductReference = Number(hasAvatarReference) + Number(hasBackgroundReference) < 2;
    const avatarReferenceIndex = duplicateProductReference ? 3 : 2;
    const backgroundReferenceIndex = hasAvatarReference
      ? (duplicateProductReference ? 3 : 3)
      : (duplicateProductReference ? 3 : 2);
    const ingredientReferenceDirectives = [
      '[INGREDIENT REFERENCE — NEVER FIRST FRAME LOCK]',
      duplicateProductReference
        ? 'Reference images 1 and 2 are intentionally IDENTICAL copies of the same product. They are duplicate ingredient/subject identity references only and must be interpreted as one physical product, never two products.'
        : 'Reference image 1 is the product ingredient/subject identity reference. The remaining reference slots are reserved for the selected presenter and environment.',
      'Every uploaded reference is guidance for identity or environment only. No reference image is a start frame, opening frame, storyboard frame, background plate, mandatory composition, crop, camera angle or layout template.',
      'The first generated video frame must be a freshly composed live-action frame. Never reproduce, trace, extend, animate or closely match the product reference as the opening frame.',
      isHandOnly
        ? 'From the first instant, show a newly composed real-world scene with the physical product already grounded in the style-specific hand action.'
        : 'From the first instant, show the presenter already inside a believable real-world location with the physical product naturally held or used according to the selected style.',
      'The opening background, lighting arrangement, framing, scale, crop, perspective and hand placement must be visibly different from the isolated product reference.',
      'Never begin with a static product cutout, the reference-image background, a white border, an isolated packaging shot, a zoom-out from the uploaded image, or a still-to-motion transition.',
      'Natural movement must exist from frame zero: believable breathing or hand tension, a small gaze or wrist adjustment, and restrained handheld camera micro-shake.',
    ].join(' ');

    // 2. ZERO UI / PLATFORM / WATERMARK LOCK
    const zeroUiLockDirectives = [
      `[ZERO UI & WATERMARK LOCK]`,
      `Full-frame vertical 9:16 aspect ratio footage naturally recorded in physical space, WITHOUT displaying any smartphone border, phone mockup frame, or screen bezel.`,
      `Strictly NO TikTok logo, NO social media interface, NO user-added or fabricated watermark, NO phone frame, NO phone UI overlays, NO fake buttons, NO smartphone mockup, NO embedded video player, NO screen borders, NO playback controls, NO floating captions, NO UI overlay, NO picture-in-picture, NO yellow basket graphics, NO shopping app interface, NO username overlays, NO like/comment/share buttons. An authentic, unavoidable Nexabot Omni-Flash provider watermark is permitted; do not imitate or remove it.`,
      `No decorative sparkles, glints, star stickers, lens flares, floating symbols or animated graphic effects.`,
    ].join(' ');

    // 3. REALISTIC UGC / HUMAN REALISM LOCK (Includes smartphone 1x, iPhone 15 Pro, daylight 5500K)
    const realismDirectives = [
      `[REALISTIC UGC PROFILE]`,
      `Natural 1x smartphone camera optics, authentic neutral daylight where appropriate, single continuous 15-second handheld take, subtle micro-shake, realistic human skin with natural pores and textures, lifelike eye gaze, natural gravity and believable physical object contact.`,
      `Begin immediately in the live physical scene. Treat the uploaded image solely as a product identity reference; never paste it in as a still introductory frame or automatically use it as the first video frame.`,
      `Strictly NO jump cuts, NO push-in zoom, NO camera spin, NO crash pan, NO first-frame flash, NO synthetic colour grading, NO excessive cinematic effects, NO plastic skin, NO AI-generated look.`,
      HUMAN_REALISM_MASTERPROMPT_V8,
      EXPANSION_V1_STYLE_IDS.has(style.id) ? PAWARNA_TRUE_WHITE_PHONE_COLOR_DNA : '',
    ].filter(Boolean).join(' ');

    // 4. SHARIAH MODESTY LOCK V5
    let modestyDirectives = '';
    if (isMuslimah) {
      if (isHandOnly) {
        modestyDirectives = [
          `[SHARIAH MODESTY LOCK — HAND DEMO] Modesty Guardrail:`,
          `Exactly ONE naturally proportioned adult hand with sleeve fully covering wrist at all times.`,
          `Strictly NO rings, NO bracelets, NO nail polish, NO artificial nails. Exactly 5 natural fingers with normal realistic grip and anatomy.`,
        ].join(' ');
      } else {
        modestyDirectives = [
          `[SHARIAH MODESTY LOCK — PRESENTER] Modesty Guardrail:`,
          `Adult modest Malaysian Muslimah presenter: Hijab labuh fully covering hair, neck, and chest securely.`,
          `Loose-fitting modest clothing, long sleeves covering wrists at all times including arm transitions.`,
          `Strictly NO transparent fabric, NO tight outfits, NO jewellery (no rings, no bracelets, no necklaces), NO unintended hair or neck exposure during movements.`,
        ].join(' ');
      }
    } else {
      modestyDirectives = `[MODESTY GUIDELINE] Modesty Guardrail: Model wears neat, modern casual everyday attire appropriate for general Malaysian audiences.`;
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
    const ctaMode = options.callToAction || 'none';
    const selectedCta = resolveCtaPhrase(ctaMode, options.customCta || '');
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
      ? `Customer-confirmed usage context: ${product.usageContext.trim()}. Use it only when physically compatible with the selected style.`
      : 'No customer-confirmed usage context was supplied. Infer a physically and culturally relevant Malaysian setting cautiously from the recognizable product category and selected style. If category evidence is insufficient, use a neutral lived-in interior or neutral clean surface without assuming a kitchen, desk, bedroom, bathroom or other product-specific location.';
    const observedPhysicalFacts = (product.observedPhysicalFacts || []).map((fact) => fact.trim()).filter(Boolean).slice(0, 10);
    const customerConfirmedFacts = (product.confirmedFeatures || []).map((fact) => fact.trim()).filter(Boolean).slice(0, 10);
    const unsupportedClaims = [...(product.unknownFields || []), ...(product.prohibitedClaims || [])].map((fact) => fact.trim()).filter(Boolean).slice(0, 20);
    const productEvidenceContract = [
      '[PRODUCT EVIDENCE CONTRACT — KEEP SOURCES SEPARATE]',
      `Product identity metadata to verify against the uploaded image: “${product.name}”. The image remains the identity authority; a name is not evidence of a benefit.`,
      `Reasonably identifiable category: “${product.category}”. Use this only to understand what kind of object it is and to choose a plausible scene. A category never proves efficacy, suitability, quality or a buyer outcome.`,
      observedPhysicalFacts.length
        ? `Image-observable physical facts: ${observedPhysicalFacts.map((fact) => `“${fact}”`).join('; ')}. These facts describe visible construction or packaging only and must not be converted into performance claims.`
        : 'No image-observable physical fact was supplied as trusted context. Inspect conservatively and do not invent one.',
      customerConfirmedFacts.length
        ? `Customer-confirmed facts: ${customerConfirmedFacts.map((fact) => `“${fact}”`).join('; ')}. Treat them as factual context only, never as prewritten dialogue, a testimonial or permission to infer another benefit.`
        : 'No customer-confirmed functional or benefit fact was supplied. Nexabot may still express one ordinary buyer benefit that directly follows from the recognizable product purpose or reliable general product understanding, but must not invent a measurable result, concrete specification or regulated outcome.',
      unsupportedClaims.length
        ? `Unsupported or unresolved claims: ${unsupportedClaims.map((fact) => `“${fact}”`).join('; ')}. Omit them entirely.`
        : 'Any claim not supported by the uploaded identity/category or a customer-confirmed fact is unsupported and must be omitted.',
      'Use the buyer problem and intended audience as natural storytelling context, not as proof of a guaranteed outcome. The dialogue may present the product as a relevant option without claiming guaranteed resolution.',
    ].join(' ');

    const selectedScene = getBuiltInScene(options.builtInSceneId);
    const hasAvatarReference = Boolean(options.avatarName);
    const hasBackgroundReference = Boolean(options.backgroundName);
    const duplicateProductReference = Number(hasAvatarReference) + Number(hasBackgroundReference) < 2;
    const avatarReferenceIndex = duplicateProductReference ? 3 : 2;
    const backgroundReferenceIndex = hasAvatarReference ? 3 : (duplicateProductReference ? 3 : 2);
    const personalizationDirectives = [
      '[PERSONALIZATION REFERENCES — ORDER AND ROLE LOCK]',
      duplicateProductReference
        ? 'Reference images 1 and 2 are the same PRODUCT IDENTITY authority uploaded twice to reinforce ingredient/subject identity. They represent one product only and neither may become the first video frame.'
        : 'Reference image 1 is the PRODUCT IDENTITY authority. Use it to preserve the exact product; it is not a mandatory first video frame.',
      options.avatarName
        ? `Reference image ${avatarReferenceIndex} is the selected PRESENTER IDENTITY reference named "${options.avatarName}". Preserve this adult person's recognizable face, skin tone, body proportions and modest appearance consistently. Do not blend the presenter with the product or copy the avatar image background.`
        : 'No avatar reference is selected. Create an appropriate adult Malaysian presenter only when the style requires one.',
      options.backgroundName
        ? `Reference image ${backgroundReferenceIndex} is the BACKGROUND/ENVIRONMENT reference named "${options.backgroundName}". Recreate its spatial character and setting only; never turn objects from that image into the product or presenter and never use it as a frozen opening frame.`
        : selectedScene
          ? `Use this customer-selected textual environment: ${selectedScene.directive}. This is a scene direction, not an image reference.`
          : 'Choose a believable environment appropriate to the actual product category.',
      options.niche && options.niche !== 'auto' ? `Customer-selected niche: ${options.niche}. Adapt buyer context and demonstrations to this niche without inventing product facts.` : '',
      options.voicePersonality && options.voicePersonality !== 'auto' ? `Customer-selected speaking personality: ${options.voicePersonality}. ${VOICE_PERSONALITY_DIRECTIONS[options.voicePersonality] || ''} Preserve the style identity while applying this vocal performance.` : '',
      options.storyboard && options.storyboard !== 'auto' ? `Customer-selected storyboard: ${options.storyboard}. Use it only when physically appropriate to the reference product.` : '',
      'Never quietly substitute, merge or ignore a selected reference. If a reference conflicts with safety or cannot be followed, keep the product identity authoritative and avoid fabricating substitute identities.',
      'For every PRODUCT reference, preserve the physical product identity but exclude its source composition: do not copy the original surface, decorative props, lighting pattern, shadows, camera crop, perspective or object arrangement. Marketplace UI, prices, ratings, buttons and seller decoration are never scene elements.',
      'Build a visibly independent live-action scene from the selected style and grounded category. Do not animate, extend or reconstruct the uploaded product screenshot as the opening shot.',
    ].filter(Boolean).join(' ');

    const commonTruthfulness = [
      'Use natural benefit-oriented affiliate language around a recognizable ordinary product purpose or customer-confirmed fact. Do not invent objectively false concrete specifications, ingredients, certifications, regulated outcomes, prices, review/sold counts, popularity signals, discounts or personal testimonials.',
      'For supplements, health and beauty products, do not promise diagnosis, treatment, prevention, guaranteed bodily change or another regulated outcome that the supplied evidence does not establish. Keep this safeguard internal; never speak it as a disclaimer.',
      'Never claim personal use, purchase or ownership on behalf of the presenter, and never invent a testimonial. Sell through the product-relevant buyer situation instead.',
      'Do not call a product wireless, rechargeable, battery-powered or cable-free unless that exact fact is customer-confirmed or unmistakably readable. Use Malaysian Malay; avoid Indonesian forms such as kamu, coba, kesehatan, ianya and banget.',
      'Do not repeat the same claim, CTA or meaning merely to fill time, but allow natural conversational linking and expressive emphasis.',
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
          EXPANSION_V1_STYLE_IDS.has(style.id) ? EXPANSION_ANTI_AI_MALAYSIAN_VOICE_DNA : '',
          '[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]',
          'AffiMatik has not supplied, generated, previewed or approved spoken sentences. Inspect the uploaded product reference and independently write original natural Malaysian Malay dialogue and lip-sync.',
          `Follow the unique ${style.id} scene purpose, opening, buyer situation, product interaction, speaking personality, camera direction and ending. Create a full spontaneous affiliate flow with an attention-grabbing hook, natural product introduction, one meaningful supported selling point or buyer benefit, supported FOMO only when evidence exists, then the selected CTA or complete natural ending.`,
          'Never narrate camera framing, bottle rotation, hand movement, label visibility, product colour or packaging appearance.',
          selectedCta ? `Customer-selected CTA intent: ${ctaMode}. The intended target is “${selectedCta}”. Deliver it naturally once near the conversational ending without changing into an announcer voice; never add CTA graphics or repeat it. This CTA is the final spoken utterance. Once its last word is complete, add no new word, syllable, phoneme, tagline, thanks, outro, filler or corrupted speech.` : 'The customer selected Tanpa CTA. Do not add a spoken call to action; complete the persuasive product thought naturally instead.',
          options.creativeInstruction ? 'The customer-authored Creative Directive may include their own requested wording. Preserve it as direction without AffiMatik rewriting, completing or paraphrasing it.' : '',
          'Distribute meaningful speech across most of the 15-second clip with natural pace variation. Do not rush mechanically, force a premature silent gap, drag words, repeat filler or use a generic fallback. Complete the final utterance before the cut and let the physical performance end naturally.',
        ].filter(Boolean).join(' ');

    // Deliberate final payload order: production contract, style director,
    // product/context, human performance, one effective audio mode, safety
    // locks, then the natural ending contract.
    const criticalContract = [
      '[1. CRITICAL PRODUCTION CONTRACT]',
      promptModules.criticalContract,
      hasSpeech ? NEXABOT_SPOKEN_OUTPUT_CONTRACT_V10 : '',
      'Create one continuous 15-second vertical 9:16 live-action shot.',
    ].filter(Boolean).join(' ');
    const productAndContext = [
      '[3. PRODUCT UNDERSTANDING AND CONTEXT]',
      promptModules.productUnderstanding,
      productEvidenceContract,
      productContextDirective,
      personalizationDirectives,
      options.creativeInstruction ? `Customer Creative Directive: ${options.creativeInstruction}` : '',
    ].filter(Boolean).join(' ');
    const humanPerformance = `[4. HUMAN PERFORMANCE AND SCENE BEHAVIOUR] ${promptModules.humanPerformance}`;
    const necessaryLocks = `[6. NECESSARY SAFETY AND VISUAL LOCKS] ${promptModules.safetyLocks} ${commonTruthfulness}`;
    const endingRequirements = hasSpeech
      ? selectedCta
        ? '[7. ENDING REQUIREMENTS] Bring the selected CTA in near the natural conversational ending, normally during the final few seconds according to the actual speaking rhythm. Complete every CTA word before the 15-second cut. After its last word, generate no additional word, syllable, phoneme, repetition, thanks, tagline, filler or corrupted speech. Do not force a long silent gap; let the remaining natural physical action and room sound resolve the take.'
        : '[7. ENDING REQUIREMENTS] Use meaningful natural speech across most of the clip and complete the final selling thought before the 15-second cut. Do not force an early ending, long silent gap, repeated recap or abrupt cutoff; let voice and style-specific physical action resolve together like one real take.'
      : '[7. ENDING REQUIREMENTS] Complete the style-specific physical action, let grip, gravity, contact and ambient sound settle naturally, and never freeze or end with an abrupt cut.';
    const visualPrompt = [
      criticalContract,
      `[2. SELECTED STYLE FULL CREATIVE DIRECTION] ${styleSpecificPrompt}`,
      productAndContext,
      humanPerformance,
      `[5. VOICE OR AUDIO DIRECTION] ${effectiveAudioDirective} ${providerDialogueDirective}`,
      necessaryLocks,
      endingRequirements,
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
        'Pawarna Masterprompt Director V10 priority system enforced',
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
