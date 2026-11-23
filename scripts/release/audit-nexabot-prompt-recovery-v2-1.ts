import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DynamicPromptCompiler } from '../../src/lib/engine/compiler';
import { compileCompactNexabotPrompt, nexabotPromptCounts, type CompactPromptCandidate } from '../../src/lib/engine/compact-nexabot';
import { STYLE_DIRECTORS } from '../../src/lib/engine/style-directors';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { VIDEO_STYLES_REGISTRY, getVideoStyle } from '../../src/lib/styles/registry';
import { NexabotAdapter } from '../../src/lib/providers/nexabot';

const repo = resolve('.');
const out = resolve(repo, process.env.AFFIMATIK_PROMPT_AUDIT_DIR || 'output/nexabot-prompt-recovery-v2-1');
const source = resolve(repo, 'output/avatar-sales-demos-2026-11-23/manifest.json');
const attachment = 'C:/Users/user/.codex/codex-remote-attachments/01a1a93c-06c3-7a63-9909-599706e05606/33D87D3B-C23C-4F3C-989C-DEE29CF858DF';
mkdirSync(out, { recursive: true });
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const scene: ScenePlan = { mainSubject: 'product', location: 'provider choice', lighting: 'daylight', cameraDistance: '1x', cameraMovement: 'natural', startPose: 'natural', actionProgression: 'style action', endPose: 'natural', primaryAction: 'style action', audioPolicy: 'spoken_bm', targetDurationSeconds: 15 };
const product = (name = 'uploaded image'): ProductProfile => ({ name, category: 'image provided', packagingFormat: 'general', confirmedFeatures: [], prohibitedClaims: [], sourceConfidence: 'verified_user' });
const adapter = new NexabotAdapter({ apiKey: 'offline-preflight' });

const allStyles = VIDEO_STYLES_REGISTRY.map(style => {
  const options = { avatarName: 'Customer avatar', backgroundName: 'Customer background', voicePersonality: 'energetic', callToAction: 'tiktok_shop' as const };
  const results = (['A', 'B'] as CompactPromptCandidate[]).map(candidate => {
    const core = compileCompactNexabotPrompt(product(), STYLE_DIRECTORS[style.id], options, true, ['hand_demo', 'product_handling', 'pov'].includes(style.category) || style.id.startsWith('RH'), candidate);
    const compiled = candidate === 'A' ? DynamicPromptCompiler.compile(product(), style, scene, options) : null;
    if (compiled && compiled.providerPrompt !== core.prompt) throw new Error(`${style.id}: active compiler differs from candidate A`);
    return { candidate, hash: sha(core.prompt), budget: core.budget, errors: core.errors, containsMandatory: {
      selling: core.prompt.includes('buyer need, supported benefit and angle'), identity: core.prompt.includes('Keep product/label/colour'), scale: core.prompt.includes('8-12%'), modesty: core.prompt.includes('wrists'), cta: core.prompt.includes('Beg Kuning'), nativeCreative: core.prompt.includes('Nexabot writes'),
    } };
  });
  return { styleId: style.id, name: style.name, results };
});

const prior = JSON.parse(readFileSync(source, 'utf8')) as { jobs: Array<{slot: string; styleId: string; avatar: string; product: string; productName: string; cta: string; modest: boolean; promptLength: number; promptSha256: string}> };
const four = prior.jobs.map(job => {
  const style = getVideoStyle(job.styleId)!;
  const productBytes = readFileSync(resolve(attachment, job.product));
  const avatarBytes = readFileSync(resolve(attachment, job.avatar));
  const uri = (bytes: Buffer) => `data:image/jpeg;base64,${bytes.toString('base64')}`;
  const results = (['A', 'B'] as CompactPromptCandidate[]).map(candidate => {
    // The old campaign's "Customer direction" was written by our test harness,
    // and repeated the compiler's identity, truthfulness and CTA instructions.
    const options = { avatarName: `Owner avatar ${job.slot}`, callToAction: 'custom' as const, customCta: job.cta };
    const core = compileCompactNexabotPrompt(product(job.productName), STYLE_DIRECTORS[job.styleId], options, job.modest, false, candidate);
    const payload = adapter.preparePayload({ prompt: core.prompt, durationSeconds: 15, aspectRatio: '9:16', mainImageKeyOrUrl: uri(productBytes), referenceImageKeysOrUrls: [uri(avatarBytes)] } as Parameters<NexabotAdapter['preparePayload']>[0]);
    const valid = adapter.validateInput({ prompt: core.prompt, durationSeconds: 15 } as Parameters<NexabotAdapter['validateInput']>[0]);
    const promptPath = resolve(out, `${job.slot}-${candidate}-prompt.txt`);
    writeFileSync(promptPath, core.prompt);
    return { candidate, promptPath, prompt: core.prompt, hash: sha(core.prompt), budget: core.budget, errors: core.errors, transportValid: valid.isValid, payload: { model: payload.model, mode: payload.mode, ratio: payload.ratio, resolution: payload.resolution, duration: payload.duration, media: [sha(productBytes), sha(productBytes), sha(avatarBytes)], prompt: core.prompt }, serializedPayloadBytes: Buffer.byteLength(JSON.stringify(payload)) };
  });
  return { slot: job.slot, styleId: job.styleId, previousPromptLength: job.promptLength, previousPromptSha256: job.promptSha256, results };
});

const failed = [...allStyles.flatMap(row => row.results), ...four.flatMap(row => row.results)].filter(row => row.errors.length || row.budget.utf8Bytes > 1000 || ('containsMandatory' in row && Object.values(row.containsMandatory).some(value => !value)));
const report = { generatedAt: new Date().toISOString(), countRule: 'max(UTF-16 code units, Unicode code points, UTF-8 bytes) <= 1000 for the parsed JSON prompt field', styleCount: allStyles.length, failedCount: failed.length, allStyles, four };
writeFileSync(resolve(out, 'audit.json'), JSON.stringify(report, null, 2));
writeFileSync(resolve(out, 'style-budget.tsv'), ['style\tcandidate\tutf16\tutf8_bytes\tglobal\tstyle_text\tcta\tcontext\tniqab\tseparators\tsha256', ...allStyles.flatMap(row => row.results.map(result => [row.styleId, result.candidate, result.budget.utf16, result.budget.utf8Bytes, result.budget.global, result.budget.style, result.budget.cta, result.budget.context, result.budget.niqab, result.budget.separators, result.hash].join('\t')))].join('\n'));
console.log(JSON.stringify({ styleCount: allStyles.length, failedCount: failed.length, maxA: Math.max(...allStyles.map(row => row.results[0].budget.utf8Bytes)), maxB: Math.max(...allStyles.map(row => row.results[1].budget.utf8Bytes)), four: four.map(row => ({ slot: row.slot, previous: row.previousPromptLength, A: row.results[0].budget.utf8Bytes, B: row.results[1].budget.utf8Bytes, refs: row.results[0].payload.media })) }, null, 2));
if (failed.length) process.exitCode = 1;
