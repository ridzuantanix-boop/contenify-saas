import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DynamicPromptCompiler, GEMS_PROMPT_VERSION } from '../../src/lib/engine/compiler';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { getVideoStyle, VIDEO_STYLES_REGISTRY } from '../../src/lib/styles/registry';

const repo = resolve(import.meta.dirname, '..', '..');
const out = resolve(repo, 'output/affimatik-real-v2-release');
const prompts = resolve(out, 'prompts');
mkdirSync(prompts, { recursive: true });

const ownerRoot = 'C:/Users/user/.codex/codex-remote-attachments/01a1a93c-06c3-7a63-9909-599706e05606';
const asset = (path: string) => resolve(repo, path);
const products = {
  sherb: { label: 'Owner-authorized S-HERB screenshot', path: `${ownerRoot}/A26B9D5E-5503-41BD-9CCF-A94B485CE8DF/1-Photo-1.jpg`, license: 'Owner supplied and authorized' },
  vitamin: { label: 'Owner-authorized Vitamin C+E image', path: `${ownerRoot}/BDED2172-20A7-4BB5-86B1-1F18CCFDDD81/2-Photo-2.jpg`, license: 'Owner supplied and authorized' },
  seriya: { label: 'SERIYA serum test fixture', path: asset('scripts/release/assets/premium-products/seriya-serum.png'), license: 'AffiMatik authorized fixture' },
  veile: { label: 'VEILÉ sun-fluid test fixture', path: asset('scripts/release/assets/premium-products/veile-sun-fluid.png'), license: 'AffiMatik authorized fixture' },
  lumea: { label: 'LUMÉA supplement test fixture', path: asset('scripts/release/assets/premium-products/lumea-collagen.png'), license: 'AffiMatik authorized fixture' },
  aromae: { label: 'AROMAÉ home-mist test fixture', path: asset('scripts/release/assets/premium-products/aromae-home-mist.png'), license: 'AffiMatik authorized fixture' },
  potonggo: { label: 'POTONGGO chopper test fixture', path: asset('scripts/release/assets/premium-products/potonggo-chopper.png'), license: 'AffiMatik authorized fixture' },
  kurung: { label: 'Baju kurung museum fixture', path: asset('output/expansion-v1-real-qa/fixtures/NX21-baju-kurung.jpg'), license: 'CC0 1.0 · Asian Civilisations Museum / Wikimedia Commons' },
  kebaya: { label: 'Baju kebaya fixture', path: asset('scripts/release/assets/real-v2/NX22-baju-kebaya.jpg'), license: 'CC BY-SA 3.0 · Ma Hzi Wong / Wikimedia Commons' },
  tudung: { label: 'Tudung mannequin fixture', path: asset('output/expansion-v1-real-qa/fixtures/NX23-tudung.jpg'), license: 'CC BY 2.0 · Wikimedia Commons contributor' },
  ootd: { label: 'Modest blue outfit fixture', path: asset('scripts/release/assets/real-v2/NX24-modest-ootd.jpg'), license: 'CC BY-SA 4.0 · Hauwasysy / Wikimedia Commons' },
  kids: { label: 'Child garment museum fixture', path: asset('output/expansion-v1-real-qa/fixtures/NX25-kids-outfit.jpg'), license: 'Public domain · DPLA / Wikimedia Commons' },
  wok: { label: 'Wok fixture', path: asset('output/expansion-v1-real-qa/fixtures/NX27-wok.jpg'), license: 'CC BY 2.0 · Chris Feldmann / Wikimedia Commons' },
  fryer: { label: 'Air fryer fixture', path: asset('output/expansion-v1-real-qa/fixtures/NX28-air-fryer.jpg'), license: 'CC BY 2.0 · I am R. / Wikimedia Commons' },
  microwave: { label: 'Microwave fixture', path: asset('output/expansion-v1-real-qa/fixtures/NX29-microwave.jpg'), license: 'CC BY-SA 4.0 · Dinkun Chen / Wikimedia Commons' },
} as const;

