/**
 * AFFIMATIK by Pawarna — Dynamic Prompt Engine Compiler (GEMS Masterprompts V5.0)
 * Translates Product Profile + Video Style + Scene Plan into Provider-Specific Payloads
 * 
 * Strict Priorities:
 * 1. Customer-customized approved script (preserved word-for-word)
 * 2. Product-specific dynamically generated script using confirmed facts (GEMS V5 Hook Engine)
 * 3. Safe category-aware honest fallback script (zero packaging-focused filler)
 * 4. Masterprompt Universal Locks V5 (Identity Max Lock, Zero UI, Realistic UGC, Shariah Modesty Lock, Audio)
 * 5. Full White-Label Customer Presentation (AffiMatik Voice 10s & AffiMatik Motion 15s)
 */

import { ProductProfile, ScenePlan, CompiledGenerationPrompt } from './types';
import { VideoStyle } from '../styles/types';
import { VoiceoverDirector } from './voiceover-director';

export const GEMS_PROMPT_VERSION = 'affimatik-gems-masterprompts-v5.0';

/**
 * Internal Provider to AffiMatik White-Label Display Name Mapping
 */
export function getEngineDisplayName(engine: 'nexabot' | 'runninghub' | string): string {
  if (engine === 'nexabot') return 'AffiMatik Voice (10s)';
  if (engine === 'runninghub') return 'AffiMatik Motion (15s)';
  return 'AffiMatik Engine';
}

export function getEngineDescription(engine: 'nexabot' | 'runninghub' | string): string {
  if (engine === 'nexabot') return 'Video pertuturan Bahasa Melayu santai semula jadi (10 saat)';
  if (engine === 'runninghub') return 'Video visual realistik, pergerakan lembut, ASMR / audio bersesuaian (15 saat)';
  return 'Enjin penjanaan video AffiMatik';
}

