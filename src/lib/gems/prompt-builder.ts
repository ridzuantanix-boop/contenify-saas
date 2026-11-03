import { PromptPreset } from './presets';

export interface PromptBuildParams {
  preset: PromptPreset;
  productName: string;
  productCategory?: string;
  productFacts?: string[];
  prohibitedClaims?: string[];
  scriptBody?: string;
  isMuslimahModest?: boolean;
  avatarDescription?: string;
  callToAction?: 'spoken_button' | 'spoken_bio' | 'none';
  aspectRatio?: '9:16' | '16:9' | '1:1';
}

export interface CompiledPrompt {
  masterPrompt: string;
  voiceInstruction: string;
  continuityAnchor?: string;
  safetyRules: string[];
}

export function buildUniversalMasterprompt(params: PromptBuildParams): CompiledPrompt {
  const {
    preset,
    productName,
    productCategory = 'General Consumer Product',
    productFacts = [],
    prohibitedClaims = [],
    scriptBody,
    isMuslimahModest = true,
    avatarDescription,
    callToAction = 'spoken_button',
    aspectRatio = '9:16',
  } = params;

  // 1. Language & Voice Guidance (Malaysian Malay Native Guardrails)
  const voiceRules = [
    'Audio & Spoken Voice: Natural standard Malaysian Malay (Bahasa Melayu standard Malaysia).',
    'Clear native Malaysian pronunciation with natural conversational cadence.',
    'Strictly avoid Indonesian loanwords or dialectal markers (use "sangat berbaloi", "senang guna", not "banget" or "keren").',
    'Zero synthetic distortion, articulate studio microphone clarity, no gibberish.',
  ].join(' ');

  // 2. Modesty & Shariah compliance if Muslimah model
  const modestyRules = isMuslimahModest
    ? 'Model Modesty Guardrails: Model wears elegant, proper hijab securely covering hair, ears, and chest. Loose, modest contemporary attire with long sleeves covering wrists. Modest posture, gentle respectful expressions.'
    : 'Model Styling: Modern modest casual attire appropriate for everyday Malaysian audiences.';

  // 3. CTA Formulation (No fake yellow basket button on screen)
  let ctaSentence = '';
  if (callToAction === 'spoken_button') {
    ctaSentence = 'Closing spoken call-to-action: "Tekan butang di bawah untuk dapatkan sekarang." (Do NOT generate any onscreen yellow basket or UI button graphics).';
  } else if (callToAction === 'spoken_bio') {
    ctaSentence = 'Closing spoken call-to-action: "Boleh tengok link di bio untuk maklumat lanjut."';
  }

  // 4. Product integrity & prohibited claim filtering
  const factsText = productFacts.length > 0 ? productFacts.join(', ') : 'Premium quality, authentic finish';
  const cleanScript = scriptBody || `Korang tengok ${productName} ni, memang sangat berbaloi dan senang nak guna setiap hari.`;

  // 5. Template Expansion
  let promptText = preset.templateText
    .replace('{product_name}', productName)
    .replace('{product_facts}', factsText)
    .replace('{script_body}', cleanScript)
    .replace('{problem_hook}', `Dah lama cari solusi terbaik untuk ${productCategory.toLowerCase()}?`)
    .replace('{solution_script}', cleanScript);

  if (avatarDescription) {
    promptText = `${avatarDescription}. ${promptText}`;
  }

  // 6. Masterprompt Compilation
  const masterPromptSections = [
    `[Format]: ${preset.targetDurationSeconds}-second high-fidelity video, ${aspectRatio} vertical format, 24fps cinema grading.`,
    `[Scene & Action]: ${promptText}`,
    ctaSentence ? `[Call to Action]: ${ctaSentence}` : '',
    `[Audio Track]: ${voiceRules}`,
    `[Visual Guardrails]: ${modestyRules} Maintain strict visual fidelity to the provided product reference images, preserving logos, typography, and true colors. Zero phone UI watermarks, no overlay buttons.`,
  ].filter(Boolean);

  const masterPrompt = masterPromptSections.join('\n\n');

  return {
    masterPrompt,
    voiceInstruction: voiceRules,
    continuityAnchor: preset.targetDurationSeconds === 15
      ? 'Towards 14.8s mark, character/product remains centered in frame with steady lighting.'
      : undefined,
    safetyRules: [
      'No medical or miracle cure claims.',
      'No fake platform buttons or UI elements.',
      'Accurate brand representation.',
      ...prohibitedClaims.map(c => `Prohibited claim: ${c}`),
    ],
  };
}