const plan = [
  ['NX01','sherb','tekan beg kuning'], ['NX02','vitamin','tekan butang di bawah'], ['NX03','seriya','tengok detail dekat bawah'],
  ['NX05','lumea','kalau nak cuba, tekan beg kuning'], ['NX07','veile','kalau nak tengok lebih lanjut, klik butang di bawah'],
  ['NX09','aromae','kalau nak semak, boleh tekan di bawah'], ['NX10','vitamin','tekan beg kuning'],
  ['RH01','seriya','tekan butang di bawah'], ['RH02','veile','tengok detail dekat bawah'], ['RH03','lumea','kalau nak cuba, tekan beg kuning'],
  ['RH04','sherb','kalau nak tengok lebih lanjut, klik butang di bawah'], ['RH17','potonggo','kalau nak semak, boleh tekan di bawah'],
  ['RH19','aromae','tekan beg kuning'], ['NX11','sherb','tekan butang di bawah'], ['NX12','seriya','tengok detail dekat bawah'],
  ['NX13','potonggo','kalau nak cuba, tekan beg kuning'], ['NX14','vitamin','kalau nak tengok lebih lanjut, klik butang di bawah'],
  ['NX15','lumea','kalau nak semak, boleh tekan di bawah'], ['NX16','veile','tekan beg kuning'], ['NX17','seriya','tekan butang di bawah'],
  ['NX21','kurung','tekan beg kuning'], ['NX22','kebaya','tekan butang di bawah'], ['NX23','tudung','tengok detail dekat bawah'],
  ['NX24','ootd','kalau nak cuba, tekan beg kuning'], ['NX25','kids','kalau nak tengok lebih lanjut, klik butang di bawah'],
  ['NX26','kurung','kalau nak semak, boleh tekan di bawah'], ['NX27','wok','tekan beg kuning'],
  ['NX28','fryer','tekan butang di bawah'], ['NX29','microwave','tengok detail dekat bawah'], ['NX30','potonggo','kalau nak cuba, tekan beg kuning'],
] as const;

if (plan.length !== 30 || new Set(plan.map(([id]) => id)).size !== 30) throw new Error('REAL V2 requires exactly 30 unique styles.');
if (new Set(VIDEO_STYLES_REGISTRY.map((style) => style.id)).size !== 30) throw new Error('Registry is not the expected 30-style catalogue.');
for (const style of VIDEO_STYLES_REGISTRY) if (!plan.some(([id]) => id === style.id)) throw new Error(`Missing plan for ${style.id}.`);

