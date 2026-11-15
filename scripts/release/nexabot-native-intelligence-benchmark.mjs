import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiKey = process.env.NEXABOT_API_KEY;
if (!apiKey) throw new Error('NEXABOT_API_KEY is required in the local process environment.');

const base = 'https://nexabot.id';
const imagePath = resolve(process.env.BENCHMARK_IMAGE || '');
if (!imagePath || !existsSync(imagePath)) throw new Error('The exact owner-supplied BENCHMARK_IMAGE is missing.');

const outDir = resolve(process.env.BENCHMARK_OUTPUT || 'output/provider-qa/nexabot-native-intelligence-v1');
const statePath = resolve(outDir, 'provider-state.json');
const manifestPath = resolve(outDir, 'manifest.json');
const maximumDebit = 0.9;
const expectedCostPerJob = 0.3;
const requiredSubmissions = 3;
const pollMs = 5000;
const timeoutMs = 20 * 60 * 1000;
mkdirSync(outDir, { recursive: true });

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const atomicJson = (path, value) => {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2));
  renameSync(temporary, path);
};
const now = () => new Date().toISOString();
const wait = (ms) => new Promise((accept) => setTimeout(accept, ms));
const imageBytes = readFileSync(imagePath);
const imageHash = sha256(imageBytes);
const mime = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
const imageData = `data:${mime};base64,${imageBytes.toString('base64')}`;
const headers = { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey };

const common = `
[NATIVE PRODUCT REASONING]
Inspect the supplied image carefully. Independently recognize the product, its intended category, and any clearly readable information. Use only supported image evidence, reasonable category understanding, and genuinely available provider-side research capabilities. Do not invent externally verified facts. Do not ask for or assume hidden product metadata.

[NATIVE CREATIVE DIRECTION]
Think independently about the most relevant Malaysian affiliate audience and buyer situation. Develop a distinct concept appropriate to the assigned style. Compose every spoken word yourself. Do not use prewritten dialogue or generic product-description templates.

[TRUTHFULNESS]
Do not invent medical outcomes, treatment claims, prices, popularity, certifications, personal testimonials, ingredients, or performance guarantees. Do not treat a plausible category benefit as independently verified performance. Do not claim to have personally used the product.

[MALAYSIAN VOICE]
Use natural conversational Bahasa Melayu Malaysia with human pacing, emotional emphasis, and believable sentence linking. No corporate narration, artificial promotional voice, or Indonesian wording.

[VISUAL IDENTITY]
Preserve the physical product's recognizable identity, label, packaging, colour, shape, and plausible real-world scale. Do not create fake variants or invented packaging. The supplied image is a product identity reference, not a mandatory opening frame, scene composition, background plate, crop, or storyboard. Create a new live-action scene. Do not reproduce marketplace interfaces, app borders, UI elements, artificial shopping graphics, captions, or fake buttons.

[ENDING]
Use the assigned CTA once as the final spoken message. Finish it naturally and completely. Generate no additional words, outro, repetition, verbal filler, or speech-like sound after the CTA. A brief natural silent physical ending is allowed. Use no fixed universal word count and do not force unnatural silence for a large portion of the video.
`.trim();

const tests = [
  {
    id: 'A', style: 'NX01 — Sembang Kawan Santai', cta: 'tekan beg kuning',
    prompt: `${common}\n\n[STYLE — NX01: SEMBANG KAWAN SANTAI]\nCreate a 15-second vertical presenter-led conversational Malaysian affiliate UGC video. One adult Malaysian creator in appropriate modest clothing talks casually as if speaking to a friend. Use a realistic smartphone 1x shot, natural eye contact, subtle spontaneous gestures, authentic facial expressions, and credible product handling at real-world scale. Let the provider choose an ordinary bright Malaysian environment relevant to what it independently understands from the image. Independently identify the product and decide the product-relevant hook, buyer situation, and original dialogue. Do not receive or assume a supplied product category or selling angle.\n\nThe final spoken CTA must naturally include exactly this phrase: \"tekan beg kuning\".`,
  },
  {
    id: 'B', style: 'NX17 — Recommend Secara Spontan', cta: 'tekan butang di bawah',
    prompt: `${common}\n\n[STYLE — NX17: RECOMMEND SECARA SPONTAN]\nCreate a 15-second vertical energetic, spontaneous Malaysian affiliate recommendation. One adult Malaysian creator appears to have noticed something potentially relevant to viewers. Use distinctly more spontaneous emotional energy and cadence than a relaxed friend chat, a different opening strategy, one naturally motivated reaction, relevant product interaction, realistic smartphone framing, and plausible physical scale. Do not overact and do not fabricate personal-use claims. Independently create the selling idea and every line using only the supplied image and genuinely available native provider capabilities.\n\nThe final spoken CTA must naturally include exactly this phrase: \"tekan butang di bawah\".`,
  },
  {
    id: 'C', style: 'NX09 — Goyang Produk + Voiceover', cta: 'semak dekat bio',
    prompt: `${common}\n\n[STYLE — NX09: GOYANG PRODUK + VOICEOVER]\nCreate a 15-second vertical faceless first-person POV product-handling video with an energetic off-camera Malaysian affiliate voiceover. Show one naturally proportioned hand with the wrist fully covered; show no presenter face. Use a realistic smartphone 1x view, natural grip, small incidental product movement, believable weight, valid anatomy, and an appropriate new environment selected from the provider's independent image understanding. Do not mechanically shake the product, do not narrate hand movement, and do not blindly reproduce the source frame as the opening scene. Independently choose relevant talking points and compose the voiceover.\n\nThe final spoken CTA must naturally include exactly this phrase: \"semak dekat bio\".`,
  },
];

