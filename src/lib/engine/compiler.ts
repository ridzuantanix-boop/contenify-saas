/**
 * AFFIMATIK by Pawarna — Creative V6 direct-provider prompt compiler
 * Translates Product Profile + Video Style + Scene Plan into Provider-Specific Payloads
 * 
 * AffiMatik compiles the canonical style masterprompt, selected V8 script mode,
 * CTA and references. The provider renders speech, acting, scene and final media.
 */

import { ProductProfile, ScenePlan, CompiledGenerationPrompt } from './types';
import { VideoStyle } from '../styles/types';
import { VIDEO_STYLES_REGISTRY } from '../styles/registry';
import { getBuiltInScene } from '../personalization/config';
import {
  buildSmartScript,
  CtaMode,
  quoteProviderScript,
  resolveCtaPhrase,
  ScriptMode,
  validateCustomCta,
  validateCustomerFact,
  validateHumanScript,
} from './script-control';

export const GEMS_PROMPT_VERSION = 'affimatik-human-realism-v8.0';

export const MALAYSIAN_AFFILIATE_VOICE_DNA_V6 = [
  '[MALAYSIAN AFFILIATE VOICE DNA V6]',
  'Use spoken Bahasa Melayu Malaysia that sounds like a believable local affiliate creator, never formal corporate copy.',
  'Use a short naturally uneven sentence rhythm, meaningful pauses, subtle vocal variation and one product-relevant hook that is distinct from the ending.',
  'Build one compact spoken turn: one distinct hook, one grounded product point, then one concise natural ending. Do not narrate for the full clip merely to fill time.',
  'Focus on one supported intended purpose or ordinary category use context and finish speech comfortably before the video ends.',
  'Do not repeat a catalogue-wide opening or closing. Match the selected style personality exactly.',
  'Never repeat or paraphrase the same meaning twice. Each spoken clause must add new information; remove any echoed claim, hook, product point, CTA or outro before rendering.',
  'No Indonesian forms, no English dialogue unless explicitly requested, no filler, no exaggerated presenter performance.',
  'A buyer problem does not prove that this product resolves it. Omit all unsupported benefit and performance claims.',
  'Never claim personal use, purchase, customer reviews, ingredients, certifications, prices, specifications, performance results or medical outcomes unless explicitly supplied by the user or clearly legible in the reference.',
  'Keep factual guardrails silent: do not speak legal-disclaimer phrases such as “berdasarkan apa yang kelihatan”. When detail is unavailable, use an ordinary useful category description or omit the claim.',
  'Never use first-person product experience or routines, including claims that the speaker uses, drinks, takes, buys or keeps the product at home.',
  'A natural low-pressure spoken CTA is optional; never force one when it would make the delivery feel scripted.',
].join(' ');

export const HUMAN_REALISM_MASTERPROMPT_V8 = [
  '[HUMAN REALISM MASTERPROMPT V8]',
  'Create ordinary Malaysian creator behaviour, not polished commercial acting. Keep breathing visible but subtle, eye gaze believable, blinks irregular and head or hand movement small and purposeful.',
  'Creator review: alternate naturally between the lens and product, with one small head movement and a restrained hand gesture.',
  'First impression: use one spontaneous micro-reaction such as a slight eyebrow lift or half-smile; never exaggerated surprise.',
  'Question and answer: show a brief thinking expression before the answer, then return gaze naturally to the lens.',
  'Hand demonstration: use a real grip, believable object weight, correct finger contact, stable label and physical contact shadows.',
  'POV: use credible first-person reach and restrained handheld movement, never floating or impossible camera travel.',
  'Lifestyle: perform one small context-relevant action while speaking instead of posing motionless.',
  'Soft sell: relaxed local speaking tone, never a commercial announcer voice or over-rehearsed sales performance.',
  'Use bright neutral realistic daylight with consistent exposure and white balance. Preserve natural skin texture, facial proportions, product identity and selected avatar identity.',
].join(' ');

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
  customScript?: string;
  customCta?: string;
  scriptMode?: ScriptMode;
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
}

