import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DynamicPromptCompiler } from '../../src/lib/engine/compiler';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { getVideoStyle } from '../../src/lib/styles/registry';

const repo = resolve(import.meta.dirname, '..', '..');
const sourcePath = resolve(repo, 'scripts/release/fixtures/pov-affiliate-goyang-v6.1-original.txt');
const imagePath = resolve(repo, 'scripts/release/assets/premium-products/potonggo-chopper.png');
const outDir = resolve(repo, 'output/provider-qa/direct-vs-compiler-ab');
const cta = 'Kalau nak tengok detail, tekan beg kuning sekarang.';

mkdirSync(outDir, { recursive: true });

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const source = readFileSync(sourcePath, 'utf8');
const image = readFileSync(imagePath);

const changes: Array<{ from: string; to: string; reason: string; count: number }> = [];
let direct = source;
function replaceExact(from: string, to: string, reason: string) {
  const count = direct.split(from).length - 1;
  if (count === 0) throw new Error(`Required source fragment not found: ${from}`);
  direct = direct.split(from).join(to);
  changes.push({ from, to, reason, count });
}

replaceExact('within 10 seconds', 'within 15 seconds', 'Match the active Nexabot 15-second workflow.');
replaceExact('EXACTLY 10-second', 'EXACTLY 15-second', 'Match the active Nexabot 15-second workflow.');
replaceExact('entire 10-second video', 'entire 15-second video', 'Match the active Nexabot 15-second workflow.');
replaceExact('CTA begins approximately 6.8–7.4 seconds.', 'CTA begins approximately 9.0–10.2 seconds.', 'Give the same final CTA enough room in a 15-second clip.');
replaceExact('CTA must be completely finished by approximately 9.2 seconds.', 'CTA must be completely finished by approximately 12.0 seconds.', 'Leave a silent physical ending after the CTA in a 15-second clip.');
replaceExact('Tekan button di bawah, okay?', cta, 'Use the owner-supplied identical CTA in both experiment arms.');
replaceExact('- beg kuning\n- yellow basket\n', '', 'Remove the original CTA blacklist that directly contradicts the owner-selected CTA.');

const compatibilityBlock = [
  '',
  '==================================================',
  'CONTROLLED NEXABOT A/B TEST INPUT — TECHNICAL COMPATIBILITY APPENDIX',
  '==================================================',
  'Provider output: one exactly 15-second vertical 9:16 i2v video at 720p.',
  'The two supplied media entries are byte-identical copies of one PRODUCT IDENTITY reference. They represent one product only. They are not start frames, scene layouts, background plates or compositions to reproduce.',
  'Product identity observed in the authorized image: POTONGGO manual kitchen chopper; compact transparent container; turquoise lid, base and central spindle; white pull handle; visible metal blades; readable POTONGGO brand.',
  'Customer-confirmed ordinary product fact: the pull handle is manually operated and the product is intended to chop ordinary kitchen ingredients.',
  'Unsupported and prohibited: chopping speed, blade material, capacity, durability, safety superiority, popularity, reviews, testimonial, personal ownership or personal-use result. Omit rather than invent.',
  `Required final spoken CTA, once only: "${cta}"`,
  'The CTA is the final spoken utterance. After its last word, generate no new word, syllable, phoneme, tagline, thanks, repetition or verbal filler. Continue only natural silent hand action and ordinary room sound.',
  'No popularity or scarcity evidence was supplied, so omit FOMO rather than inventing it.',
  'Nexabot independently creates all product-related Malaysian Malay dialogue. No product script is supplied by AffiMatik.',
  '',
].join('\n');
direct += compatibilityBlock;

const product: ProductProfile = {
  name: 'POTONGGO Manual Chopper',
  spokenShortName: 'POTONGGO manual chopper',
  category: 'manual kitchen chopper',
  brand: 'POTONGGO',
  packagingFormat: 'general',
  shapeDescription: 'compact transparent container with turquoise lid, base and central spindle, a white pull handle and visible metal blades',
  dominantColors: ['transparent', 'turquoise', 'white', 'silver'],
  observedPhysicalFacts: [
    'Compact transparent container',
    'Turquoise lid, base and central spindle',
    'White pull handle',
    'Visible metal blades',
    'Readable POTONGGO brand',
  ],
  coreFunction: 'manual kitchen chopper',
  confirmedFeatures: [
    'The pull handle is manually operated and the product is intended to chop ordinary kitchen ingredients.',
  ],
  unknownFields: ['chopping speed', 'blade material', 'capacity', 'durability'],
  prohibitedClaims: ['safety superiority', 'popularity', 'reviews', 'testimonial', 'personal ownership', 'personal-use result'],
  sourceConfidence: 'verified_user',
  provenance: 'source_grounded',
  isVisionSupported: false,
};

