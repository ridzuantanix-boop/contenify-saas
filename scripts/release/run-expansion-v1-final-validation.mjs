import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const apiKey = process.env.NEXABOT_API_KEY;
if (!apiKey) throw new Error('NEXABOT_API_KEY is required.');

const baseUrl = 'https://nexabot.id';
const runId = process.env.VALIDATION_RUN_ID?.trim();
if (runId && !/^[a-z0-9-]+$/i.test(runId)) throw new Error('VALIDATION_RUN_ID contains unsupported characters.');
const root = resolve(runId
  ? `output/expansion-v1-final-validation-${runId}`
  : 'output/expansion-v1-final-validation');
const videosDir = resolve(root, 'videos');
const statePath = resolve(root, 'provider-state.json');
const manifestPath = resolve(root, 'manifest.json');
const expectedUnitCost = 0.3;
const maximumDebit = 0.6;
const submissionLimit = 2;
const activeStates = new Set(['queued', 'pending', 'processing', 'running', 'accepted']);
const terminalStates = new Set(['done', 'failed', 'cancelled', 'rejected']);
const headers = { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey };

const targetedPromptReplacements = {
  NX23: [
    [
      'Use a neutral bright dressing area or modest boutique wall without vanity props, bedroom assumptions or distracting mirrors.',
      'Use a plain neutral daylight dressing wall physically unrelated to the source retail display. Do not inherit warm boutique lighting, cream décor or the source-image background; keep the black garment neutral rather than tinting the scene amber.',
    ],
  ],
  NX27: [
    [
      'Lively practical Malaysian Malay voiceover, or synchronized kitchen ambience only when a sound-only option is deliberately selected.',
      'Lively practical Malaysian Malay voiceover, or synchronized kitchen ambience only when a sound-only option is deliberately selected. In spoken mode, complete one practical product point before moving into the CTA; do not stack a second claim that crowds the natural closing.',
    ],
    [
      'Cooking action stops in a safe stable position, the CTA finishes as the final speech and no new action begins after it.',
      'Cooking action stops in a safe stable position. Give the selected CTA enough unhurried conversational room to finish naturally as the final speech, then let ordinary kitchen room sound carry any remaining moment; no new action or product claim begins after it.',
    ],
  ],
};

const slots = [
  {
    styleId: 'NX23',
    styleName: 'Tudung Styling',
    baselineTaskId: 'f34ec45e76b1a0dd',
    previousAntiAiTaskId: '1797a7f60c911d08',
    expectedImageSha256: '1843370064abc23e09f23f1387b3a364e40e35f1c8e000c6c2c760f5c7324a10',
    imagePath: resolve('output/expansion-v1-real-qa/fixtures/NX23-tudung.jpg'),
    baselineVideoPath: resolve('output/expansion-v1-real-qa/videos/NX23-f34ec45e76b1a0dd.mp4'),
    previousAntiAiVideoPath: resolve('output/expansion-v1-anti-ai-ab/videos/NX23-1797a7f60c911d08.mp4'),
    beforePromptPath: resolve('output/expansion-v1-targeted-root-cause/before/NX23.txt'),
    afterPromptPath: resolve('output/expansion-v1-targeted-root-cause/after/NX23.txt'),
  },
  {
    styleId: 'NX27',
    styleName: 'Kuali Cooking',
    baselineTaskId: '4914f3b0b7306719',
    previousAntiAiTaskId: '168e821ae9cbd5e8',
    expectedImageSha256: '3a18b438691246dd8545edb0a65cad59bf7aae27ee642176fb06a515aa0be663',
    imagePath: resolve('output/expansion-v1-real-qa/fixtures/NX27-wok.jpg'),
    baselineVideoPath: resolve('output/expansion-v1-real-qa/videos/NX27-4914f3b0b7306719.mp4'),
    previousAntiAiVideoPath: resolve('output/expansion-v1-anti-ai-ab/videos/NX27-168e821ae9cbd5e8.mp4'),
    beforePromptPath: resolve('output/expansion-v1-targeted-root-cause/before/NX27.txt'),
    afterPromptPath: resolve('output/expansion-v1-targeted-root-cause/after/NX27.txt'),
  },
];