if (tests.length !== requiredSubmissions) throw new Error('Hard guard: benchmark must contain exactly three tests.');
for (const test of tests) {
  test.prompt = test.prompt.trim();
  test.promptSha256 = sha256(Buffer.from(test.prompt, 'utf8'));
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  return { response, data };
}

async function balance() {
  const candidates = ['/api/v1/credits', '/api/v1/api/credit'];
  for (const endpoint of candidates) {
    const { response, data } = await jsonFetch(`${base}${endpoint}`, { headers });
    const value = Number(data.credit ?? data.credits ?? data.balance);
    if (response.ok && Number.isFinite(value)) return { value, endpoint, sanitizedResponse: { ok: data.ok, credit: value } };
  }
  throw new Error('Unable to obtain the live provider balance.');
}

if (existsSync(statePath)) throw new Error(`Hard guard: state already exists at ${statePath}; refusing any new submission.`);

const opening = await balance();
if (opening.value < maximumDebit) throw new Error(`Supplier balance ${opening.value} is below the authorized maximum debit ${maximumDebit}.`);

let modesEvidence = null;
try {
  const { response, data } = await jsonFetch(`${base}/api/v1/modes`, { headers });
  modesEvidence = { httpStatus: response.status, body: data };
} catch (error) {
  modesEvidence = { error: String(error) };
}

const manifest = {
  benchmark: 'AFFIMATIK_NEXABOT_NATIVE_INTELLIGENCE_V1', createdAt: now(),
  image: { path: imagePath, bytes: imageBytes.length, sha256: imageHash, transformations: 'NONE' },
  provider: { baseUrl: base, model: 'omni_flash', documentedLabel: 'Omni Flash 1.2', mode: 'i2v' },
  parameters: { duration: 15, resolution: 720, ratio: 2, mediaCount: 1, mediaOrder: [imageHash], useUnlimited: false },
  paidSubmissionLimit: requiredSubmissions, expectedCostPerJob, maximumDebit,
  tests: tests.map(({ id, style, cta, prompt, promptSha256 }) => ({ id, style, cta, prompt, promptLength: prompt.length, promptSha256 })),
  modesEvidence,
};
atomicJson(manifestPath, manifest);

const state = {
  benchmark: manifest.benchmark, startedAt: now(), submissionIntents: 0,
  supplierCreditBefore: opening.value, creditEndpoint: opening.endpoint,
  jobs: {},
};
atomicJson(statePath, state);