const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const neutral: ProductProfile = {
  name: '', spokenShortName: '', category: '', brand: '', packagingFormat: 'general', shapeDescription: '', dominantColors: [],
  observedPhysicalFacts: [], coreFunction: '', confirmedFeatures: [],
  unknownFields: ['Any product-specific attribute not clearly visible in the supplied image remains unverified.'],
  prohibitedClaims: ['Unsupported efficacy, medical outcome, specification, price, popularity, testimonial, guarantee and personal-use claim.'],
  sourceConfidence: 'ai_interpreted', provenance: 'manual_user_entry', isVisionSupported: false,
};
const handLed = new Set(['NX09','NX10','RH01','RH02','RH03','RH04','RH17','RH19','NX11','NX25','NX26','NX27','NX28']);
const jobs = [];
for (const [styleId, productKey, cta] of plan) {
  const product = products[productKey];
  const style = getVideoStyle(styleId);
  if (!style || !existsSync(product.path)) throw new Error(`${styleId}: missing style or authorized product fixture ${product.path}.`);
  const scene: ScenePlan = {
    mainSubject: handLed.has(styleId) ? 'The exact supplied product in its style-specific hand-led or product-led presentation' : 'A modest adult Malaysian creator presenting the exact supplied product',
    location: 'A newly composed ordinary Malaysian environment selected from the recognized category and unique style; never copy the reference composition',
    lighting: 'Bright readable neutral-daylight smartphone exposure with accurate product and skin colour',
    cameraDistance: 'Style-specific natural smartphone 1x framing with physically believable product scale',
    cameraMovement: 'Only the selected director’s motivated real-phone camera behaviour',
    startPose: 'A new live-action opening from frame zero; never the uploaded still as the first frame',
    actionProgression: 'One physically plausible style-specific action with stable product identity',
    endPose: 'Complete the selected CTA once, then allow the physical take to settle naturally without more speech',
    primaryAction: 'Create a persuasive Malaysian affiliate moment while preserving exact visible identity, scale and physics',
    audioPolicy: style.audioMode,
    targetDurationSeconds: 15,
  };
  const creativeInstruction = 'Use the two byte-identical references only as one product identity authority. Nexabot independently interprets the image and writes every product-specific spoken word. Preserve the selected style’s distinct scene, camera, performance and audio identity. Do not copy screenshot UI or source composition. Do not invent objectively false facts, regulated outcomes, personal experience, prices, reviews or performance guarantees. Keep compact handheld objects near the REAL V2 12–18% scale target and larger garments or appliances at believable real-world dimensions.';
  const compiled = DynamicPromptCompiler.compile(neutral, style, scene, { callToAction: 'custom', customCta: cta, imageRole: 'reference', isMuslimahModest: true, creativeInstruction });
  if (!compiled.preflightValid) throw new Error(`${styleId}: ${compiled.validationErrors.join('; ')}`);
  for (const marker of ['[PAWARNA TRUE COLOR™ — REAL V2 GLOBAL QUALITY FOUNDATION]','[PAWARNA HUMAN VOICE™ — REAL V2 GLOBAL QUALITY FOUNDATION]','[PRODUCT SCALE LOCK]','[SHARIAH MODESTY LOCK']) {
    if (!compiled.providerPrompt.includes(marker)) throw new Error(`${styleId}: missing ${marker}.`);
  }
  if (/20\s*(?:%|percent)?\s*(?:–|-|to)\s*30%/i.test(compiled.providerPrompt)) throw new Error(`${styleId}: obsolete product scale leaked.`);
  if (/40\s*(?:–|-|to)\s*48\s+spoken/i.test(compiled.providerPrompt)) throw new Error(`${styleId}: obsolete universal word count leaked.`);
  const bytes = readFileSync(product.path);
  const promptPath = resolve(prompts, `${styleId}.txt`);
  writeFileSync(promptPath, compiled.providerPrompt, 'utf8');
  jobs.push({ styleId, styleName: style.name, productKey, productLabel: product.label, imagePath: product.path, imageLicense: product.license, imageSha256: sha(bytes), imageBytes: bytes.length, cta, promptPath, promptLength: compiled.providerPrompt.length, promptSha256: sha(compiled.providerPrompt), promptVersion: GEMS_PROMPT_VERSION, mediaCount: 2, mediaOrder: ['same-source-image','same-source-image'], preflightValid: true });
}

const manifest = {
  campaign: 'AFFIMATIK_REAL_V2_FULL_PRODUCTION_RELEASE', createdAt: new Date().toISOString(), sourceCommit: process.env.REAL_V2_SOURCE_COMMIT || 'working-tree-precommit',
  provider: 'Nexabot', model: 'omni_flash', mode: 'i2v', duration: 15, resolution: 720, ratio: 2, useUnlimited: false,
  exactInitialSubmissionLimit: 30, expectedCostPerJob: 0.3, totalSupplierBudget: 15, automaticRetries: false,
  productionCustomerWalletImpact: 'NONE', jobs,
};
writeFileSync(resolve(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(resolve(out, 'STATIC-PREFLIGHT.md'), `# AffiMatik REAL V2 static preflight\n\n- Styles compiled: **30/30**\n- Unique prompt hashes: **${new Set(jobs.map((job) => job.promptSha256)).size}/30**\n- Prompt version: \`${GEMS_PROMPT_VERSION}\`\n- REAL V2 global color foundation: **PASS**\n- REAL V2 global human-voice foundation: **PASS**\n- Product scale 12–18% / category-realistic larger products: **PASS**\n- Shariah Lock: **PASS**\n- Obsolete 20–30% scale instruction: **ABSENT**\n- Universal spoken word-count target: **ABSENT**\n- Customer wallet charge: **NONE**\n`);
console.log(JSON.stringify({ styles: jobs.length, uniquePrompts: new Set(jobs.map((job) => job.promptSha256)).size, products: new Set(jobs.map((job) => job.productKey)).size, promptLength: { min: Math.min(...jobs.map((job) => job.promptLength)), max: Math.max(...jobs.map((job) => job.promptLength)) } }, null, 2));