if (slots.length !== submissionLimit) throw new Error('Hard guard: exactly two slots are required.');
if (existsSync(statePath)) throw new Error(`Hard guard: ${statePath} already exists; refusing new submissions.`);

mkdirSync(videosDir, { recursive: true });
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
const normalize = (value) => value.replace(/\s+/g, ' ').trim();
const atomicJson = (path, value) => {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw: raw.slice(0, 2000) }; }
  return { response, data };
}

async function providerBalance() {
  const { response, data } = await requestJson(`${baseUrl}/api/v1/credits`, { headers });
  const value = Number(data.credit ?? data.balance);
  if (!response.ok || !Number.isFinite(value)) throw new Error(`Balance check failed: HTTP ${response.status}.`);
  return value;
}

const modesResult = await requestJson(`${baseUrl}/api/v1/modes`, { headers });
const model = (modesResult.data.video_models ?? []).find((candidate) => candidate.id === 'omni_flash');
const liveUnitCost = Number(model?.credit_cost ?? modesResult.data.video_credit_costs?.omni_flash);
if (!modesResult.response.ok || !model || model.duration !== 15 || !model.resolutions?.includes('720p') || !model.modes?.includes('i2v')) {
  throw new Error('Provider did not confirm Omni Flash 1.2 i2v, 15 seconds and 720p.');
}
if (!Number.isFinite(liveUnitCost) || liveUnitCost * submissionLimit > maximumDebit + 0.000001) {
  throw new Error(`Live total ${liveUnitCost * submissionLimit} exceeds authorized ${maximumDebit}.`);
}
if (Math.abs(liveUnitCost - expectedUnitCost) > 0.000001) throw new Error(`Unit cost changed to ${liveUnitCost}.`);

const jobsResult = await requestJson(`${baseUrl}/api/v1/jobs`, { headers });
const providerJobs = jobsResult.data.jobs ?? jobsResult.data.data ?? [];
const activeJobs = Array.isArray(providerJobs)
  ? providerJobs.filter((job) => activeStates.has(String(job.status ?? '').toLowerCase()))
  : [];
if (!jobsResult.response.ok || activeJobs.length > 0) throw new Error(`Provider preflight has ${activeJobs.length} active jobs.`);

const creditBefore = await providerBalance();
if (creditBefore < maximumDebit) throw new Error(`Balance ${creditBefore} is below ${maximumDebit}.`);

const prepared = slots.map((slot) => {
  for (const requiredPath of [slot.imagePath, slot.baselineVideoPath, slot.previousAntiAiVideoPath, slot.beforePromptPath, slot.afterPromptPath]) {
    if (!existsSync(requiredPath)) throw new Error(`${slot.styleId}: missing ${requiredPath}`);
  }
  const imageBytes = readFileSync(slot.imagePath);
  const imageSha256 = sha256(imageBytes);
  if (imageSha256 !== slot.expectedImageSha256) throw new Error(`${slot.styleId}: input image SHA mismatch.`);
  const beforePrompt = readFileSync(slot.beforePromptPath, 'utf8').trim();
  const afterPrompt = readFileSync(slot.afterPromptPath, 'utf8').trim();
  let reconstructedBefore = afterPrompt;
  for (const [oldText, newText] of targetedPromptReplacements[slot.styleId]) {
    if (!beforePrompt.includes(oldText) || !afterPrompt.includes(newText)) throw new Error(`${slot.styleId}: targeted replacement is missing.`);
    reconstructedBefore = reconstructedBefore.replace(newText, oldText);
  }
  if (normalize(reconstructedBefore) !== normalize(beforePrompt)) {
    throw new Error(`${slot.styleId}: prompt differs beyond the approved targeted corrections.`);
  }
  return {
    ...slot,
    imageBytes,
    imageSha256,
    beforePrompt,
    afterPrompt,
    beforePromptSha256: sha256(Buffer.from(beforePrompt, 'utf8')),
    afterPromptSha256: sha256(Buffer.from(afterPrompt, 'utf8')),
    baselineVideoSha256: sha256(readFileSync(slot.baselineVideoPath)),
    previousAntiAiVideoSha256: sha256(readFileSync(slot.previousAntiAiVideoPath)),
  };
});