export interface CompilerOptions {
  callToAction?: 'spoken_button' | 'spoken_bio' | 'none';
  isMuslimahModest?: boolean;
  customScript?: string;
  creativeInstruction?: string;
  imageRole?: 'reference' | 'start_frame';
  variationIndex?: number;
  productionProfile?: 'ugc_creator' | 'studio_commercial';
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
 * Authoritative English Masterprompts for all 13 Styles (GEMS V5.0)
 */
export const AUTHORITATIVE_STYLE_MASTERPROMPTS: Record<string, (params: {
  productName: string;
  spokenScript: string;
  feature: string;
  useCase: string;
  buyerProblem: string;
  qaQuestion: string;
  useContext: string;
  relevantSurface: string;
  coreFunction: string;
}) => string> = {
  // NX01: Sembang Kawan (10s)
  NX01: (p) =>
    `A single adult modest Malaysian Muslimah creator, full hijab covering hair neck and chest, loose long-sleeved clothing. Natural smartphone 1x eye-level medium shot in a bright lived-in Malaysian home. She casually chats as if recommending a relevant product to a friend, gently holding the EXACT reference product at chest height without bringing it into macro-close-up. Natural hand gesture, soft sincere expression and believable lip-sync. First mention the buyer situation, then the actual supported function/benefit of "${p.productName}", how it relates to ${p.useCase}, finish with the exact approved spoken script: "${p.spokenScript}". One continuous handheld take, no cut.`,

  // NX02: Review Sambil Pegang (10s)
  NX02: (p) =>
    `Adult modest Malaysian Muslimah reviewer in a bright ordinary room, direct eye-level smartphone 1x handheld shot. The EXACT reference product is in one hand at comfortable chest height. She gives a concise, honest explanation of what "${p.productName}" is for and the single grounded feature or benefit "${p.feature}", translating it into a practical user situation ${p.useCase}. Very small natural object adjustment only, no label examination monologue, no close-up. Deliver exactly the approved spoken script: "${p.spokenScript}" in natural Malaysian Malay with accurate lip-sync. One continuous take.`,

  // NX03: First Impression (10s)
  NX03: (p) =>
    `Authentic first-look creator footage with an adult modest Malaysian Muslimah. Start with the EXACT reference product already naturally held near chest. She looks down at it briefly, notices the grounded real feature "${p.feature}", then looks up naturally with mild curiosity, explaining the useful benefit or use case in ${p.useCase} to the viewer. She has not used it in this scene and makes no personal testing claim. Speak approved Malaysian Malay script: "${p.spokenScript}". Small real movements, no fake unboxing, no reaction exaggeration, 1x smartphone full-frame one take.`,

  // NX05: Masalah Seharian (10s)
  NX05: (p) =>
    `Single-take realistic Malaysian home UGC. Adult modest Muslimah creator starts with a relatable specific buyer problem "${p.buyerProblem}" implied by naturally arranged real objects in the same scene, then lifts the EXACT reference "${p.productName}" into frame by second two and calmly explains one supported product function or benefit "${p.feature}". Show a credible possible use context in ${p.useCase}, not a miraculous instant transformation. Same camera position, no jump cut, no zoom, neutral daylight. Natural Malaysian speech exactly: "${p.spokenScript}".`,

  // NX07: Soalan & Jawapan (10s)
  NX07: (p) =>
    `Modest Malaysian Muslimah Q&A creator in a naturally bright Malaysian room, single continuous phone 1x shot, with the EXACT reference "${p.productName}" visible from the start. She verbally asks ONE common and meaningful factual question "${p.qaQuestion}", then answers it using ONLY evidenced answer "${p.feature}" and succinctly ties it to ${p.useCase}. No fake comment box, chat bubble, text graphics, or extra people. Speak the exact approved script: "${p.spokenScript}" in natural Malaysian Malay.`,

  // NX09: Goyang Produk + VO (10s)
  NX09: (p) =>
    `HAND ONLY. Exactly one naturally proportioned adult female hand, sleeve fully covering the wrist, holds the EXACT reference "${p.productName}" upright in a natural home space. The hand performs a relaxed, continuous, natural slight side-to-side micro-tilt (goyang santai) keeping the product stable and visible around 20–30% of the vertical frame. Clean, non-distracting domestic background suited to ${p.useCase}. No presenter face, no second hand. Off-camera Malaysian voice speaks: "${p.spokenScript}". Neutral 1x phone camera, daylight, zero UI, one single continuous take.`,

  // NX10: Label Talk • Fakta & Fungsi Dulu (10s)
  NX10: (p) =>
    `HAND ONLY. Exactly one adult female hand with long sleeve covering wrist holds the EXACT reference "${p.productName}" upright facing the 1x phone camera in a naturally lit room. The hand points subtly to the printed specification on the bottle/pack as physical evidence of verified attribute "${p.feature}", then holds steady. Focus remains on the actual product utility "${p.coreFunction}" in ${p.useCase}. No face, no second hand. Voiceover delivers the exact approved script: "${p.spokenScript}" in Malaysian Malay. No phone frame, no watermark, one continuous take.`,

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
    if (style.engine === 'nexabot' && style.durationSeconds !== 10) {
      errors.push(`Gaya AffiMatik Voice (${style.id}) mesti tepat 10 saat.`);
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

    // Voiceover validation if custom script is provided for Voice 10s
    if (style.engine === 'nexabot' && options?.customScript && options.customScript.trim().length > 0) {
      const scriptValidation = VoiceoverDirector.validateScript(options.customScript, product, 'nexabot');
      if (!scriptValidation.isValid) {
        errors.push(...scriptValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Resolves the spoken script adhering strictly to priority order:
   * 1. Approved customer custom script (preserved word-for-word)
   * 2. Product-specific dynamic script based on confirmed features & style hook
   * 3. Safe category-aware honest fallback (zero packaging filler)
   */
  static resolveSpokenScript(
    product: ProductProfile,
    style: VideoStyle,
    options: CompilerOptions = {}
  ): string {
    if (style.engine === 'runninghub') {
      return '';
    }

    // 1. Customer custom script (preserved word-for-word)
    if (options.customScript && options.customScript.trim().length > 0) {
      return options.customScript.trim();
    }

    // 2. Product-specific dynamically generated script using confirmed facts and style hook
    const ctaMode = options.callToAction || 'spoken_button';
    return VoiceoverDirector.generateAuthenticScript(product, style, ctaMode, options.variationIndex ?? 0);
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
    const spokenScript = this.resolveSpokenScript(product, style, options);
    const engineDisplayName = getEngineDisplayName(style.engine);

    let modestyRules = 'Pemakaian santai kontemporari sopan bersesuaian khalayak Malaysia.';
    if (isMuslimah) {
      if (style.category === 'hand_demo' || style.id.startsWith('RH') || style.id === 'NX09' || style.id === 'NX10') {
        modestyRules = 'Satu tangan sahaja dengan pergelangan tangan bertutup lengan baju, tiada cincin/gelang/pengilat kuku.';
      } else {
        modestyRules = 'Tudung labuh menutup rambut, leher dan dada; pakaian longgar berlengan panjang hingga pergelangan.';
      }
    }

    const visualSummary = `Satu babak visual berterusan ${style.durationSeconds} saat. ${scenePlan.primaryAction}. Produk kekal pada skala 20-30% bingkai tanpa morphing atau hilang.`;

    return {
      provider: style.engine,
      engineDisplayName,
      durationSeconds: style.durationSeconds,
      creditCost: style.engine === 'nexabot' ? 10 : 15,
      spokenScript: style.engine === 'nexabot' ? spokenScript : null,
      visualSummary,
      sceneEnvironment: scenePlan.location,
      cameraProfile: 'Kamera telefon pintar 9:16 menegak, 1x perspektif tanpa sempadan telefon atau mockup bingkai.',
      modestyRules,
      productIdentityRules: `Mengekalkan identiti visual produk ${product.name} (bentuk botol/bungkusan, warna, logo dan label).`,
      audioDirective: style.engine === 'nexabot'
        ? 'Suara bahasa Melayu santai bersahaja (14-23 perkataan), tiada slanga luar.'
        : 'Tiada suara pertuturan (visual tulen, bunyi persekitaran / ASMR / audio bersesuaian).',
      promptVersion: GEMS_PROMPT_VERSION,
    };
  }

  /**
   * Compiles the complete payload for the specified provider with Masterprompts V5.0
   */
  static compile(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions = {}
  ): CompiledGenerationPrompt {
    const preflight = this.validatePreflight(product, style, options);
    const isMuslimah = options.isMuslimahModest ?? style.modestyLock;
    const isHandOnly = style.category === 'hand_demo' || style.id.startsWith('RH') || style.id === 'NX09' || style.id === 'NX10';

    // -------------------------------------------------------------------------
    // MASTERPROMPT LOCK V5 — LAYER 1: UNIVERSAL MANDATORY LOCKS (00_GLOBAL_LOCKS)
    // -------------------------------------------------------------------------

    // 1. PRODUCT IDENTITY MAX LOCK
    const identityLockDirectives = [
      `[PRODUCT IDENTITY MAX LOCK]`,
      `The uploaded product image is an authoritative identity reference for "${product.name}".`,
      `Preserve exact product geometry, shape, scale (approximately 20-30% of the frame), cap, material, logo, brand, label, typography, and packaging colour with stable consistency across all frames.`,
      `Strictly NO product morphing, NO duplicate products, NO changing labels, NO changing packaging colours, NO missing caps, NO oversized containers, NO floating objects, NO artificial product rotation, NO sudden disappearance, NO unexpected object replacement.`,
    ].join(' ');

    // 2. ZERO UI / PLATFORM / WATERMARK LOCK
    const zeroUiLockDirectives = [
      `[ZERO UI & WATERMARK LOCK]`,
      `Full-frame vertical 9:16 aspect ratio footage naturally recorded in physical space, WITHOUT displaying any smartphone border, phone mockup frame, or screen bezel.`,
      `Strictly NO TikTok logo, NO social media interface, NO watermark, NO phone frame, NO phone UI overlays, NO fake buttons, NO smartphone mockup, NO embedded video player, NO screen borders, NO playback controls, NO floating captions, NO UI overlay, NO picture-in-picture, NO yellow basket graphics, NO shopping app interface, NO username overlays, NO like/comment/share buttons.`,
    ].join(' ');

    // 3. REALISTIC UGC / HUMAN REALISM LOCK (Includes smartphone 1x, iPhone 15 Pro, daylight 5500K)
    const realismDirectives = [
      `[REALISTIC UGC PROFILE]`,
      `Natural 1x smartphone camera (iPhone 15 Pro natural optics), authentic neutral daylight 5500K (5000-5600K neutral white balance), single continuous 10-second or 15-second handheld take, subtle micro-shake, realistic human skin with natural pores and textures, lifelike eye gaze, natural gravity and believable physical object contact.`,
      `Strictly NO jump cuts, NO push-in zoom, NO camera spin, NO crash pan, NO first-frame flash, NO synthetic colour grading, NO excessive cinematic effects, NO plastic skin, NO AI-generated look.`,
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
   * Nexabot Compiler (AffiMatik Voice, 10s, Malaysian Malay Spoken Dialogue)
   */
  private static compileNexabot(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions,
    universalMasterPrompt: string,
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    // 1. Spoken Script adhering to priority (customScript verbatim > dynamic > honest fallback)
    const spokenScript = this.resolveSpokenScript(product, style, options);

    // Validate final spoken script
    const scriptValidation = VoiceoverDirector.validateScript(spokenScript, product, 'nexabot');
    if (!scriptValidation.isValid) {
      preflight.isValid = false;
      preflight.errors.push(...scriptValidation.errors);
    }

    // Audio instruction: Natural spoken Bahasa Melayu Malaysia (14-23 words)
    const audioDirective = `Dialogue Language: Malaysian Malay (Bahasa Melayu Malaysia). Tone: Casual, relaxed conversational Malaysian creator tone. Natural native pronunciation for exactly 10 seconds. Script to speak aloud: "${spokenScript}"`;

    // 2. Authoritative Style Masterprompt V5
    const stylePromptFn = AUTHORITATIVE_STYLE_MASTERPROMPTS[style.id];
    let styleSpecificPrompt = '';
    const feature = (product.confirmedFeatures && product.confirmedFeatures[0]) || product.coreFunction || 'kegunaan harian';
    const useCase = product.usageContext || 'kegunaan seharian';
    const buyerProblem = product.buyerProblem || 'mencari pilihan yang praktikal';
    const qaQuestion = product.allowedQaQuestion || `Ada fungsi menarik pada ${product.spokenShortName}?`;

    if (stylePromptFn) {
      styleSpecificPrompt = stylePromptFn({
        productName: product.name,
        spokenScript,
        feature,
        useCase,
        buyerProblem,
        qaQuestion,
        useContext: product.usageContext || 'dapur atau ruang santai',
        relevantSurface: 'meja atau kaunter yang kemas',
        coreFunction: product.coreFunction || 'kegunaan harian',
      });
    } else {
      styleSpecificPrompt = `One single continuous 10-second shot. Setting: ${scenePlan.location}. Action: ${scenePlan.primaryAction}. ${scenePlan.actionProgression}. Script: "${spokenScript}".`;
    }

    // Visual Prompt
    const visualPrompt = [
      `One single continuous 10-second shot.`,
      styleSpecificPrompt,
      universalMasterPrompt,
      options.creativeInstruction ? `Creative Directive: ${options.creativeInstruction}` : '',
    ].filter(Boolean).join(' ');

    const fullPayload = `${visualPrompt} Spoken Voiceover Audio: Bahasa Melayu standard Malaysia, Strictly avoid Indonesian loanwords, Strictly NO English dialogue: "${spokenScript}"`;

    return {
      provider: 'nexabot',
      providerPrompt: fullPayload,
      visualPrompt,
      spokenScript,
      continuityAnchor: product.name,
      audioDirective,
      safetyRules: [
        'AffiMatik Voice (10s) native Malaysian Malay spoken audio',
        'GEMS V5 Masterprompt Lock enforced',
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
        spokenScript: '',
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
