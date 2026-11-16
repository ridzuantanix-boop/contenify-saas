import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DynamicPromptCompiler, GEMS_PROMPT_VERSION } from '../../src/lib/engine/compiler';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { getVideoStyle } from '../../src/lib/styles/registry';

const repo = resolve(import.meta.dirname, '..', '..');
const out = resolve(repo, 'output/affimatik-real-v3-video-validation');
const promptsDir = resolve(out, 'prompts');
const payloadsDir = resolve(out, 'payloads-private');
mkdirSync(promptsDir, { recursive: true });
mkdirSync(payloadsDir, { recursive: true });

const baselineManifest = JSON.parse(readFileSync(resolve(repo, 'output/affimatik-real-v2-release/manifest.json'), 'utf8'));
const baselineState = JSON.parse(readFileSync(resolve(repo, 'output/affimatik-real-v2-release/provider-state.json'), 'utf8'));
const selected = ['NX01', 'NX09', 'NX23', 'NX27'] as const;
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

const neutral: ProductProfile = {
  name: '', spokenShortName: '', category: '', brand: '', packagingFormat: 'general', shapeDescription: '', dominantColors: [],
  observedPhysicalFacts: [], coreFunction: '', confirmedFeatures: [],
  unknownFields: ['Any product-specific attribute not clearly visible in the supplied image remains unverified.'],
  prohibitedClaims: ['Unsupported efficacy, medical outcome, specification, price, popularity, testimonial, guarantee and personal-use claim.'],
  sourceConfidence: 'ai_interpreted', provenance: 'manual_user_entry', isVisionSupported: false,
};

const handLed = new Set(['NX09', 'NX27']);
const creativeInstruction = 'Use the two byte-identical references only as one product identity authority. Nexabot independently interprets the image and writes every product-specific spoken word. Preserve the selected style’s distinct scene, camera, performance and audio identity. Do not copy screenshot UI or source composition. Do not invent objectively false facts, regulated outcomes, personal experience, prices, reviews or performance guarantees. Keep compact handheld objects near the configured 12–18% scale target and larger garments or appliances at believable real-world dimensions.';

const rows = selected.map((styleId) => {
  const old = baselineManifest.jobs.find((job: { styleId: string }) => job.styleId === styleId);
  const oldState = baselineState.jobs[styleId];
  if (!old || !oldState) throw new Error(`${styleId}: REAL V2 baseline evidence is missing.`);
  if (!existsSync(old.imagePath)) throw new Error(`${styleId}: original reference is missing.`);
  for (const evidencePath of [oldState.outputPath, resolve(repo, `output/affimatik-real-v2-release/transcripts/${styleId}.json`), resolve(repo, `output/affimatik-real-v2-release/contact-sheets/${styleId}.jpg`)]) {
    if (!existsSync(evidencePath)) throw new Error(`${styleId}: baseline evidence is missing at ${evidencePath}.`);
  }
  const bytes = readFileSync(old.imagePath);
  if (sha(bytes) !== old.imageSha256) throw new Error(`${styleId}: original reference bytes changed.`);
  const style = getVideoStyle(styleId);
  if (!style) throw new Error(`${styleId}: style is missing.`);

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

  const compiled = DynamicPromptCompiler.compile(neutral, style, scene, {
    callToAction: 'custom', customCta: old.cta, imageRole: 'reference', isMuslimahModest: true, creativeInstruction,
  });
  if (!compiled.preflightValid) throw new Error(`${styleId}: ${compiled.validationErrors.join('; ')}`);
  for (const marker of ['[REAL V3 COMPACT GLOBAL CONTRACT]', `[STYLE ${styleId} — PREDEFINED CONFIGURATION]`, '[PRODUCT SCALE LOCK]', '[SHARIAH MODESTY LOCK', '[NEXABOT NATIVE DIALOGUE — NO AFFIMATIK SCRIPT]']) {
    if (!compiled.providerPrompt.includes(marker)) throw new Error(`${styleId}: missing ${marker}.`);
  }
  if (/ordinary buyer benefit|supported buyer benefit|supported FOMO|mandatory benefit/i.test(compiled.providerPrompt)) throw new Error(`${styleId}: inferred-benefit contradiction leaked.`);
  if (/PAWARNA MASTERPROMPT DIRECTOR V10|REAL V2 GLOBAL QUALITY FOUNDATION/i.test(compiled.providerPrompt)) throw new Error(`${styleId}: obsolete architecture leaked.`);
  const ctaOccurrences = compiled.providerPrompt.split(old.cta).length - 1;
  if (ctaOccurrences !== 1) throw new Error(`${styleId}: expected exactly one CTA occurrence, got ${ctaOccurrences}.`);

  const promptPath = resolve(promptsDir, `${styleId}.txt`);
  writeFileSync(promptPath, compiled.providerPrompt, 'utf8');
  const mime = old.imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const imageData = `data:${mime};base64,${bytes.toString('base64')}`;
  const promptSha256 = sha(compiled.providerPrompt);
  const idempotencyKey = `affimatik-real-v3-validation-${styleId.toLowerCase()}-${promptSha256.slice(0, 12)}-${old.imageSha256.slice(0, 12)}`;
  const payload = {
    model: 'omni_flash', mode: 'i2v', prompt: compiled.providerPrompt, telegram_id: 'web',
    media: [imageData, imageData], ratio: 2, resolution: 720, duration: 15, use_unlimited: false,
  };
  const payloadPath = resolve(payloadsDir, `${styleId}.json`);
  writeFileSync(payloadPath, JSON.stringify(payload));
  const oldPrompt = readFileSync(old.promptPath, 'utf8');

  return {
    styleId, styleName: style.name, status: 'PREPARED_NOT_SUBMITTED',
    baseline: {
      taskId: oldState.taskId, credit: oldState.reportedCreditCost, promptLength: oldPrompt.length, promptSha256: sha(oldPrompt),
      mp4Path: oldState.outputPath,
      transcriptPath: resolve(repo, `output/affimatik-real-v2-release/transcripts/${styleId}.json`),
      contactSheetPath: resolve(repo, `output/affimatik-real-v2-release/contact-sheets/${styleId}.jpg`),
    },
    reference: { label: old.productLabel, path: old.imagePath, sha256: old.imageSha256, bytes: bytes.length, mediaCount: 2, mediaOrder: [old.imageSha256, old.imageSha256] },
    provider: { model: 'omni_flash', mode: 'i2v', duration: 15, resolution: 720, ratio: 2, useUnlimited: false },
    cta: old.cta,
    realV3: { promptVersion: GEMS_PROMPT_VERSION, promptPath, promptLength: compiled.providerPrompt.length, promptSha256, idempotencyKey, exactPayloadPath: payloadPath, exactPayloadBytes: Buffer.byteLength(JSON.stringify(payload)) },
  };
});