const manifest = {
  experiment: 'AFFIMATIK_NX23_NX27_FINAL_REAL_VIDEO_VALIDATION',
  branch: 'codex/expansion-v1-nx21-nx30',
  stagingCommit: '9cea5cad8100fd6cb3e5187e92240460882cd71c',
  stagingWorker: '7a4504fb-ba7b-4453-b468-e9d4e846f27c',
  createdAt: now(),
  productionModified: false,
  customerWalletsUsed: false,
  automaticRetries: false,
  provider: { model: model.id, label: model.label, mode: 'i2v', liveUnitCost, creditBefore, activeJobsBefore: 0 },
  parameters: { duration: 15, resolution: 720, aspectRatio: '9:16', ratioCode: 2, mediaCount: 2, useUnlimited: false },
  authorization: { submissionLimit, maximumDebit },
  promptDifferenceGuard: 'Replacing only the exact approved NX23 scene clause and NX27 voice/ending clauses reconstructs the previous submitted Anti-AI prompt exactly.',
  jobs: prepared.map((item) => ({
    styleId: item.styleId,
    styleName: item.styleName,
    baselineTaskId: item.baselineTaskId,
    baselineVideoPath: item.baselineVideoPath,
    baselineVideoSha256: item.baselineVideoSha256,
    previousAntiAiTaskId: item.previousAntiAiTaskId,
    previousAntiAiVideoPath: item.previousAntiAiVideoPath,
    previousAntiAiVideoSha256: item.previousAntiAiVideoSha256,
    imagePath: item.imagePath,
    imageSha256: item.imageSha256,
    beforePromptPath: item.beforePromptPath,
    beforePromptSha256: item.beforePromptSha256,
    afterPromptPath: item.afterPromptPath,
    afterPromptSha256: item.afterPromptSha256,
    onlyApprovedTargetedCorrectionsChanged: true,
  })),
};
atomicJson(manifestPath, manifest);

const state = {
  experiment: manifest.experiment,
  startedAt: now(),
  submissionLimit,
  submissionIntents: 0,
  supplierCreditBefore: creditBefore,
  jobs: {},
};
atomicJson(statePath, state);