const scene: ScenePlan = {
  mainSubject: 'One covered adult female hand naturally handling the compact POTONGGO manual chopper',
  location: 'A freshly composed, believable Malaysian kitchen or food-preparation surface chosen from the grounded product category; never copy the reference composition',
  lighting: 'Bright neutral natural daylight',
  cameraDistance: 'Close hand-level smartphone framing with realistic compact-product scale',
  cameraMovement: 'Stable handheld 1x smartphone micro-movement',
  startPose: 'Product already grounded in a new live-action scene, not a still reference frame',
  actionProgression: 'One controlled playful goyang and a small natural grip adjustment without claiming performance',
  endPose: 'Stable product hold with silent physical ending after the CTA',
  primaryAction: 'Show the product identity and manual pull-handle mechanism with physically credible one-hand behaviour',
  audioPolicy: 'off_camera_narration',
  targetDurationSeconds: 15,
};

const style = getVideoStyle('NX09');
if (!style) throw new Error('NX09 style is missing.');
const compiled = DynamicPromptCompiler.compile(product, style, scene, {
  callToAction: 'custom',
  customCta: cta,
  imageRole: 'reference',
  isMuslimahModest: true,
  audioTreatment: 'voiceover',
  creativeInstruction: 'Use only the supplied product evidence. Do not claim chopping speed, blade material, capacity, durability, safety superiority, popularity, reviews, testimonial, personal ownership or personal-use result.',
});
if (!compiled.preflightValid) throw new Error(`Compiler preflight failed: ${compiled.validationErrors.join('; ')}`);

const directPath = resolve(outDir, 'test-a-direct-adapted-masterprompt.txt');
const compilerPath = resolve(outDir, 'test-b-v10.2-nx09-compiled-prompt.txt');
const diffPath = resolve(outDir, 'direct-adaptation-changelog.json');
writeFileSync(directPath, direct, 'utf8');
writeFileSync(compilerPath, compiled.providerPrompt, 'utf8');
writeFileSync(diffPath, JSON.stringify({ sourcePath, sourceSha256: sha256(source), adaptedSha256: sha256(direct), changes, appendedCompatibilityBlock: compatibilityBlock }, null, 2), 'utf8');

const shared = {
  mode: 'i2v',
  telegram_id: 'web',
  mediaCount: 2,
  mediaOrder: ['same-product-reference', 'same-product-reference'],
  referencePath: imagePath,
  referenceSha256: sha256(image),
  referenceBytes: image.byteLength,
  ratio: 2,
  resolution: 720,
  duration: 15,
  use_unlimited: false,
  cta,
  productFacts: {
    identity: 'POTONGGO Manual Chopper',
    category: 'manual kitchen chopper',
    observed: product.observedPhysicalFacts,
    confirmed: product.confirmedFeatures,
    unsupported: [...(product.unknownFields || []), ...product.prohibitedClaims],
  },
};
const manifest = {
  experiment: 'direct-masterprompt-vs-affimatik-compiler',
  paidSubmissionLimit: 2,
  maximumProviderDebit: 0.60,
  expectedDebitPerJobFromLatestReceipt: 0.30,
  latestReceiptEvidence: 'output/provider-qa/sales-demo-final-v10-2/receipt.json',
  source: { path: sourcePath, sha256: sha256(source), bytes: Buffer.byteLength(source), clipboardRawSha256: 'd4b82d3f21bf5f60eb26905dd97d8048c63c15521621266579ba5ed7f93737cd' },
  shared,
  arms: [
    { id: 'A', label: 'Direct Pawarna POV AFFILIATE GOYANG V6.1 adapted', promptPath: directPath, promptSha256: sha256(direct), promptLength: direct.length },
    { id: 'B', label: 'AffiMatik V10.2 NX09 compiler', promptPath: compilerPath, promptSha256: sha256(compiled.providerPrompt), promptLength: compiled.providerPrompt.length, promptVersion: compiled.promptVersion },
  ],
};
writeFileSync(resolve(outDir, 'experiment-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
writeFileSync(resolve(outDir, 'sanitized-request-comparison.json'), JSON.stringify({ shared, arms: manifest.arms.map(({ id, label, promptSha256, promptLength }) => ({ id, label, promptSha256, promptLength })) }, null, 2), 'utf8');

console.log(JSON.stringify(manifest, null, 2));