export interface PromptPreviewResult {
  provider: 'nexabot' | 'runninghub';
  engineDisplayName: string;
  durationSeconds: number;
  creditCost: number;
  spokenScript: string | null;
  visualSummary: string;
  sceneEnvironment: string;
  cameraProfile: string;
  modestyRules: string;
  productIdentityRules: string;
  audioDirective: string;
  promptVersion: string;
}

/**
 * Retained V5 literals, overridden below by all 20 canonical V6 styles.
 */
export const AUTHORITATIVE_STYLE_MASTERPROMPTS: Record<string, (params: {
  productName: string;
  feature: string;
  useCase: string;
  buyerProblem: string;
  qaQuestion: string;
  useContext: string;
  relevantSurface: string;
  coreFunction: string;
}) => string> = {
  // NX01: Sembang Kawan (15s)
  NX01: (p) =>
    `A single adult modest Malaysian Muslimah creator, full hijab covering hair neck and chest, loose long-sleeved clothing. Natural smartphone 1x eye-level medium shot in a bright lived-in Malaysian home. She casually chats like a friend, holding the reference product at chest height. Open with a buyer situation genuinely relevant to the visible product, then explain its supported intended purpose and an ordinary use context in a warm, sincere voice. The provider creates the words and lip-sync. Natural hand gesture, one continuous handheld take, no cut.`,

  // NX02: Review Sambil Pegang (15s)
  NX02: (p) =>
    `Adult modest Malaysian Muslimah reviewer in a bright ordinary room, direct eye-level smartphone 1x handheld shot. Hold the reference product in one hand at chest height. Open by identifying its supported intended purpose, mention one feature actually legible in the image or explicitly supplied by the user, then explain when a buyer might use it without predicting a result. Speak directly and honestly; the provider creates the Malaysian Malay dialogue and lip-sync. Very small natural object adjustment, no label examination monologue, no close-up, one continuous take.`,

  // NX03: First Impression (15s)
  NX03: (p) =>
    `Authentic first-look creator footage with an adult modest Malaysian Muslimah. Start holding the reference product near chest, glance at it, then look up with mild curiosity. Open with a genuine first observation and explain only an intended purpose supported by the image or user notes, never an achieved benefit. The provider creates cautious Malaysian Malay dialogue without implying personal use or a tested result. Small real movements, no fake unboxing or exaggerated reaction, 1x smartphone full-frame one take.`,

  // NX05: Masalah Seharian (15s)
  NX05: (p) =>
    `Single-take realistic Malaysian home UGC. Adult modest Muslimah creator opens with a buyer situation relevant to the visible product, then lifts the reference product into frame by second two and explains its supported intended function and ordinary use. Do not claim the product solves the problem or delivers a result. The provider creates empathetic, cautious Malaysian Malay dialogue and a credible everyday action, never a miraculous instant transformation. Same camera position, no jump cut, no zoom, neutral daylight.`,

  // NX07: Soalan & Jawapan (15s)
  NX07: (p) =>
    `Modest Malaysian Muslimah Q&A creator in a naturally bright Malaysian room, single continuous phone 1x shot, with the reference product visible from the start. The provider creates ONE meaningful Malaysian Malay buyer question about the product's purpose or supported feature, then answers only with evidence visible in the image or user notes and relates it to practical use. If evidence is insufficient, choose a narrower answerable question. Curious, helpful speaking personality. No fake comment box, chat bubble, text graphics, or extra people.`,

  // NX09: Goyang Produk + VO (15s)
  NX09: (p) =>
    `HAND ONLY. Exactly one naturally proportioned adult female hand, sleeve fully covering the wrist, holds the reference product upright in a natural home space. Relaxed continuous side-to-side micro-tilt keeps it stable at 20–30% of the vertical frame. The provider creates a calm off-camera Malaysian Malay voiceover opening with a relevant use situation, then its supported intended purpose, without claiming an outcome. No presenter face or second hand. Neutral 1x phone camera, daylight, zero UI, one continuous take.`,

  // NX10: Label Talk • Fakta & Fungsi Dulu (15s)
  NX10: (p) =>
    `HAND ONLY. Exactly one adult female hand with long sleeve covering wrist holds the reference product upright facing the 1x phone camera in a naturally lit room. Point subtly to a clearly legible, relevant specification only if one is visible; otherwise hold steady without pretending a specification exists. The provider creates a precise Malaysian Malay voiceover opening with a supported fact and explaining only its intended purpose or use context, never an unverified outcome. No face, second hand or phone frame; one continuous take.`,

  // RH01: Goyang Produk Natural (15s)
  RH01: (p) =>
    `One continuous real smartphone 1x handheld shot. Exactly ONE fully sleeve-covered adult hand holds the EXACT reference "${p.productName}" upright in a grounded real-world usage context (${p.useContext}). Small authentic left tilt, center, small right tilt, then hold steady. Slight natural micro-shake only. The object should clearly belong to its intended usage context, conveying purpose visually rather than merely showing packaging. Full-frame 9:16, daylight, no face, no second hand, no graphic overlays. Strictly NO spoken dialogue and NO lip-sync movement.`,

  // RH02: Gentle Product Tilt (15s)
  RH02: (p) =>
    `Realistic tabletop video of exact "${p.productName}" in relevant usage context (${p.useContext}). A single modest covered adult hand gently tilts the physical product left 10–12 degrees, returns to center, tilts the other way, and rests it on the real surface (${p.relevantSurface}). Normal object weight, accurate product identity, clean neutrally lit 1x handheld smartphone footage, no macro exaggeration or changing label. Visual attention follows a buyer-relevant feature or form without any unverified performance demonstration. Strictly NO spoken dialogue.`,

  // RH03: Pick Up & Put Down (15s)
  RH03: (p) =>
    `Natural continuous 15-second smartphone 1x footage. Exact physical "${p.productName}" starts on a real surface (${p.relevantSurface}). Exactly one covered adult hand enters from the side, grips, lifts 5–10 cm with plausible object weight, holds naturally in usage context (${p.useContext}), slowly places the product back with clear contact shadow, releases it, and withdraws. The product remains the same object from beginning to end. Neutral bright daylight. Capture believable everyday handling, not a 360 product turntable or stage effect. Strictly NO spoken dialogue.`,

  // RH04: Shelf Pickup (15s)
  RH04: (p) =>
    `One continuous authentic Malaysian home shelf interaction, handheld smartphone 1x, bright neutral daylight. The exact referenced "${p.productName}" sits on a suitable tidy shelf in usage context (${p.useContext}). One sleeve-covered hand reaches in, grasps the product, lifts it naturally off shelf, holds it at ordinary arm distance, keeps product stable. This should feel like a shopper or customer casually taking a relevant item for use, not an ad with visual effects. No second hand, no face, no branded social media UI. Strictly NO spoken dialogue.`,

  // RH17: Desk Setup (15s)
  RH17: (p) =>
    `Everyday Malaysian work/study desk, not a commercial showroom. Exact referenced "${p.productName}" in a believable desk use context (${p.useContext}) beside minimal realistic desk items. One covered hand enters, makes a small practical position adjustment, then exits. Realistic daylight, normal 1x phone camera with barely noticeable handheld drift, one continuous 15-second take. The arrangement visually shows where the product helps in everyday life without inventing specific functions or adding floating icons. Strictly NO spoken dialogue.`,

  // RH19: Window Daylight (15s)
  RH19: (p) =>
    `Single real-looking handheld smartphone 1x clip of the exact "${p.productName}" held in one modest sleeve-covered adult hand near an ordinary Malaysian home window. Pure neutral clean window daylight, soft true shadow, no golden or sepia tint. Small authentic 5–8-degree hand adjustment, otherwise stable. Product naturally scaled (20–30% of vertical frame) and appropriate to usage context (${p.useContext}); visible real object, not a stylized commercial showcase. One continuous full-frame 15-second shot with absolutely no embedded interface or phone frame. Strictly NO spoken dialogue.`,
};