for (const test of tests) {
  if (state.submissionIntents >= requiredSubmissions) throw new Error('Hard guard: three submission intents already recorded.');
  const idempotencyKey = `affimatik-native-v1-${test.id.toLowerCase()}-${test.promptSha256.slice(0, 12)}-${imageHash.slice(0, 12)}`;
  const entry = {
    test: test.id, style: test.style, cta: test.cta,
    promptPath: `manifest.json#tests.${test.id}`, promptSha256: test.promptSha256, promptLength: test.prompt.length,
    imageSha256: imageHash, submissionIntentAt: now(), idempotencyKey,
    status: 'SUBMISSION_INTENT_RECORDED', pollHistory: [],
    sanitizedPayload: {
      model: 'omni_flash', mode: 'i2v', prompt: test.prompt, telegram_id: 'web',
      media: [{ redactedDataUri: true, sha256: imageHash, bytes: imageBytes.length, order: 1 }],
      ratio: 2, resolution: 720, duration: 15, use_unlimited: false,
    },
  };
  state.jobs[test.id] = entry;
  state.submissionIntents += 1;
  atomicJson(statePath, state);

  const payload = {
    model: 'omni_flash', mode: 'i2v', prompt: test.prompt, telegram_id: 'web', media: [imageData],
    ratio: 2, resolution: 720, duration: 15, use_unlimited: false,
  };
  const submittedAt = now();
  try {
    const { response, data } = await jsonFetch(`${base}/api/v1/api`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    });
    entry.submissionHttpStatus = response.status;
    entry.submittedAt = submittedAt;
    entry.sanitizedInitialResponse = data;
    const taskId = String(data.job_id ?? data.id ?? data.task_id ?? '');
    if (!response.ok || !taskId) {
      entry.status = 'REJECTED_OR_AMBIGUOUS';
      entry.error = data.error ?? `HTTP ${response.status} without task ID`;
      atomicJson(statePath, state);
      throw new Error(`Test ${test.id} did not return a safe task ID; no retry is permitted.`);
    }
    entry.taskId = taskId;
    entry.status = String(data.status ?? 'queued');
    entry.reportedCreditCost = Number.isFinite(Number(data.credit_cost)) ? Number(data.credit_cost) : null;
    atomicJson(statePath, state);
  } catch (error) {
    entry.error = String(error);
    atomicJson(statePath, state);
    throw error;
  }
}

const deadline = Date.now() + timeoutMs;
while (Date.now() < deadline) {
  let allTerminal = true;
  for (const test of tests) {
    const entry = state.jobs[test.id];
    if (!entry.taskId || ['done', 'failed', 'downloaded'].includes(entry.status)) continue;
    allTerminal = false;
    try {
      const checkedAt = now();
      const { response, data } = await jsonFetch(`${base}/api/v1/jobs/${entry.taskId}`, { headers });
      const job = data.job ?? data;
      const status = String(job.status ?? data.status ?? 'unknown').toLowerCase();
      entry.pollHistory.push({ checkedAt, httpStatus: response.status, status, progress: job.progress ?? null, error: job.error ?? data.error ?? null });
      entry.status = status;
      entry.sanitizedFinalProviderRecord = job;
      if (status === 'done') {
        const videoUrl = job.storage_url || job.video_url || `${base}/api/v1/jobs/${entry.taskId}/download`;
        const videoResponse = await fetch(videoUrl.startsWith('http') ? videoUrl : `${base}${videoUrl}`, { headers });
        if (!videoResponse.ok) throw new Error(`Download HTTP ${videoResponse.status}`);
        const video = Buffer.from(await videoResponse.arrayBuffer());
        if (video.length < 100000) throw new Error(`Downloaded result is unexpectedly small (${video.length} bytes).`);
        const outputPath = resolve(outDir, `test-${test.id.toLowerCase()}-${entry.taskId}.mp4`);
        writeFileSync(outputPath, video);
        entry.outputPath = outputPath;
        entry.outputBytes = video.length;
        entry.outputSha256 = sha256(video);
        entry.downloadedAt = now();
        entry.status = 'downloaded';
      }
    } catch (error) {
      entry.pollHistory.push({ checkedAt: now(), transientPollOrDownloadError: String(error) });
    }
    atomicJson(statePath, state);
  }
  if (allTerminal) break;
  await wait(pollMs);
}

for (const test of tests) {
  const entry = state.jobs[test.id];
  if (!['downloaded', 'failed'].includes(entry.status)) entry.pollingStoppedAt = now();
}
const closing = await balance();
state.supplierCreditAfter = closing.value;
state.supplierCreditsUsed = Number((state.supplierCreditBefore - closing.value).toFixed(4));
state.finishedAt = now();
atomicJson(statePath, state);
if (state.submissionIntents !== requiredSubmissions) throw new Error('Benchmark did not record exactly three submission intents.');
if (state.supplierCreditsUsed > maximumDebit + 0.0001) throw new Error(`Actual debit ${state.supplierCreditsUsed} exceeded ${maximumDebit}.`);
console.log(JSON.stringify({ outDir, imageSha256: imageHash, submissionIntents: state.submissionIntents, supplierCreditBefore: state.supplierCreditBefore, supplierCreditAfter: state.supplierCreditAfter, supplierCreditsUsed: state.supplierCreditsUsed, jobs: Object.fromEntries(Object.entries(state.jobs).map(([key, value]) => [key, { taskId: value.taskId, status: value.status, outputPath: value.outputPath }])) }, null, 2));
