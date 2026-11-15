import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const apiKey = process.env.NEXABOT_API_KEY;
if (!apiKey) throw new Error('NEXABOT_API_KEY is required in the local process environment.');

const root = resolve('output/expansion-v1-real-qa');
const fixturesDir = resolve(root, 'fixtures');
const promptsDir = resolve('output/expansion-v1-qa/prompts');
const videosDir = resolve(root, 'videos');
const manifestPath = resolve(root, 'manifest.json');
const statePath = resolve(root, 'provider-state.json');
const baseUrl = 'https://nexabot.id';
const expectedUnitCost = 0.3;
const maximumDebit = 1.8;
const submissionLimit = 6;
const terminalStates = new Set(['done', 'failed', 'cancelled', 'rejected']);
const activeStates = new Set(['queued', 'pending', 'processing', 'running', 'accepted']);
const pollIntervalMs = 6000;
const pollTimeoutMs = 30 * 60 * 1000;

const fixtures = [
  {
    styleId: 'NX21',
    styleName: 'Kurung Catwalk',
    image: 'NX21-baju-kurung.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:ACM-Baju_kurung-03611.jpg',
    sourceFile: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/ACM-Baju_kurung-03611.jpg',
    license: 'CC0 1.0',
    author: 'Asian Civilisations Museum / Wikimedia Commons',
  },
  {
    styleId: 'NX23',
    styleName: 'Tudung Styling',
    image: 'NX23-tudung.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Mannequin_head_with_black_headscarf.jpg',
    sourceFile: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Mannequin_head_with_black_headscarf.jpg',
    license: 'CC BY 2.0',
    author: 'Wikimedia Commons contributor (see source page)',
  },
  {
    styleId: 'NX25',
    styleName: 'Kids Outfit Showcase',
    image: 'NX25-kids-outfit.jpg',
    sourcePage: "https://commons.wikimedia.org/wiki/File:Child%27s_green_cotton_dress_-_DPLA_-_42888436319829f96aac80b9b42a8b72_(page_1).jpg",
    sourceFile: "https://upload.wikimedia.org/wikipedia/commons/e/e2/Child%27s_green_cotton_dress_-_DPLA_-_42888436319829f96aac80b9b42a8b72_(page_1).jpg",
    license: 'Public domain',
    author: 'DPLA collection / Wikimedia Commons',
  },
  {
    styleId: 'NX27',
    styleName: 'Kuali Cooking Demo',
    image: 'NX27-wok.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Wok_2.jpg',
    sourceFile: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/Wok_2.jpg',
    license: 'CC BY 2.0',
    author: 'Chris Feldmann',
  },
  {
    styleId: 'NX28',
    styleName: 'Air Fryer Demo',
    image: 'NX28-air-fryer.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Air_Fryer_2020.jpg',
    sourceFile: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Air_Fryer_2020.jpg',
    license: 'CC BY 2.0',
    author: 'I am R.',
  },
  {
    styleId: 'NX29',
    styleName: 'Kitchen Appliance Review',
    image: 'NX29-microwave.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Panasonic_MICROWAVE_OVEN_NN-GM333W.jpg',
    sourceFile: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Panasonic_MICROWAVE_OVEN_NN-GM333W.jpg',
    license: 'CC BY-SA 4.0',
    author: 'Dinkun Chen',
  },
];

if (fixtures.length !== submissionLimit) throw new Error('Hard guard: exactly six QA slots are required.');
if (existsSync(statePath)) throw new Error(`Hard guard: ${statePath} already exists; refusing all new submissions.`);

mkdirSync(videosDir, { recursive: true });
const headers = { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey };
const now = () => new Date().toISOString();
const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
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
  if (!response.ok || !Number.isFinite(value)) throw new Error(`Provider balance check failed: HTTP ${response.status}.`);
  return value;
}

