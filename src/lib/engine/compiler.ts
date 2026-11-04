/**
 * AFFIMATIK by Pawarna — Dynamic Prompt Engine Compiler (V3)
 * Translates Product Profile + Video Style + Scene Plan into Provider-Specific Payloads
 * 
 * Strict Priorities:
 * 1. Customer-customized approved script
 * 2. Product-specific dynamically generated script using confirmed facts
 * 3. Safe category-aware fallback script
 */

import { ProductProfile, ScenePlan, CompiledGenerationPrompt } from './types';
import { VideoStyle } from '../styles/types';
import { VoiceoverDirector } from './voiceover-director';

export interface CompilerOptions {
  callToAction?: 'spoken_button' | 'spoken_bio' | 'none';
  isMuslimahModest?: boolean;
  customScript?: string;
  creativeInstruction?: string;
  imageRole?: 'reference' | 'start_frame';
}

export interface PromptPreviewResult {
  provider: 'nexabot' | 'runninghub';
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
   * Deterministic preflight validation
   */
  static validatePreflight(
    product: ProductProfile,
    style: VideoStyle,
    options?: CompilerOptions
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Engine and duration validation
    if (style.engine === 'nexabot' && style.durationSeconds !== 10) {
      errors.push(`Gaya Nexabot (${style.id}) mesti tepat 10 saat.`);
    }
    if (style.engine === 'runninghub' && style.durationSeconds !== 15) {
      errors.push(`Gaya RunningHub (${style.id}) mesti tepat 15 saat.`);
    }

    // Hard Rule: RunningHub styles must NOT have voiceover
    if (style.engine === 'runninghub' && style.audioMode !== 'no_speech' && style.audioMode !== 'ambient') {
      errors.push(`Gaya RunningHub (${style.id}) tidak menyokong suara percakapan.`);
    }

    // Check custom script submitted to RunningHub
    if (style.engine === 'runninghub' && options?.customScript && options.customScript.trim().length > 0) {
      errors.push(`Gaya 15 saat RunningHub adalah visual sepenuhnya dan tidak menerima sebarang skrip pertuturan.`);
    }

    // Voiceover validation if custom script is provided for Nexabot
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
   * Resolves the spoken script adhering strictly to the V3 priority order:
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
    return VoiceoverDirector.generateAuthenticScript(product, style, ctaMode);
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

    let modestyRules = 'Pemakaian santai kontemporari sopan bersesuaian khalayak Malaysia.';
    if (isMuslimah) {
      if (style.category === 'hand_demo') {
        modestyRules = 'Satu tangan sahaja dengan pergelangan tangan bertutup lengan baju, tiada cincin/pengilat kuku.';
      } else {
        modestyRules = 'Bertudung sempurna menutup rambut, leher dan dada; pakaian longgar berlengan panjang.';
      }
    }

    const visualSummary = `Satu babak visual berterusan ${style.durationSeconds} saat. ${scenePlan.primaryAction}. Produk kekal pada skala 20-30% bingkai tanpa morphing atau hilang.`;

    return {
      provider: style.engine,
      durationSeconds: style.durationSeconds,
      creditCost: style.engine === 'nexabot' ? 10 : 15,
      spokenScript: style.engine === 'nexabot' ? spokenScript : null,
      visualSummary,
      sceneEnvironment: scenePlan.location,
      cameraProfile: 'Kamera telefon pintar 9:16 menegak, 1x perspektif, micro-shake halus tanpa kesan putaran/zoom melampau.',
      modestyRules,
      productIdentityRules: `Mengekalkan identiti visual produk ${product.name} (bentuk botol/bungkusan, warna, logo dan label).`,
      audioDirective: style.engine === 'nexabot' ? 'Suara bahasa Melayu santai bersahaja, tiada slanga luar.' : 'Tiada audio percakapan (visual tulen).',
    };
  }