// V6 derives a distinct provider masterprompt from every canonical registry
// definition. This overrides the retained V5 literals above for compatibility
// and ensures new and legacy RH identities use the same direct Nexabot path.
for (const v6Style of VIDEO_STYLES_REGISTRY) {
  AUTHORITATIVE_STYLE_MASTERPROMPTS[v6Style.id] = (p) => {
    const d = v6Style.creativeDirection;
    const handOnly = v6Style.category === 'product_handling' || v6Style.category === 'pov' || v6Style.id.startsWith('RH');
    return [
      `[STYLE ${v6Style.id} — ${v6Style.name}]`,
      `Target experience: ${d.targetViewingExperience}.`,
      `Opening strategy: ${d.openingStrategy}.`,
      `Speaking personality: ${d.speakingPersonality}.`,
      `Natural human behaviour: ${d.humanBehaviour}.`,
      `Scene context: ${d.sceneContext}; adapt it to the uploaded product category and never force an unsuitable location.`,
      `Product interaction: ${d.productInteraction}.`,
      `Ending: ${d.expectedEnding}.`,
      `Camera: ${v6Style.cameraProfile}; vertical 9:16, realistic smartphone 1x, one continuous take, small handheld micro-shake.`,
      handOnly ? 'HAND-LED SCENE: one realistically proportioned hand only, wrist covered, no jewellery or nail polish.' : 'PRESENTER SCENE: natural expressions and accurate lip-sync; modest Malaysian Muslimah styling.',
      `Use the exact reference product identity. The image is a reference, never a mandatory first frame. Product name metadata: "${p.productName}".`,
    ].join(' ');
  };
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

    // Check custom script submitted to Motion 15s (Mentions RunningHub for compatibility)
    if (style.engine === 'runninghub' && options?.customScript && options.customScript.trim().length > 0) {
      errors.push(`Gaya 15 saat AffiMatik Motion (RunningHub ${style.id}) adalah visual pergerakan sepenuhnya dan tidak menerima sebarang skrip pertuturan.`);
    }

    if (style.engine === 'nexabot') {
      const scriptMode = options?.scriptMode || 'smart';
      if (scriptMode === 'custom') {
        const scriptValidation = validateHumanScript(options?.customScript || '');
        if (!scriptValidation.isValid) errors.push(...scriptValidation.errors);
      }
      if (options?.callToAction === 'custom') errors.push(...validateCustomCta(options?.customCta || ''));
      if (product.confirmedFeatures?.[0]) errors.push(...validateCustomerFact(product.confirmedFeatures[0]));
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

    const visualSummary = `Satu babak visual berterusan ${style.durationSeconds} saat. ${scenePlan.primaryAction}. Produk kekal pada skala 20-30% bingkai tanpa morphing atau hilang.`;

    const scriptMode = options.scriptMode || 'smart';
    const ctaMode = options.callToAction || 'none';
    const selectedCta = resolveCtaPhrase(ctaMode, options.customCta || '');
    const previewScript = style.engine === 'nexabot' && scriptMode === 'smart'
      ? buildSmartScript(product, style, ctaMode, options.customCta)
      : style.engine === 'nexabot' && scriptMode === 'custom'
        ? `${(options.customScript || '').trim()}${selectedCta ? ` ${selectedCta}` : ''}`.trim()
        : null;

    return {
      provider: style.engine,
      engineDisplayName,
      durationSeconds: style.durationSeconds,
      creditCost: style.engine === 'nexabot' ? 10 : 15,
      spokenScript: previewScript,
      visualSummary,
      sceneEnvironment: scenePlan.location,
      cameraProfile: 'Kamera telefon pintar 9:16 menegak, 1x perspektif tanpa sempadan telefon atau mockup bingkai.',
      modestyRules,
      productIdentityRules: `Mengekalkan identiti visual produk ${product.name} (bentuk botol/bungkusan, warna, logo dan label).`,
      audioDirective: style.engine === 'nexabot'
        ? scriptMode === 'provider_auto'
          ? 'Provider mencipta dialog Bahasa Melayu Malaysia mengikut personaliti gaya terpilih.'
          : 'Provider diminta menyampaikan skrip V8 terpilih secara natural; ketepatan sebenar perlu dinilai pada output audio.'
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
      `Preserve exact product geometry, shape, scale (approximately 20-30% of the frame), cap, material, logo, brand, label, typography, and packaging colour with stable consistency across all frames.`,
      `Strictly NO product morphing, NO duplicate products, NO changing labels, NO changing packaging colours, NO missing caps, NO oversized containers, NO floating objects, NO artificial product rotation, NO sudden disappearance, NO unexpected object replacement.`,
      `Never add a printed volume, size, specification, certification, ingredient, icon or word that is absent from the reference image. If small text is unreadable, leave it indistinct instead of inventing letters or numbers.`,
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
      `Natural 1x smartphone camera (iPhone 15 Pro natural optics), authentic neutral daylight 5500K (5000-5600K neutral white balance), single continuous 10-second or 15-second handheld take, subtle micro-shake, realistic human skin with natural pores and textures, lifelike eye gaze, natural gravity and believable physical object contact.`,
      `Begin immediately in the live physical scene. Treat the uploaded image solely as a product identity reference; never paste it in as a still introductory frame or automatically use it as the first video frame.`,
      `Strictly NO jump cuts, NO push-in zoom, NO camera spin, NO crash pan, NO first-frame flash, NO synthetic colour grading, NO excessive cinematic effects, NO plastic skin, NO AI-generated look.`,
      HUMAN_REALISM_MASTERPROMPT_V8,
    ].join(' ');

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

    const universalMasterPrompt = [
      identityLockDirectives,
      zeroUiLockDirectives,
      realismDirectives,
      modestyDirectives,
    ].join(' ');

    // Route to provider compiler
    if (style.engine === 'runninghub') {
      return this.compileRunningHub(
        product,
        style,
        scenePlan,
        options,
        universalMasterPrompt,
        preflight
      );
    } else {
      return this.compileNexabot(
        product,
        style,
        scenePlan,
        options,
        universalMasterPrompt,
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
    universalMasterPrompt: string,
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    const scriptMode = options.scriptMode || 'smart';
    const ctaMode = options.callToAction || 'none';
    const selectedCta = resolveCtaPhrase(ctaMode, options.customCta || '');
    const controlledScript = scriptMode === 'smart'
      ? buildSmartScript(product, style, ctaMode, options.customCta)
      : scriptMode === 'custom'
        ? `${(options.customScript || '').trim()}${selectedCta ? ` ${selectedCta}` : ''}`.trim()
        : undefined;
    if (controlledScript) {
      const validation = validateHumanScript(controlledScript);
      if (!validation.isValid) {
        preflight.errors.push(...validation.errors);
        preflight.isValid = false;
      }
    }
    const audioDirective = controlledScript
      ? `V8 ${scriptMode === 'smart' ? 'Smart Script' : 'Custom Script'} requested for natural Malaysian Malay delivery; provider fidelity remains subject to actual output verification.`
      : 'Provider-created natural Malaysian Malay dialogue within 15 seconds, following the selected style personality and grounded in the image plus optional user notes.';

    // Authoritative Style Masterprompt V6
    const stylePromptFn = AUTHORITATIVE_STYLE_MASTERPROMPTS[style.id];
    let styleSpecificPrompt = '';
    const feature = (product.confirmedFeatures && product.confirmedFeatures[0]) || product.coreFunction || 'kegunaan harian';
    const useCase = product.usageContext || 'kegunaan seharian';
    const buyerProblem = product.buyerProblem || 'mencari pilihan yang praktikal';
    const qaQuestion = product.allowedQaQuestion || `Ada fungsi menarik pada ${product.spokenShortName || 'produk ni'}?`;

    if (stylePromptFn) {
      styleSpecificPrompt = stylePromptFn({
        productName: product.name,
        feature,
        useCase,
        buyerProblem,
        qaQuestion,
        useContext: product.usageContext || 'dapur atau ruang santai',
        relevantSurface: 'meja atau kaunter yang kemas',
        coreFunction: product.coreFunction || 'kegunaan harian',
      });
    } else {
      preflight.errors.push(`Gaya ${style.id} tiada masterprompt rasmi.`);
      preflight.isValid = false;
    }

    const selectedScene = getBuiltInScene(options.builtInSceneId);
    const personalizationDirectives = [
      '[PERSONALIZATION REFERENCES — ORDER AND ROLE LOCK]',
      'Reference image 1 is always the PRODUCT IDENTITY authority. Use it to preserve the exact product; it is not a mandatory first video frame.',
      options.avatarName
        ? `Reference image 2 is the selected PRESENTER IDENTITY reference named "${options.avatarName}". Preserve this adult person's recognizable face, skin tone, body proportions and modest appearance consistently. Do not blend the presenter with the product or copy the avatar image background.`
        : 'No avatar reference is selected. Create an appropriate adult Malaysian presenter only when the style requires one.',
      options.backgroundName
        ? `Reference image ${options.avatarName ? '3' : '2'} is the BACKGROUND/ENVIRONMENT reference named "${options.backgroundName}". Recreate its spatial character and setting only; never turn objects from that image into the product or presenter.`
        : selectedScene
          ? `Use this customer-selected textual environment: ${selectedScene.directive}. This is a scene direction, not an image reference.`
          : 'Choose a believable environment appropriate to the actual product category.',
      options.niche && options.niche !== 'auto' ? `Customer-selected niche: ${options.niche}. Adapt buyer context and demonstrations to this niche without inventing product facts.` : '',
      options.voicePersonality && options.voicePersonality !== 'auto' ? `Customer-selected speaking personality: ${options.voicePersonality}. Preserve the style identity while applying this vocal tone.` : '',
      options.storyboard && options.storyboard !== 'auto' ? `Customer-selected storyboard: ${options.storyboard}. Use it only when physically appropriate to the reference product.` : '',
      'Never quietly substitute, merge or ignore a selected reference. If a reference conflicts with safety or cannot be followed, keep the product identity authoritative and avoid fabricating substitute identities.',
    ].filter(Boolean).join(' ');

    // Visual Prompt
    const visualPrompt = [
      `One single continuous 15-second shot.`,
      styleSpecificPrompt,
      personalizationDirectives,
      universalMasterPrompt,
      options.creativeInstruction ? `Creative Directive: ${options.creativeInstruction}` : '',
    ].filter(Boolean).join(' ');

    const commonTruthfulness = [
      'If the image and customer-confirmed facts do not establish a claim, omit it entirely. Never invent a special formula, ingredients, certifications, medical outcomes, personal-use results, prices or testimonials.',
      'Never say or imply “pilihan terbaik”, “wajib”, personal use, purchase, dosage, absorption, symptom relief, energy, focus, wellness or health results. For supplements or health products, only use the customer-confirmed fact and clearly readable label facts; never explain an unverified effect on the body.',
      'Never describe a product as wireless, rechargeable, battery-powered, portable or cable-free unless that exact fact is explicitly customer-confirmed. Use Malaysian Malay only; forbidden Indonesian forms include kamu, coba, kesehatan, ianya and banget.',
      'Never repeat or semantically paraphrase a hook, fact, sentence, CTA or ending.',
    ].join(' ');

    const providerDialogueDirective = controlledScript
      ? [
          MALAYSIAN_AFFILIATE_VOICE_DNA_V6,
          `[V8 ${scriptMode === 'smart' ? 'SMART SCRIPT' : 'CUSTOM SCRIPT'} CONTROL]`,
          `Requested spoken words: ${quoteProviderScript(controlledScript)}.`,
          'Say the requested words once, in the same order, without adding claims, testimonials, a second CTA or improvised selling lines. Do not render quotation marks as speech.',
          selectedCta ? `The customer selected this CTA and it is already included once in the requested words: ${quoteProviderScript(selectedCta)}.` : 'The customer chose no CTA. Do not add a spoken call to action.',
          `Preserve the unique ${style.id} personality and physical behaviour while delivering the requested words with natural Malaysian intonation and accurate lip movement.`,
          'Pace naturally across approximately 12.5 to 14 seconds when the script length supports it. Do not stretch syllables, repeat words or rush. If the supplied script is short, finish naturally and continue with meaningful silent product interaction; do not force speech to the final frame.',
          commonTruthfulness,
        ].join(' ')
      : [
          MALAYSIAN_AFFILIATE_VOICE_DNA_V6,
          '[PROVIDER AUTO DIALOGUE — AFFIMATIK V8 LEGACY MODE]',
          'The external video-generation AI must inspect the uploaded product reference and independently create natural Malaysian Malay dialogue and lip-sync.',
          `Follow the unique ${style.id} opening, personality, human behaviour and ending. Create one distinct hook, one grounded product point and one concise ending.`,
          selectedCta ? `Finish with this exact CTA phrase once: ${quoteProviderScript(selectedCta)}.` : 'The customer chose no CTA. Do not add a spoken call to action.',
          'Pace the dialogue for approximately 12.5 to 14 seconds when its natural length supports it. Do not fill time through repetition or dragged-out words, and do not force speech to end on the final frame.',
          commonTruthfulness,
        ].join(' ');
    const fullPayload = `${visualPrompt} ${providerDialogueDirective}`;

    return {
      provider: 'nexabot',
      providerPrompt: fullPayload,
      visualPrompt,
      spokenScript: controlledScript,
      continuityAnchor: product.name,
      audioDirective,
      safetyRules: [
        'AffiMatik Voice (15s) native Malaysian Malay spoken audio',
        'Human Realism V8 Masterprompt enforced',
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
    universalMasterPrompt: string,
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    // 15-second creative timeline progression (0-4s establish, 4-10s authentic action, 10-15s hold and conclude)
    const timelineGuideline = [
      'Timing Structure: One continuous 15-second physical shot.',
      '0s to 4s: Establish the product naturally in the setting with clear label visibility.',
      '4s to 10s: One simple authentic physical action matching the official style definition.',
      '10s to 15s: Hold naturally and conclude smoothly without abrupt cuts or sudden movements.',
    ].join(' ');

    // Authoritative Style Masterprompt V5
    const stylePromptFn = AUTHORITATIVE_STYLE_MASTERPROMPTS[style.id];
    let styleSpecificPrompt = '';
    const feature = (product.confirmedFeatures && product.confirmedFeatures[0]) || product.coreFunction || 'kegunaan harian';
    const useContext = product.usageContext || 'ordinary domestic context';
    const relevantSurface = product.category.toLowerCase().includes('gadget') || style.id === 'RH17'
      ? 'a tidy study or workspace desk'
      : product.category.toLowerCase().includes('makan')
      ? 'a clean kitchen dining table'
      : 'a clean domestic tabletop surface';

    if (stylePromptFn) {
      styleSpecificPrompt = stylePromptFn({
        productName: product.name,
        feature,
        useCase: useContext,
        buyerProblem: product.buyerProblem || '',
        qaQuestion: '',
        useContext,
        relevantSurface,
        coreFunction: product.coreFunction || 'kegunaan harian',
      });
    } else {
      styleSpecificPrompt = `15-second visual showcase video. Setting: ${scenePlan.location}. Action: ${scenePlan.primaryAction}.`;
    }

    const visualPrompt = [
      styleSpecificPrompt,
      timelineGuideline,
      universalMasterPrompt,
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