const modesResult = await requestJson(`${baseUrl}/api/v1/modes`, { headers });
if (!modesResult.response.ok) throw new Error(`Provider modes check failed: HTTP ${modesResult.response.status}.`);
const videoModels = modesResult.data.video_models ?? modesResult.data.modes?.video_models ?? [];
const model = videoModels.find((candidate) => candidate.id === 'omni_flash');
const confirmedUnitCost = Number(model?.credit_cost ?? modesResult.data.video_credit_costs?.omni_flash ?? modesResult.data.video_credit_cost);
if (!model || model.duration !== 15 || !model.resolutions?.includes('720p') || !model.modes?.includes('i2v')) {
  throw new Error('Provider did not confirm omni_flash i2v, 15 seconds and 720p. No jobs submitted.');
}
if (!Number.isFinite(confirmedUnitCost) || confirmedUnitCost * submissionLimit > maximumDebit + 0.000001) {
  throw new Error(`Confirmed provider total ${confirmedUnitCost * submissionLimit} exceeds ${maximumDebit}. No jobs submitted.`);
}
if (Math.abs(confirmedUnitCost - expectedUnitCost) > 0.000001) {
  throw new Error(`Provider unit cost changed from ${expectedUnitCost} to ${confirmedUnitCost}. No jobs submitted.`);
}

const jobsResult = await requestJson(`${baseUrl}/api/v1/jobs`, { headers });
if (!jobsResult.response.ok) throw new Error(`Provider jobs preflight failed: HTTP ${jobsResult.response.status}.`);
const providerJobs = jobsResult.data.jobs ?? jobsResult.data.data ?? [];
const activeProviderJobs = Array.isArray(providerJobs)
  ? providerJobs.filter((job) => activeStates.has(String(job.status ?? '').toLowerCase()))
  : [];
if (activeProviderJobs.length > 0) throw new Error(`Provider has ${activeProviderJobs.length} active jobs. No QA jobs submitted.`);

const creditBefore = await providerBalance();
if (creditBefore < maximumDebit) throw new Error(`Supplier balance ${creditBefore} is below authorized maximum ${maximumDebit}.`);

const prepared = fixtures.map((fixture) => {
  const imagePath = resolve(fixturesDir, fixture.image);
  const promptPath = resolve(promptsDir, `${fixture.styleId}.txt`);
  if (!existsSync(imagePath)) throw new Error(`${fixture.styleId}: licensed fixture is missing.`);
  if (!existsSync(promptPath)) throw new Error(`${fixture.styleId}: staging compiler output is missing.`);
  const imageBytes = readFileSync(imagePath);
  const prompt = readFileSync(promptPath, 'utf8').trim();
  if (!prompt.includes(`[STYLE ${fixture.styleId} — AUTHORITATIVE CREATIVE DIRECTOR]`)) {
    throw new Error(`${fixture.styleId}: prompt is not the expected style-specific staging compiler output.`);
  }
  return {
    ...fixture,
    imagePath,
    promptPath,
    imageBytes,
    prompt,
    imageSha256: sha256(imageBytes),
    promptSha256: sha256(Buffer.from(prompt, 'utf8')),
  };
});