  /**
   * Compiles the complete payload for the specified provider
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

    // 1. Universal Realism & Camera Directives
    const realismDirectives = [
      'Raw smartphone UGC video, shot on iPhone 15 Pro, vertical 9:16 aspect ratio.',
      `Setting: ${scenePlan.location}.`,
      `Lighting: ${scenePlan.lighting}. Natural clean daylight 5500K neutral white balance. Strictly NOT dark, NOT yellowish, NO sepia, NO heavy color grading.`,
      'Camera Dynamics: One continuous take with subtle handheld micro-shake. Normal 1x perspective. Strictly NO dramatic zoom, NO camera spinning, NO cinematic lens flares.',
      'Human Realism: Real human skin with natural pores, subtle micro-creases, authentic lifelike eye moisture. Strictly NO CGI, NO plastic skin, NO 3D animation, NO airbrushed smooth face filter.',
      'Clean Framing: Strictly NO phone UI overlays, NO fake buttons, NO watermarks, NO icons, NO subtitles burned into video.',
    ].join(' ');

    // 2. Product Identity Lock Directives (Scale ~20-30% of frame)
    const identityLockDirectives = [
      `Product Identity Continuity: The physical product ${product.name} is an identity reference.`,
      'Preserve package shape, label typography, cap/closure, and authentic colors in every frame.',
      'Keep product at realistic physical scale (approximately 20-30% of the frame).',
      'Strictly NO product morphing, NO vanishing, and NO abrupt resizing.',
    ].join(' ');

    // 3. Modesty / Shariah Lock
    let modestyDirectives = '';
    if (isMuslimah) {
      if (style.category === 'hand_demo') {
        modestyDirectives = 'Modesty Guardrail: Single natural hand with wrist properly covered by long sleeve. No nail polish, no gaudy rings or bracelets.';
      } else {
        modestyDirectives = 'Modesty Guardrail: Model wears proper, elegant hijab securely covering hair, neck, and chest. Loose everyday attire with sleeves covering wrists. Natural pleasant facial expressions.';
      }
    } else {
      modestyDirectives = 'Model Styling: Modern casual everyday attire appropriate for general Malaysian audiences.';
    }

    // 4. Engine-Specific Construction
    if (style.engine === 'runninghub') {
      return this.compileRunningHub(
        product,
        style,
        scenePlan,
        realismDirectives,
        identityLockDirectives,
        modestyDirectives,
        preflight
      );
    } else {
      return this.compileNexabot(
        product,
        style,
        scenePlan,
        options,
        realismDirectives,
        identityLockDirectives,
        modestyDirectives,
        ctaMode,
        preflight
      );
    }
  }

  /**
   * Nexabot Compiler (10s, Malaysian Malay Spoken Dialogue)
   */
  private static compileNexabot(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    options: CompilerOptions,
    realismDirectives: string,
    identityLockDirectives: string,
    modestyDirectives: string,
    ctaMode: 'spoken_button' | 'spoken_bio' | 'none',
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    // Spoken Script adhering to V3 priority
    const spokenScript = this.resolveSpokenScript(product, style, options);

    // Validate final spoken script
    const scriptValidation = VoiceoverDirector.validateScript(spokenScript, product, 'nexabot');
    if (!scriptValidation.isValid) {
      preflight.isValid = false;
      preflight.errors.push(...scriptValidation.errors);
    }

    // Spoken audio instruction (Nexabot voice synthesis)
    const audioDirective = `Dialogue Language: Malaysian Malay (Bahasa Melayu Malaysia). Tone: Casual, relaxed conversational Malaysian creator tone. Natural native pronunciation for exactly 10 seconds. Script to speak aloud: "${spokenScript}"`;

    // Visual Action description
    const visualPrompt = [
      `One single continuous 10-second shot.`,
      `Action: ${scenePlan.primaryAction}. ${scenePlan.actionProgression}.`,
      realismDirectives,
      identityLockDirectives,
      modestyDirectives,
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
        'No Indonesia loanwords or slang',
        'No fake UI buttons or text overlays',
        'No unverified medical or cosmetic claims',
        'No product morphing or sudden resizing',
        'Proper modesty coverage enforced',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
    };
  }

  /**
   * RunningHub Compiler (15s, Continuous Visual Scene, No Spoken Dialogue)
   */
  private static compileRunningHub(
    product: ProductProfile,
    style: VideoStyle,
    scenePlan: ScenePlan,
    realismDirectives: string,
    identityLockDirectives: string,
    modestyDirectives: string,
    preflight: { isValid: boolean; errors: string[] }
  ): CompiledGenerationPrompt {
    // 15-second creative timing progression:
    // 0-4s: Establish product in realistic domestic Malaysian setting
    // 4-10s: One simple, authentic physical interaction (holding or gently tilting)
    // 10-15s: Hold naturally with steady focus and finish without sudden movement
    const timelineGuideline = [
      'Timing Structure: One continuous 15-second physical shot.',
      '0s to 4s: Establish the product naturally in the setting with clear label visibility.',
      '4s to 10s: One simple authentic physical action (such as holding or slightly tilting the product).',
      '10s to 15s: Hold naturally and conclude smoothly without abrupt cuts or sudden movements.',
    ].join(' ');

    const visualPrompt = [
      `15-second silent visual showcase video.`,
      `Action: ${scenePlan.primaryAction}.`,
      timelineGuideline,
      realismDirectives,
      identityLockDirectives,
      modestyDirectives,
      'Audio: Purely silent visuals or ambient background sound only. Strictly NO spoken dialogue and NO lip-sync movement.',
    ].join(' ');

    return {
      provider: 'runninghub',
      providerPrompt: visualPrompt,
      visualPrompt,
      continuityAnchor: `${product.name} (steady frame hold at 14.8s mark)`,
      audioDirective: 'No spoken dialogue or lip-sync movements (Visual showcase only).',
      safetyRules: [
        'No spoken voiceover or dialogue',
        'No fake UI overlays or floating graphics',
        'Realistic physical movement without morphing',
        'Respectful modesty compliance',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
    };
  }
}
