import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DynamicPromptCompiler } from '../../src/lib/engine/compiler';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { getVideoStyle } from '../../src/lib/styles/registry';

const repo = resolve(import.meta.dirname, '..', '..');
const out = resolve(repo, 'output/expansion-v1-owner-rerun');
const manifest = JSON.parse(readFileSync(resolve(repo, 'output/affimatik-real-v2-release/manifest.json'), 'utf8'));
const selected = ['NX27', 'NX30'] as const;
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
mkdirSync(resolve(out, 'prompts'), { recursive: true });
mkdirSync(resolve(out, 'payloads-private'), { recursive: true });

const product: ProductProfile = {
  name: '', spokenShortName: '', category: '', brand: '', packagingFormat: 'general', shapeDescription: '', dominantColors: [],
  observedPhysicalFacts: [], coreFunction: '', confirmedFeatures: [], sourceConfidence: 'ai_interpreted', provenance: 'manual_user_entry', isVisionSupported: false,
  unknownFields: ['Product-specific attributes not clearly visible remain unverified.'],
  prohibitedClaims: ['Unsupported efficacy, measurable performance, specification, price, popularity, testimonial, guarantee and personal-use claim.'],
};
const directive = 'Use both byte-identical references as one product identity only. Nexabot independently creates the product-specific hook, story and dialogue. Preserve the selected style, realistic physical behaviour, complete customer CTA and full Shariah coverage. Never fabricate personal use, product results, measurable performance or unsupported specifications.';

const jobs = selected.map((styleId) => {
  const baseline = manifest.jobs.find((job: { styleId: string }) => job.styleId === styleId);
  if (!baseline) throw new Error(`${styleId}: baseline fixture missing.`);
  const bytes = readFileSync(baseline.imagePath);
  if (sha(bytes) !== baseline.imageSha256) throw new Error(`${styleId}: reference bytes changed.`);
  const style = getVideoStyle(styleId);
  if (!style) throw new Error(`${styleId}: style missing.`);
  const scene: ScenePlan = {
    mainSubject: 'The exact supplied kitchen product in a believable product-led demonstration',
    location: 'A bright ordinary Malaysian kitchen composed independently from the source image',
    lighting: 'Neutral daylight-balanced real-phone exposure with accurate product colour',
    cameraDistance: 'Natural smartphone 1x framing with believable appliance or cookware scale',
    cameraMovement: 'Only restrained movement motivated by the selected style',
    startPose: 'A fresh live-action opening, never the uploaded still',
    actionProgression: 'One physically plausible ordinary use with stable product geometry',
    endPose: 'Complete the selected CTA once before the cut and settle naturally',
    primaryAction: 'Create a persuasive Malaysian affiliate moment without fake self-use or unsupported performance claims',
    audioPolicy: style.audioMode,
    targetDurationSeconds: 15,
  };
  const compiled = DynamicPromptCompiler.compile(product, style, scene, {
    callToAction: 'custom', customCta: baseline.cta, imageRole: 'reference', isMuslimahModest: true, creativeInstruction: directive,
  });
  if (!compiled.preflightValid) throw new Error(`${styleId}: ${compiled.validationErrors.join('; ')}`);
  for (const required of [`[STYLE ${styleId} — PREDEFINED CONFIGURATION]`, '[NO FAKE SELF-USE TESTIMONIAL — STRICT]', '[PRODUCT SCALE LOCK]', '[SHARIAH MODESTY LOCK']) {
    if (!compiled.providerPrompt.includes(required)) throw new Error(`${styleId}: missing ${required}.`);
  }
  if ((compiled.providerPrompt.split(baseline.cta).length - 1) !== 1) throw new Error(`${styleId}: CTA must occur exactly once in the prompt.`);
  const promptPath = resolve(out, 'prompts', `${styleId}.txt`);
  writeFileSync(promptPath, compiled.providerPrompt);
  const mime = baseline.imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const image = `data:${mime};base64,${bytes.toString('base64')}`;
  const payload = { model: 'omni_flash', mode: 'i2v', prompt: compiled.providerPrompt, telegram_id: 'web', media: [image, image], ratio: 2, resolution: 720, duration: 15, use_unlimited: false };
  const payloadPath = resolve(out, 'payloads-private', `${styleId}.json`);
  writeFileSync(payloadPath, JSON.stringify(payload));
  return {
    styleId, styleName: style.name, cta: baseline.cta, promptPath, payloadPath,
    promptSha256: sha(compiled.providerPrompt), promptLength: compiled.providerPrompt.length,
    imagePath: baseline.imagePath, imageSha256: baseline.imageSha256, imageBytes: bytes.length,
    settings: { model: 'omni_flash', mode: 'i2v', duration: 15, resolution: 720, ratio: 2, referenceCount: 2 },
    idempotencyKey: `affimatik-owner-rerun-${styleId.toLowerCase()}-${sha(compiled.providerPrompt).slice(0, 12)}-${baseline.imageSha256.slice(0, 12)}`,
  };
});

writeFileSync(resolve(out, 'manifest.json'), JSON.stringify({
  campaign: 'AFFIMATIK_OWNER_PENDING_DEMO_RERUN', preparedAt: new Date().toISOString(), sourceCommit: process.env.GIT_SHA ?? 'working-tree',
  authorization: { maximumSubmissions: 2, maximumSupplierCredits: 0.6, automaticRetries: false, customerWalletImpact: 'NONE', productionImpact: 'NONE' }, jobs,
}, null, 2));
writeFileSync(resolve(out, 'submission-ledger.json'), JSON.stringify({ submissionIntents: 0, jobs: Object.fromEntries(jobs.map((job) => [job.styleId, { status: 'PREPARED_NOT_SUBMITTED', taskId: null, idempotencyKey: job.idempotencyKey }])) }, null, 2));
console.log(JSON.stringify({ jobs: jobs.map(({ styleId, promptLength, promptSha256, imageSha256, cta }) => ({ styleId, promptLength, promptSha256, imageSha256, cta })) }, null, 2));