const liveUnitCost = Number(process.env.NEXABOT_LIVE_UNIT_COST ?? 'NaN');
const supplierBalance = Number(process.env.NEXABOT_SUPPLIER_BALANCE ?? 'NaN');
const activeJobs = Number(process.env.NEXABOT_ACTIVE_JOBS ?? 'NaN');
const report = {
  campaign: 'AFFIMATIK_REAL_V3_CONTROLLED_VIDEO_VALIDATION',
  preparedAt: new Date().toISOString(),
  sourceCommit: process.env.REAL_V3_SOURCE_COMMIT || '7092d1daf3582f8a53b4bfcba5ff74fecd4f2626',
  authorizationState: 'AWAITING_OWNER_PAID_TEST_APPROVAL',
  submissionCount: 0,
  customerWalletImpact: 'NONE',
  productionImpact: 'NONE',
  liveProviderPreflight: {
    checked: Number.isFinite(liveUnitCost) && Number.isFinite(supplierBalance) && Number.isFinite(activeJobs),
    model: 'omni_flash', mode: 'i2v', duration: 15, resolution: '720p', ratio: '9:16',
    unitCost: liveUnitCost, proposedTotal: Number.isFinite(liveUnitCost) ? Number((liveUnitCost * rows.length).toFixed(2)) : null,
    supplierBalance, activeJobs,
    withinProposedBudget: Number.isFinite(liveUnitCost) && liveUnitCost * rows.length <= 1.2,
  },
  fairness: {
    sameOriginalReferenceBytes: true,
    sameReferenceCountAndOrder: true,
    sameModelDurationResolutionRatio: true,
    sameCta: true,
    intendedDifference: 'REAL V3 compiled provider prompt; obsolete REAL V2 label removed from otherwise equivalent harness directive.',
  },
  hardGuards: { maximumSubmissions: 4, onePerStyle: true, automaticRetries: false, ambiguous5xxRequiresReconciliation: true },
  jobs: rows,
};
writeFileSync(resolve(out, 'preflight-manifest.json'), JSON.stringify(report, null, 2));
writeFileSync(resolve(out, 'submission-ledger.json'), JSON.stringify({ campaign: report.campaign, authorizationState: report.authorizationState, submissionIntents: 0, jobs: Object.fromEntries(rows.map((row) => [row.styleId, { status: row.status, idempotencyKey: row.realV3.idempotencyKey, taskId: null }])) }, null, 2));
writeFileSync(resolve(out, 'PREFLIGHT-REPORT.md'), `# AffiMatik REAL V3 controlled video validation — preflight

- Authorization: **AWAITING OWNER PAID TEST APPROVAL**
- Paid submissions made: **0**
- Current provider model: **omni_flash · i2v · 15s · 720p · 9:16**
- Current unit cost: **${liveUnitCost.toFixed(2)} credit**
- Proposed maximum: **${(liveUnitCost * rows.length).toFixed(2)} credits**
- Supplier balance observed: **${supplierBalance.toFixed(2)} credits**
- Active provider jobs observed: **${activeJobs}**
- Customer wallet impact: **NONE**
- Production impact: **NONE**

| Style | REAL V2 task | Image SHA-256 | REAL V2 chars | REAL V3 chars | REAL V3 prompt SHA-256 | CTA |
|---|---|---|---:|---:|---|---|
${rows.map((row) => `| ${row.styleId} | \`${row.baseline.taskId}\` | \`${row.reference.sha256}\` | ${row.baseline.promptLength} | ${row.realV3.promptLength} | \`${row.realV3.promptSha256}\` | ${row.cta} |`).join('\n')}

Every exact payload contains two byte-identical copies of the original REAL V2 reference. Full base64 payload bodies are intentionally kept in the local ignored \`payloads-private/\` directory; the committed manifest records their exact paths, hashes, settings and idempotency keys.
`);

console.log(JSON.stringify({
  styles: rows.length,
  uniquePromptHashes: new Set(rows.map((row) => row.realV3.promptSha256)).size,
  averageV2PromptLength: Math.round(rows.reduce((sum, row) => sum + row.baseline.promptLength, 0) / rows.length),
  averageV3PromptLength: Math.round(rows.reduce((sum, row) => sum + row.realV3.promptLength, 0) / rows.length),
  liveProviderPreflight: report.liveProviderPreflight,
  submissionCount: report.submissionCount,
}, null, 2));
