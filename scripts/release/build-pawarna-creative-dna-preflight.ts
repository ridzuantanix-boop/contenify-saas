import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DynamicPromptCompiler, GEMS_PROMPT_VERSION } from '../../src/lib/engine/compiler';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { getVideoStyle } from '../../src/lib/styles/registry';

const repo = resolve(import.meta.dirname, '..', '..');
const outDir = resolve(repo, 'output/provider-qa/pawarna-creative-dna-reset');
mkdirSync(outDir, { recursive: true });

const product: ProductProfile = {
  name: 'POTONGGO Manual Chopper',
  spokenShortName: 'POTONGGO manual chopper',
  category: 'manual kitchen chopper',
  brand: 'POTONGGO',
  packagingFormat: 'general',
  shapeDescription: 'compact transparent container, turquoise lid and base, white pull handle and visible internal blades',
  dominantColors: ['transparent', 'turquoise', 'white', 'silver'],
  observedPhysicalFacts: ['transparent container', 'turquoise lid and base', 'white pull handle', 'visible internal blades', 'readable POTONGGO brand'],
  confirmedFeatures: ['The pull handle is manually operated and the product is intended to chop ordinary kitchen ingredients.'],
  unknownFields: ['capacity', 'blade material', 'chopping speed', 'durability'],
  prohibitedClaims: ['medical outcome', 'personal testimonial', 'fake review count', 'guaranteed performance'],
  sourceConfidence: 'verified_user',
  provenance: 'source_grounded',
  isVisionSupported: false,
};

const scene: ScenePlan = {
  mainSubject: product.name,
  location: 'A newly composed ordinary Malaysian setting chosen from the product category and selected style',
  lighting: 'Natural neutral smartphone daylight',
  cameraDistance: 'Style-specific realistic smartphone 1x distance',
  cameraMovement: 'Single continuous style-specific handheld movement',
  startPose: 'Immediate live-action opening, never the uploaded still',
  actionProgression: 'Style-specific natural product and human action',
  endPose: 'Natural completed physical action aligned with the spoken ending',
  primaryAction: 'Style-specific product interaction at plausible scale',
  audioPolicy: 'off_camera_narration',
  targetDurationSeconds: 15,
};

const cases = [
  { id: 'NX01', audioTreatment: 'voiceover' as const, callToAction: 'tiktok_shop' as const },
  { id: 'NX09', audioTreatment: 'voiceover' as const, callToAction: 'tiktok_shop' as const },
  { id: 'NX15', audioTreatment: 'voiceover' as const, callToAction: 'click_button' as const },
  { id: 'RH03', audioTreatment: 'voiceover' as const, callToAction: 'tap_button' as const },
  { id: 'RH03', suffix: 'ambient', audioTreatment: 'ambient' as const, callToAction: 'none' as const },
];

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const manifest = [];

for (const item of cases) {
  const style = getVideoStyle(item.id);
  if (!style) throw new Error(`Missing style ${item.id}`);
  const compiled = DynamicPromptCompiler.compile(product, style, { ...scene, audioPolicy: style.audioMode }, {
    callToAction: item.callToAction,
    audioTreatment: item.audioTreatment,
    imageRole: 'reference',
    isMuslimahModest: true,
    creativeInstruction: 'Preserve spontaneous Malaysian affiliate energy and the selected style identity. Nexabot creates all dialogue.',
  });
  if (!compiled.preflightValid) throw new Error(`${item.id} preflight failed: ${compiled.validationErrors.join('; ')}`);
  const fileName = `${item.id.toLowerCase()}${item.suffix ? `-${item.suffix}` : ''}-compiled-provider-prompt.txt`;
  const promptPath = resolve(outDir, fileName);
  writeFileSync(promptPath, compiled.providerPrompt, 'utf8');
  manifest.push({
    styleId: item.id,
    audioTreatment: item.audioTreatment,
    ctaMode: item.callToAction,
    promptVersion: compiled.promptVersion,
    promptPath,
    promptLength: compiled.providerPrompt.length,
    promptSha256: sha256(compiled.providerPrompt),
    hasInternalScript: Boolean(compiled.spokenScript),
    hasPawarnaCreativeDna: compiled.providerPrompt.includes('[PAWARNA CREATIVE DNA — TEST A OWNER GOLD STANDARD]'),
    hasStyleApplication: compiled.providerPrompt.includes('Pawarna Creative DNA application:'),
    hasOldClauseLimit: /two, or at most three|one compact spoken turn/i.test(compiled.providerPrompt),
    hasOld115Deadline: compiled.providerPrompt.includes('second 11.5'),
    has45To55Target: compiled.providerPrompt.includes('45–55 spoken Malay words'),
    isSoundOnly: item.audioTreatment === 'ambient',
    containsDialogueDirective: compiled.providerPrompt.includes('[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]'),
  });
}

const result = {
  createdAt: new Date().toISOString(),
  promptVersion: GEMS_PROMPT_VERSION,
  providerSubmissions: 0,
  productionDeployments: 0,
  product: product.name,
  representativeCases: manifest,
};
writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