for (const item of prepared) {
  if (state.submissionIntents >= submissionLimit) throw new Error('Hard guard: two submission intents already recorded.');
  const mime = item.imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dataUri = `data:${mime};base64,${item.imageBytes.toString('base64')}`;
  const idempotencyKey = `affimatik-final-validation-${item.styleId.toLowerCase()}-${item.afterPromptSha256.slice(0, 12)}-${item.imageSha256.slice(0, 12)}`;
  const payload = {
    model: 'omni_flash', mode: 'i2v', prompt: item.afterPrompt, telegram_id: 'web',
    media: [dataUri, dataUri], ratio: 2, resolution: 720, duration: 15, use_unlimited: false,
  };
  const entry = {
    styleId: item.styleId,
    baselineTaskId: item.baselineTaskId,
    imageSha256: item.imageSha256,
    beforePromptSha256: item.beforePromptSha256,
    afterPromptSha256: item.afterPromptSha256,
    mediaCount: 2,
    mediaOrder: [item.imageSha256, item.imageSha256],
    idempotencyKey,
    sanitizedPayload: { ...payload, media: [`data:${mime};base64,[REDACTED ${item.imageBytes.length} bytes]`, `data:${mime};base64,[REDACTED ${item.imageBytes.length} bytes]`] },
    submissionIntentAt: now(),
    pollHistory: [],
  };
  state.jobs[item.styleId] = entry;
  state.submissionIntents += 1;
  atomicJson(statePath, state);

  const { response, data } = await requestJson(`${baseUrl}/api/v1/api`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  entry.submissionHttpStatus = response.status;
  entry.initialResponse = data;
  entry.taskId = String(data.job_id ?? data.task_id ?? data.id ?? '');
  entry.reportedCreditCost = Number.isFinite(Number(data.credit_cost)) ? Number(data.credit_cost) : null;
  entry.submittedAt = now();
  entry.status = String(data.status ?? (response.ok ? 'accepted' : 'rejected')).toLowerCase();
  atomicJson(statePath, state);

  if (entry.reportedCreditCost !== null && entry.reportedCreditCost > expectedUnitCost + 0.000001) {
    throw new Error(`${item.styleId}: reported price ${entry.reportedCreditCost}; stopped.`);
  }
  if (!entry.taskId) {
    entry.status = response.ok
      ? 'ambiguous-no-task-id'
      : response.status >= 500
        ? 'ambiguous-provider-5xx-no-task-id'
        : 'definitive-rejection';
    atomicJson(statePath, state);
    if (response.ok || response.status >= 500) {
      throw new Error(`${item.styleId}: ambiguous provider response without task ID; stopped without retry.`);
    }
  }
}

const deadline = Date.now() + 30 * 60 * 1000;
while (Date.now() < deadline) {
  let terminalCount = 0;
  for (const item of prepared) {
    const entry = state.jobs[item.styleId];
    if (!entry.taskId || entry.status === 'downloaded' || terminalStates.has(entry.status)) {
      terminalCount += 1;
      continue;
    }
    try {
      const { response, data } = await requestJson(`${baseUrl}/api/v1/jobs/${entry.taskId}`, { headers });
      const job = data.job ?? data;
      const status = String(job.status ?? 'unknown').toLowerCase();
      entry.pollHistory.push({ checkedAt: now(), httpStatus: response.status, status, progress: job.progress ?? null, error: job.error ?? null });
      entry.status = status;
      entry.finalProviderRecord = job;
      if (status === 'done') {
        const outputUrl = job.storage_url || job.video_url || `${baseUrl}/api/v1/jobs/${entry.taskId}/download`;
        const download = await fetch(outputUrl.startsWith('http') ? outputUrl : `${baseUrl}${outputUrl}`, { headers });
        if (!download.ok) throw new Error(`Download HTTP ${download.status}`);
        const video = Buffer.from(await download.arrayBuffer());
        if (video.length < 100000) throw new Error(`Unexpected MP4 size ${video.length}`);
        const outputPath = resolve(videosDir, `${item.styleId}-${entry.taskId}.mp4`);
        writeFileSync(outputPath, video);
        entry.outputPath = outputPath;
        entry.outputFile = basename(outputPath);
        entry.outputBytes = video.length;
        entry.outputSha256 = sha256(video);
        entry.downloadedAt = now();
        entry.status = 'downloaded';
        terminalCount += 1;
      } else if (terminalStates.has(status)) {
        terminalCount += 1;
      }
    } catch (error) {
      entry.pollHistory.push({ checkedAt: now(), transientError: String(error) });
    }
    atomicJson(statePath, state);
  }
  if (terminalCount === prepared.length) break;
  await wait(6000);
}

state.supplierCreditAfter = await providerBalance();
state.actualSupplierDebit = Number((state.supplierCreditBefore - state.supplierCreditAfter).toFixed(4));
state.finishedAt = now();
state.downloadedCount = Object.values(state.jobs).filter((job) => job.status === 'downloaded').length;
atomicJson(statePath, state);

if (state.submissionIntents !== submissionLimit) throw new Error(`Expected two submission intents, got ${state.submissionIntents}.`);
if (state.actualSupplierDebit > maximumDebit + 0.000001) throw new Error(`Debit ${state.actualSupplierDebit} exceeded ${maximumDebit}.`);

console.log(JSON.stringify({
  submissionIntents: state.submissionIntents,
  downloadedCount: state.downloadedCount,
  creditBefore: state.supplierCreditBefore,
  creditAfter: state.supplierCreditAfter,
  actualSupplierDebit: state.actualSupplierDebit,
  tasks: Object.fromEntries(Object.entries(state.jobs).map(([styleId, entry]) => [styleId, { taskId: entry.taskId, status: entry.status, cost: entry.reportedCreditCost, outputPath: entry.outputPath ?? null }])),
}, null, 2));
