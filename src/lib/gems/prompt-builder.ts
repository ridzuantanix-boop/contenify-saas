import { PromptPreset } from './presets';

export interface PromptBuildParams {
  preset: PromptPreset;
  productName?: string;
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

  // Dynamic Product Resolution (Optional Input Support)
  const hasCustomProductName = Boolean(productName && productName.trim().length > 0);
  const effectiveProductName = hasCustomProductName ? productName!.trim() : 'produk dalam gambar';
  
  const researchDirective = !hasCustomProductName
    ? 'Product Visual Intelligence: Automatically inspect and analyze the uploaded product image. Identify the exact product package, brand name, label typography, item category, and purpose directly from the image. Showcase this exact physical product naturally in the creator\'s hands.'
    : `Product Focus: Maintain high visual fidelity to the provided product image for ${effectiveProductName}, accurately preserving its package shape, label typography, and branding.`;

  // Spoken Script in authentic Malaysian Malay
  const defaultScript = hasCustomProductName
    ? `Korang tengok ${effectiveProductName} ni, memang sangat berbaloi dan senang nak guna setiap hari. Kualiti memang terbaik!`
    : `Korang tengok barang yang saya pegang ni, memang sangat berbaloi dan senang nak guna setiap hari. Kualiti memang terbaik!`;
  const cleanScript = scriptBody && scriptBody.trim().length > 0 ? scriptBody.trim() : defaultScript;

  // 1. Language & Voice Guidance (Strict Malaysian Malay Spoken Dialogue)
  const voiceRules = [
    'Audio & Spoken Voice: Natural standard Malaysian Malay (Bahasa Melayu standard Malaysia).',
    'Clear native Malaysian pronunciation with natural conversational cadence.',
    'Strictly avoid Indonesian loanwords or dialectal markers (use "sangat berbaloi", "senang guna", not "banget" or "keren").',
    'Strictly NO English dialogue.',
    `Spoken script to voice in video: "${cleanScript}"`,
    'Zero synthetic distortion, articulate studio microphone clarity, realistic human breath and tone, no gibberish.',
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
    ctaSentence = 'Closing spoken call-to-action: "Boleh tengok link di bio untuk maklumat lanjut." (Do NOT generate any onscreen overlay buttons).';
  }

  // 4. Product integrity & facts
  const factsText = productFacts.length > 0 ? productFacts.join(', ') : 'kualiti premium dan fungsi berkesan';

  // 5. Template Expansion
  let promptText = preset.templateText
    .replace('{product_name}', effectiveProductName)
    .replace('{product_facts}', factsText)
    .replace('{script_body}', cleanScript)
    .replace('{problem_hook}', `Dah lama cari solusi terbaik untuk ${productCategory.toLowerCase()}?`)
    .replace('{solution_script}', cleanScript);

  if (avatarDescription) {
    promptText = `${avatarDescription}. ${promptText}`;
  }

  // 6. Hyper-Realism & Malaysian Environment Directives
  const realismDirectives = [
    'Visual Style & Realism: Hyper-realistic raw smartphone UGC video, shot on iPhone 15 Pro, vertical 9:16 aspect ratio.',
    'Atmosphere & Environment: Authentic modern Malaysian indoor setting (clean daylight living room or modern kitchen in a Malaysian home). Bright natural daylight at 5500K neutral temperature, fresh daylight through window.',
    'Lighting & Colors: Crisp daylight, true-to-life vibrant colors, clean balanced whites. Strictly NOT gloomy, NOT dark, NOT yellowish sepia, NO warm mud filters.',
    'Authentic Human Textures: Real human skin with natural pores, subtle micro-creases, natural lifelike eyes with realistic reflections. Strictly NO CGI, NO plastic skin, NO wax doll face, NO 3D animation, NO airbrushed smooth blur, NO artificial glossy glaze.',
  ].join(' ');

  // 7. Masterprompt Compilation
  const masterPromptSections = [
    `[Format]: ${preset.targetDurationSeconds}-second high-fidelity video, ${aspectRatio} vertical format, 24fps cinema grading.`,
    `[Scene & Action]: ${promptText}`,
    ctaSentence ? `[Call to Action]: ${ctaSentence}` : '',
    `[Audio Track]: ${voiceRules}`,
    `[Visual Realism & Atmosphere]: ${realismDirectives}`,
    `[Visual Guardrails]: ${modestyRules} ${researchDirective} Zero phone UI watermarks, no overlay buttons.`,
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
