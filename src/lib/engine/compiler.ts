/**
 * AFFIMATIK by Pawarna — Dynamic Prompt Engine (Compiler)
 * Translates Product Profile + Video Style + Scene Plan into Provider-Specific Payloads
 */

import { ProductProfile, ScenePlan, CompiledGenerationPrompt } from './types';
import { VideoStyle } from '../styles/types';
import { VoiceoverDirector } from './voiceover-director';

export interface CompilerOptions {
  callToAction?: 'spoken_button' | 'spoken_bio' | 'none';
  isMuslimahModest?: boolean;
  customScript?: string;
  creativeInstruction?: string;
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
      errors.push(`Gaya 15 saat RunningHub tidak menerima sebarang skrip pertuturan.`);
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

    // 1. Universal Realism Engine Directives
    const realismDirectives = [
      'Visual Realism: Ultra-realistic raw smartphone UGC video, shot on iPhone 15 Pro, vertical 9:16 aspect ratio.',
      `Setting: ${scenePlan.location}.`,
      `Lighting: ${scenePlan.lighting}. Natural clean white balance at 5500K neutral daylight. Strictly NOT gloomy, NOT dark, NOT yellowish, NO sepia tint, NO heavy orange/teal grading.`,
      'Human Consistency: Real human skin with natural pores, subtle micro-creases, authentic lifelike eye moisture. Strictly NO CGI, NO plastic skin, NO wax figure appearance, NO 3D animation, NO airbrushed smooth face filter, NO artificial glossy glaze.',
      'Camera Dynamics: Natural subtle handheld smartphone micro-shake. Normal 1x focal perspective. Strictly NO dramatic zoom, NO drone camera, NO artificial lens flares.',
    ].join(' ');

    // 2. Product Identity Lock Directives
    const isInterpreted = product.sourceConfidence === 'ai_interpreted';
    const identityLockDirectives = isInterpreted
      ? 'Product Identity Lock: Automatically inspect the physical product package, brand name, label typography, shape, and colors from the provided image reference. Maintain faithful recognizable continuity of this exact product item in all frames without distortion, morphing, or disappearing.'
      : `Product Identity Lock: Maintain strict visual fidelity to ${product.name}. Preserve package shape, label typography, branding logos, cap/closure details, and authentic colors in every frame. No morphing or sudden resizing.`;

    // 3. Modesty / Shariah Lock
    let modestyDirectives = '';
    if (isMuslimah) {
      if (style.category === 'hand_demo') {
        modestyDirectives = 'Modesty Guardrail: Single natural hand with covered wrist by clothing sleeve. No nail polish, no gaudy rings or bracelets.';
      } else {
        modestyDirectives = 'Modesty Guardrail: Model wears proper, elegant hijab securely covering hair, neck, and chest. Loose, modest contemporary everyday attire with long sleeves covering wrists. Respectful natural facial expressions.';
      }
    } else {
      modestyDirectives = 'Model Styling: Modern modest casual everyday attire appropriate for Malaysian audiences.';
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
    // Spoken Script in authentic Malaysian Malay (14-23 words concise)
    let spokenScript = '';
    if (options.customScript && options.customScript.trim().length > 0) {
      spokenScript = options.customScript.trim();
    } else if (style.actionPlan.scriptTemplate) {
      spokenScript = style.actionPlan.scriptTemplate;
    } else {
      spokenScript = VoiceoverDirector.generateAuthenticScript(product, style, ctaMode);
    }

    // CTA Formulation
    let ctaInstruction = '';
    if (ctaMode === 'spoken_button') {
      ctaInstruction = 'Closing spoken call-to-action: "Tekan butang di bawah untuk dapatkan sekarang." (Do NOT generate any onscreen yellow basket or UI button graphics).';
    } else if (ctaMode === 'spoken_bio') {
      ctaInstruction = 'Closing spoken call-to-action: "Boleh tengok link di bio untuk maklumat lanjut." (Do NOT generate any onscreen overlay graphics).';
    }

    // Audio Track Directives (Strict native Malaysian Malay, No English, No Indonesian)
    const audioDirective = [
      'Audio & Spoken Voice: Natural standard Malaysian Malay (Bahasa Melayu standard Malaysia).',
      'Clear native Malaysian pronunciation with natural conversational cadence.',
      'Strictly avoid Indonesian loanwords or dialectal markers (use "sangat berbaloi", "senang guna", not "banget" or "keren").',
      'Strictly NO English dialogue.',
      `Spoken script to voice in video: "${spokenScript}"`,
      'Zero synthetic distortion, articulate studio microphone clarity, realistic human breath, no robotic monotone.',
    ].join(' ');

    const visualPrompt = [
      `[Format]: 10-second authentic smartphone video, vertical 9:16 aspect ratio, natural 24fps handheld recording.`,
      `[Scene & Action]: ${scenePlan.mainSubject} performing ${scenePlan.primaryAction}. Starting from: ${scenePlan.startPose}. Action: ${scenePlan.actionProgression}. Ending with: ${scenePlan.endPose}.`,
      ctaInstruction ? `[Call to Action]: ${ctaInstruction}` : '',
      `[Visual Realism & Atmosphere]: ${realismDirectives}`,
      `[Product & Guardrails]: ${identityLockDirectives} ${modestyDirectives} Zero phone UI watermarks, no overlay buttons.`,
    ].filter(Boolean).join('\n\n');

    const providerPrompt = [
      visualPrompt,
      `[Audio Track]: ${audioDirective}`,
    ].join('\n\n');

    return {
      provider: 'nexabot',
      providerPrompt,
      visualPrompt,
      spokenScript,
      audioDirective,
      safetyRules: [
        'Strictly Malaysian Malay spoken dialogue',
        'No Indonesian loanwords (no banget, keren, gue, nggak)',
        'No fake onscreen yellow basket graphics',
        'Preserve modest clothing guidelines',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
    };
  }

  /**
   * RunningHub Compiler (15s, Strictly NO Speech, Visual Realism Priority)
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
    const audioDirective = 'Audio Policy: Strictly NO spoken dialogue, NO voiceover narration, NO lip-sync, NO intelligible human speech. Pure silent video or subtle natural ambient room presence.';

    const continuityAnchor = 'At 14.8s mark, character hand and product remain steady and centered in frame with continuous natural daylight.';

    const visualPrompt = [
      `[Format]: 15-second authentic smartphone video, vertical 9:16 aspect ratio, natural 24fps handheld recording.`,
      `[Primary Physical Action]: ${scenePlan.mainSubject} performing ${scenePlan.primaryAction}.`,
      `[Scene Progression]: Starting at ${scenePlan.startPose}. Physical movement: ${scenePlan.actionProgression}. Ending at: ${scenePlan.endPose}.`,
      `[Visual Realism]: ${realismDirectives}`,
      `[Product Identity Lock]: ${identityLockDirectives}`,
      `[Modesty & Continuity]: ${modestyDirectives} ${continuityAnchor}`,
      `[Strict Constraint]: Strictly NO spoken dialogue, no voiceover narration, no text overlays, no phone UI frames.`,
    ].join('\n\n');

    return {
      provider: 'runninghub',
      providerPrompt: visualPrompt,
      visualPrompt,
      continuityAnchor,
      audioDirective,
      safetyRules: [
        'RunningHub 15-second styles must not contain spoken voiceover',
        'Preserve product identity across 15 seconds',
        'No morphing or distortion during movement',
        'Covered wrists on hand demo',
      ],
      preflightValid: preflight.isValid,
      validationErrors: preflight.errors,
    };
  }
}