const manifest = {
  experiment: 'AFFIMATIK_EXPANSION_V1_REAL_NEXABOT_QA',
  sourceCommit: '287335f31b3cca129705cf0b6c6eff8f674cd80c',
  sourceBranch: 'codex/expansion-v1-nx21-nx30',
  stagingWorker: '0e5abca6-be41-4a9f-bfe4-5419174573f4',
  createdAt: now(),
  productionModified: false,
  customerWalletsUsed: false,
  provider: {
    baseUrl,
    model: 'omni_flash',
    label: model.label,
    mode: 'i2v',
    confirmedUnitCost,
    supplierBalanceBefore: creditBefore,
    activeJobsBefore: 0,
  },
  parameters: {
    durationSeconds: 15,
    resolution: 720,
    aspectRatio: '9:16',
    ratioCode: 2,
    mediaCount: 2,
    mediaRole: 'two identical product identity ingredient references',
    useUnlimited: false,
  },
  authorization: { submissionLimit, maximumDebit, automaticRetries: false },
  jobs: prepared.map((item) => ({
    styleId: item.styleId,
    styleName: item.styleName,
    imagePath: item.imagePath,
    imageBytes: item.imageBytes.length,
    imageSha256: item.imageSha256,
    imageSourcePage: item.sourcePage,
    imageSourceFile: item.sourceFile,
    imageLicense: item.license,
    imageAuthor: item.author,
    promptPath: item.promptPath,
    promptLength: item.prompt.length,
    promptSha256: item.promptSha256,
    compiledPrompt: item.prompt,
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
  if (state.submissionIntents >= submissionLimit) throw new Error('Hard guard: six submission intents already recorded.');
  const mime = item.image.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const imageData = `data:${mime};base64,${item.imageBytes.toString('base64')}`;
  const idempotencyKey = `affimatik-expansion-v1-${item.styleId.toLowerCase()}-${item.promptSha256.slice(0, 12)}-${item.imageSha256.slice(0, 12)}`;
  const payload = {
    model: 'omni_flash',
    mode: 'i2v',
    prompt: item.prompt,
    telegram_id: 'web',
    media: [imageData, imageData],
    ratio: 2,
    resolution: 720,
    duration: 15,
    use_unlimited: false,
  };
  const entry = {
    styleId: item.styleId,
    styleName: item.styleName,
    imagePath: item.imagePath,
    imageSha256: item.imageSha256,
    promptPath: item.promptPath,
    promptSha256: item.promptSha256,
    promptLength: item.prompt.length,
    mediaCount: 2,
    mediaOrder: [item.imageSha256, item.imageSha256],
    sanitizedPayload: { ...payload, media: [`data:${mime};base64,[REDACTED ${item.imageBytes.length} bytes]`, `data:${mime};base64,[REDACTED ${item.imageBytes.length} bytes]`] },
    idempotencyKey,
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
    throw new Error(`${item.styleId}: provider reported cost ${entry.reportedCreditCost}; stopped before any further submission.`);
  }
  if (!entry.taskId) {
    entry.status = response.ok ? 'ambiguous-no-task-id' : 'definitive-rejection';
    atomicJson(statePath, state);
    if (response.ok) throw new Error(`${item.styleId}: ambiguous accepted response without task ID; stopped without retry.`);
  }
}

const deadline = Date.now() + pollTimeoutMs;
while (Date.now() < deadline) {
  let terminalCount = 0;
  for (const item of prepared) {
    const entry = state.jobs[item.styleId];
    if (!entry.taskId || entry.status === 'downloaded' || terminalStates.has(entry.status)) {
      terminalCount += 1;
      continue;
    }
    try {
      const checkedAt = now();
      const { response, data } = await requestJson(`${baseUrl}/api/v1/jobs/${entry.taskId}`, { headers });
      const job = data.job ?? data;
      const status = String(job.status ?? 'unknown').toLowerCase();
      entry.pollHistory.push({
        checkedAt,
        httpStatus: response.status,
        status,
        progress: job.progress ?? null,
        error: job.error ?? job.error_message ?? null,
      });
      entry.status = status;
      entry.finalProviderRecord = job;
      if (status === 'done') {
        const videoUrl = job.storage_url || job.video_url || `${baseUrl}/api/v1/jobs/${entry.taskId}/download`;
        const downloadUrl = videoUrl.startsWith('http') ? videoUrl : `${baseUrl}${videoUrl}`;
        const download = await fetch(downloadUrl, { headers });
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
  await wait(pollIntervalMs);
}

state.supplierCreditAfter = await providerBalance();
state.actualSupplierDebit = Number((state.supplierCreditBefore - state.supplierCreditAfter).toFixed(4));
state.finishedAt = now();
state.downloadedCount = Object.values(state.jobs).filter((job) => job.status === 'downloaded').length;
state.terminalSummary = Object.fromEntries(Object.entries(state.jobs).map(([styleId, job]) => [styleId, {
  taskId: job.taskId ?? null,
  status: job.status,
  reportedCreditCost: job.reportedCreditCost,
  outputPath: job.outputPath ?? null,
} ]));
atomicJson(statePath, state);

if (state.submissionIntents > submissionLimit) throw new Error('Hard guard breached: more than six submission intents.');
if (state.actualSupplierDebit > maximumDebit + 0.000001) throw new Error(`Actual debit ${state.actualSupplierDebit} exceeds ${maximumDebit}.`);

console.log(JSON.stringify({
  submissionIntents: state.submissionIntents,
  downloadedCount: state.downloadedCount,
  actualSupplierDebit: state.actualSupplierDebit,
  tasks: state.terminalSummary,
}, null, 2));
