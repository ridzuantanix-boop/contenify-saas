/**
 * AFFIMATIK by Pawarna — Dynamic Prompt Engine Compiler (Masterprompt Lock V4)
 * Translates Product Profile + Video Style + Scene Plan into Provider-Specific Payloads
 * 
 * Strict Priorities:
 * 1. Customer-customized approved script
 * 2. Product-specific dynamically generated script using confirmed facts
 * 3. Safe category-aware fallback script
 * 4. Masterprompt Universal Locks (Identity, Zero UI, Human Realism, Shariah, Audio)
 * 5. Full White-Label Customer Presentation (AffiMatik Voice 10s & AffiMatik Motion 15s)
 */

import { ProductProfile, ScenePlan, CompiledGenerationPrompt } from './types';
import { VideoStyle } from '../styles/types';
import { VoiceoverDirector } from './voiceover-director';

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
    const engineName = getEngineDisplayName(style.engine);

    // Engine and duration validation
    if (style.engine === 'nexabot' && style.durationSeconds !== 10) {
      errors.push(`Gaya AffiMatik Voice (Nexabot ${style.id}) mesti tepat 10 saat.`);
    }
    if (style.engine === 'runninghub' && style.durationSeconds !== 15) {
      errors.push(`Gaya AffiMatik Motion (RunningHub ${style.id}) mesti tepat 15 saat.`);
    }

    // Hard Rule: Motion 15s styles must NOT have spoken voiceover
    if (style.engine === 'runninghub' && style.audioMode !== 'no_speech' && style.audioMode !== 'ambient') {
      errors.push(`Gaya AffiMatik Motion (RunningHub ${style.id}) tidak menyokong suara percakapan.`);
    }

    // Check custom script submitted to Motion 15s
    if (style.engine === 'runninghub' && options?.customScript && options.customScript.trim().length > 0) {
      errors.push(`Gaya 15 saat AffiMatik Motion (RunningHub) adalah visual pergerakan sepenuhnya dan tidak menerima sebarang skrip pertuturan.`);
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
   * 1. Approved customer custom script
   * 2. Product-specific dynamic script based on confirmed features
   * 3. Category-aware visual fallback
   */
  static resolveSpokenScript(
    product: ProductProfile,
    style: VideoStyle,
    options: CompilerOptions = {}
  ): string {
    if (style.engine === 'runninghub') {
      return '';
    }

    // 1. Customer custom script
    if (options.customScript && options.customScript.trim().length > 0) {
      return options.customScript.trim();
    }

    // 2. Product-specific dynamically generated script using confirmed facts or truthful visual observation
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
      if (style.category === 'hand_demo') {
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
    };
  }

  /**
   * Compiles the complete payload for the specified provider with Masterprompt Lock V4
   */
  static compile(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions = {}
  ): CompiledGenerationPrompt {
    const preflight = this.validatePreflight(product, style, options);
    const isMuslimah = options.isMuslimahModest ?? style.modestyLock;
    const ctaMode = options.callToAction || 'spoken_button';

    // -------------------------------------------------------------------------
    // MASTERPROMPT LOCK V4 — LAYER 1: UNIVERSAL MANDATORY LOCKS
    // -------------------------------------------------------------------------

    // 1. PRODUCT IDENTITY MAX LOCK (Section 2.1)
    const productScaleGuideline = 'Keep product at realistic physical scale (approximately 20-30% of the frame). For fashion styles, use garment scale appropriate to worn outfit framing.';

    const identityLockDirectives = [
      `[PRODUCT IDENTITY MAX LOCK]`,
      `The uploaded product image is an authoritative identity reference for "${product.name}".`,
      `Preserve exact brand, logo, product name, label design, typography, packaging colour, container shape, cap, closure, dispenser, material, texture, and physical proportions across all frames.`,
      productScaleGuideline,
      `Strictly NO product morphing, NO duplicate products, NO changing labels, NO changing packaging colours, NO missing caps, NO oversized bottles, NO floating objects, NO artificial product rotation, NO sudden disappearance, NO unexpected object replacement.`,
    ].join(' ');

    // 2. ZERO UI / PLATFORM / WATERMARK LOCK (Section 2.2)
    // Strictly avoid phrases like "playing on a phone" which triggers device frames
    const zeroUiLockDirectives = [
      `[ZERO UI & WATERMARK LOCK]`,
      `Full-frame vertical 9:16 aspect ratio footage naturally recorded in physical space, WITHOUT displaying any smartphone border, phone mockup frame, or screen bezel.`,
      `Strictly NO TikTok logo, NO social media interface, NO watermark, NO phone frame, NO phone UI overlays, NO fake buttons, NO smartphone mockup, NO embedded video player, NO screen borders, NO playback controls, NO floating captions, NO UI overlay, NO picture-in-picture, NO yellow basket graphics, NO shopping app interface, NO username overlays, NO like/comment/share buttons.`,
    ].join(' ');

    // 3. HUMAN & PHYSICAL REALISM LOCK (Section 2.3)
    const realismDirectives = [
      `[HUMAN & PHYSICAL REALISM LOCK]`,
      `Natural human anatomy, correct body proportions, correct hands and exactly 5 natural fingers per hand.`,
      `Natural skin pores, subtle micro-creases, authentic lifelike eye moisture. Real fabric behaviour, realistic object weight, natural gravity, plausible movement.`,
      `Natural facial expressions, subtle genuine eye movement, believable hand-object contact, realistic mouth movement during speech.`,
      `Strictly NO plastic skin, NO waxy faces, NO synthetic lighting, NO deformed fingers, NO extra hands, NO airbrushed smooth face filter, NO robotic gestures, NO floating products, NO AI-style morphing, NO sudden camera jumps, NO artificial slow motion, NO excessive cinematic effects.`,
    ].join(' ');

    // 4. SHARIAH LOCK V4 (Section 4)
    let modestyDirectives = '';
    if (isMuslimah) {
      if (style.category === 'hand_demo') {
        modestyDirectives = [
          `[SHARIAH MODESTY LOCK V4 — HAND DEMO] Modesty Guardrail:`,
          `Single natural hand if style specifies one hand. Wrist must be fully covered by long sleeve.`,
          `Strictly NO rings, NO bracelets, NO nail polish, NO artificial nails. Exactly 5 correct fingers with realistic proportions.`,
        ].join(' ');
      } else {
        modestyDirectives = [
          `[SHARIAH MODESTY LOCK V4 — PRESENTER] Modesty Guardrail:`,
          `Muslimah presenter: Hijab labuh fully covering hair, neck, and chest securely.`,
          `Loose-fitting clothing, long sleeves covering wrists at all times including arm transitions.`,
          `Strictly NO transparent fabric, NO tight outfits, NO jewellery (no rings, no bracelets, no necklaces), NO unintended hair or neck exposure during movements, NO inappropriate posing.`,
        ].join(' ');
      }
    } else {
      modestyDirectives = `[MODESTY GUIDELINE] Modesty Guardrail: Model wears neat, modern casual everyday attire appropriate for general Malaysian audiences.`;
    }

    // -------------------------------------------------------------------------
    // MASTERPROMPT LOCK V4 — LAYER 2: PRODUCTION PROFILE (UGC vs STUDIO)
    // -------------------------------------------------------------------------
    const profile = options.productionProfile || 'ugc_creator';
    let profileDirectives = '';

    if (profile === 'studio_commercial') {
      profileDirectives = [
        `[PROFILE B: PROFESSIONAL STUDIO / COMMERCIAL]`,
        `Controlled professional studio lighting, clean background, deliberate polished camera composition, elegant natural reflections.`,
      ].join(' ');
    } else {
      // Default: Profile A (Realistic UGC / Creator)
      profileDirectives = [
        `[PROFILE A: REALISTIC UGC / CREATOR]`,
        `Everyday natural smartphone camera quality (high-end iPhone 15 Pro sensor), bright neutral daylight (5500K neutral white balance, strictly NOT dark, NOT yellowish, NO sepia, NO heavy grading).`,
        `Normal 1x camera perspective, one continuous take, subtle handheld micro-shake, ordinary domestic Malaysian room/setting.`,
        `Strictly NO studio-grade artificial lighting, NO dramatic zooming, NO cinematic camera spinning, NO excessive subject movement. Authentic casual creator footage.`,
      ].join(' ');
    }

    // Combine universal masterprompt directives
    const universalMasterPrompt = [
      identityLockDirectives,
      zeroUiLockDirectives,
      realismDirectives,
      modestyDirectives,
      profileDirectives,
    ].join(' ');

    // -------------------------------------------------------------------------
    // MASTERPROMPT LOCK V4 — LAYER 3: ENGINE-SPECIFIC COMPILATION
    // -------------------------------------------------------------------------
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
        ctaMode,
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
    ctaMode: 'spoken_button' | 'spoken_bio' | 'none',
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    // Spoken Script adhering to priority
    const spokenScript = this.resolveSpokenScript(product, style, options);

    // Validate final spoken script
    const scriptValidation = VoiceoverDirector.validateScript(spokenScript, product, 'nexabot');
    if (!scriptValidation.isValid) {
      preflight.isValid = false;
      preflight.errors.push(...scriptValidation.errors);
    }

    // Audio instruction: Natural spoken Bahasa Melayu Malaysia (14-23 words)
    const audioDirective = `Dialogue Language: Malaysian Malay (Bahasa Melayu Malaysia). Tone: Casual, relaxed conversational Malaysian creator tone. Natural native pronunciation for exactly 10 seconds. Script to speak aloud: "${spokenScript}"`;

    // Visual Action description adhering to exact style action
    const visualPrompt = [
      `One single continuous 10-second shot.`,
      `Setting: ${scenePlan.location}.`,
      `Action: ${scenePlan.primaryAction}. ${scenePlan.actionProgression}.`,
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
        'No Indonesia loanwords or slang',
        'Zero UI, no TikTok logo, no phone frame',
        'No unverified medical or cosmetic claims',
        'Product Identity Max Lock enforced',
        'Shariah Modesty Lock V4 enforced',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
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
    // 15-second creative timing progression:
    // 0-4s: Establish product in realistic domestic Malaysian setting
    // 4-10s: One simple, authentic physical interaction matching official style
    // 10-15s: Hold naturally with steady focus and finish without sudden movement
    const timelineGuideline = [
      'Timing Structure: One continuous 15-second physical shot.',
      '0s to 4s: Establish the product naturally in the setting with clear label visibility.',
      '4s to 10s: One simple authentic physical action matching the official style definition.',
      '10s to 15s: Hold naturally and conclude smoothly without abrupt cuts or sudden movements.',
    ].join(' ');

    const visualPrompt = [
      `15-second visual showcase video.`,
      `Setting: ${scenePlan.location}.`,
      `Action: ${scenePlan.primaryAction}.`,
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
        'No spoken voiceover or dialogue',
        'Zero UI, no TikTok logo, no phone frame',
        'Realistic physical movement without morphing',
        'Product Identity Max Lock enforced',
        'Shariah Modesty Lock V4 enforced',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
    };
  }
}

