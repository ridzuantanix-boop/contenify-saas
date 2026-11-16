import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiKey = process.env.NEXABOT_API_KEY;
if (!apiKey) throw new Error('NEXABOT_API_KEY is required.');

const root = resolve('output/affimatik-real-v3-video-validation');
const manifest = JSON.parse(readFileSync(resolve(root, 'preflight-manifest.json'), 'utf8'));
const ledgerPath = resolve(root, 'submission-ledger.json');
const videosDir = resolve(root, 'videos');
mkdirSync(videosDir, { recursive: true });

const baseUrl = 'https://nexabot.id';
const headers = { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey };
const approvedStyles = ['NX01', 'NX09', 'NX23', 'NX27'];
const activeStates = new Set(['queued', 'pending', 'processing', 'running', 'accepted']);
const finalStates = new Set(['downloaded', 'failed', 'cancelled', 'rejected']);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

if (manifest.authorizationState !== 'AWAITING_OWNER_PAID_TEST_APPROVAL' || manifest.jobs.length !== 4) throw new Error('Prepared manifest does not match the approved four-job campaign.');
if (manifest.jobs.map((job) => job.styleId).join(',') !== approvedStyles.join(',')) throw new Error('Approved style order mismatch.');

const atomic = (path, value) => {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { renameSync(temporary, path); return; }
    catch (error) {
      if (!['EPERM', 'EACCES'].includes(error?.code) || attempt === 19) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
};

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw: raw.slice(0, 2000) }; }
  return { response, data };
}

async function balance() {
  const { response, data } = await request(`${baseUrl}/api/v1/credits`, { headers });
  const value = Number(data.credit ?? data.balance);
  if (!response.ok || !Number.isFinite(value)) throw new Error(`Provider balance unavailable: HTTP ${response.status}.`);
  return value;
}

function getTaskId(data) {
  return String(data?.job_id ?? data?.task_id ?? data?.id ?? data?.job?.id ?? '');
}

async function reconcileAmbiguous(idempotencyKey) {
  const { response, data } = await request(`${baseUrl}/api/v1/jobs`, { headers });
  if (!response.ok) return null;
  const jobs = data.jobs ?? data.data ?? [];
  if (!Array.isArray(jobs)) return null;
  const found = jobs.find((job) => job.idempotency_key === idempotencyKey || job.idempotencyKey === idempotencyKey || job.client_request_id === idempotencyKey);
  return found ? String(found.id ?? found.job_id ?? found.task_id ?? '') : null;
}

async function pollAndDownload(entry) {
  const deadline = Date.now() + 35 * 60 * 1000;
  entry.pollHistory ||= [];
  while (Date.now() < deadline) {
    let result;
    try { result = await request(`${baseUrl}/api/v1/jobs/${entry.taskId}`, { headers }); }
    catch (error) {
      entry.pollHistory.push({ at: now(), transportError: error instanceof Error ? error.message : String(error) });
      atomic(ledgerPath, ledger);
      await wait(7000);
      continue;
    }
    const job = result.data.job ?? result.data;
    const status = String(job.status ?? 'unknown').toLowerCase();
    entry.pollHistory.push({ at: now(), httpStatus: result.response.status, status, progress: job.progress ?? null, error: job.error ?? null });
    entry.status = status;
    entry.finalProviderRecord = job;
    atomic(ledgerPath, ledger);
    if (status === 'done') {
      const source = job.storage_url || job.video_url || `${baseUrl}/api/v1/jobs/${entry.taskId}/download`;
      const download = await fetch(source.startsWith('http') ? source : `${baseUrl}${source}`, { headers });
      if (!download.ok) throw new Error(`${entry.styleId}: download HTTP ${download.status}.`);
      const video = Buffer.from(await download.arrayBuffer());
      if (video.length < 100000 || !video.subarray(4, 12).toString('ascii').includes('ftyp')) throw new Error(`${entry.styleId}: downloaded output is not a valid-sized MP4.`);
      entry.outputPath = resolve(videosDir, `${entry.styleId}-${entry.taskId}.mp4`);
      writeFileSync(entry.outputPath, video);
      entry.outputBytes = video.length;
      entry.outputSha256 = sha(video);
      entry.downloadedAt = now();
      entry.status = 'downloaded';
      atomic(ledgerPath, ledger);
      return;
    }
    if (['failed', 'cancelled', 'rejected'].includes(status)) return;
    await wait(7000);
  }
  entry.status = 'poll-timeout-original-task-preserved';
  atomic(ledgerPath, ledger);
  throw new Error(`${entry.styleId}: polling timed out; original task ${entry.taskId} preserved and no retry made.`);
}

const modes = await request(`${baseUrl}/api/v1/modes`, { headers });
if (!modes.response.ok) throw new Error(`Provider mode preflight failed: HTTP ${modes.response.status}.`);
const videoModels = modes.data.video_models ?? modes.data.modes?.video_models ?? [];
const model = videoModels.find((candidate) => candidate.id === 'omni_flash');
const unitCost = Number(model?.credit_cost ?? modes.data.video_credit_costs?.omni_flash ?? modes.data.video_credit_cost);
if (!model || model.duration !== 15 || !model.resolutions?.includes('720p') || !model.modes?.includes('i2v')) throw new Error('Provider no longer confirms omni_flash i2v / 15 seconds / 720p. No submission made.');
if (!Number.isFinite(unitCost) || unitCost * 4 > 1.200001) throw new Error(`Current provider cost ${unitCost} exceeds the approved 1.20-credit budget. No submission made.`);

let ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
ledger.approval = { approved: true, maximumSubmissions: 4, maximumSupplierCredits: 1.2, automaticRetries: false };
ledger.confirmedUnitCost = unitCost;
ledger.runStartedAt ||= now();
ledger.submissionIntents ||= 0;

if (!ledger.supplierCreditBefore) {
  const jobsResult = await request(`${baseUrl}/api/v1/jobs`, { headers });
  if (!jobsResult.response.ok) throw new Error(`Provider active-job check failed: HTTP ${jobsResult.response.status}.`);
  const providerJobs = jobsResult.data.jobs ?? jobsResult.data.data ?? [];
  const activeBefore = Array.isArray(providerJobs) ? providerJobs.filter((job) => activeStates.has(String(job.status ?? '').toLowerCase())) : [];
  if (activeBefore.length) throw new Error(`Provider has ${activeBefore.length} active job(s). Stopped before any new submission.`);
  ledger.activeJobsBefore = 0;
  ledger.supplierCreditBefore = await balance();
  if (ledger.supplierCreditBefore < unitCost * 4) throw new Error(`Supplier balance ${ledger.supplierCreditBefore} cannot fund four jobs.`);
  atomic(ledgerPath, ledger);
}

for (const spec of manifest.jobs) {
  const entry = ledger.jobs[spec.styleId];
  if (!entry) throw new Error(`${spec.styleId}: ledger entry missing.`);
  entry.styleId ||= spec.styleId;
  if (entry.outputPath && entry.outputPath.includes('undefined-')) {
    const correctedPath = resolve(videosDir, `${spec.styleId}-${entry.taskId}.mp4`);
    if (!existsSync(correctedPath)) renameSync(entry.outputPath, correctedPath);
    entry.outputPath = correctedPath;
    atomic(ledgerPath, ledger);
  }
  if (entry.taskId) {
    if (!finalStates.has(entry.status)) await pollAndDownload(entry);
    continue;
  }
  if (entry.status === 'SUBMISSION_AMBIGUOUS_NO_TASK_ID') throw new Error(`${spec.styleId}: unresolved ambiguous submission; no retry permitted.`);
  if (entry.status !== 'PREPARED_NOT_SUBMITTED') throw new Error(`${spec.styleId}: unsafe ledger state ${entry.status}.`);
  if (ledger.submissionIntents >= 4) throw new Error('Hard four-submission limit reached.');

  const payloadRaw = readFileSync(spec.realV3.exactPayloadPath, 'utf8');
  const payload = JSON.parse(payloadRaw);
  const prompt = readFileSync(spec.realV3.promptPath, 'utf8');
  if (payload.prompt !== prompt || sha(prompt) !== spec.realV3.promptSha256) throw new Error(`${spec.styleId}: approved prompt bytes changed.`);
  if (payload.model !== 'omni_flash' || payload.mode !== 'i2v' || payload.duration !== 15 || payload.resolution !== 720 || payload.ratio !== 2 || payload.use_unlimited !== false) throw new Error(`${spec.styleId}: provider settings changed.`);
  if (payload.media?.length !== 2 || payload.media[0] !== payload.media[1]) throw new Error(`${spec.styleId}: references are not identical.`);
  const mediaBytes = Buffer.from(payload.media[0].split(',')[1], 'base64');
  if (sha(mediaBytes) !== spec.reference.sha256) throw new Error(`${spec.styleId}: reference bytes changed.`);

  const currentBalance = await balance();
  const observedDebit = Number((ledger.supplierCreditBefore - currentBalance).toFixed(4));
  if (observedDebit + unitCost > 1.200001) throw new Error(`${spec.styleId}: budget guard stopped submission.`);
  entry.status = 'SUBMISSION_INTENT_RECORDED';
  entry.submissionIntentAt = now();
  entry.promptSha256 = spec.realV3.promptSha256;
  entry.imageSha256 = spec.reference.sha256;
  entry.sanitizedPayload = { model: payload.model, mode: payload.mode, promptSha256: spec.realV3.promptSha256, promptLength: prompt.length, media: [{ order: 1, sha256: spec.reference.sha256, bytes: mediaBytes.length }, { order: 2, sha256: spec.reference.sha256, bytes: mediaBytes.length }], ratio: payload.ratio, resolution: payload.resolution, duration: payload.duration, use_unlimited: payload.use_unlimited };
  ledger.submissionIntents += 1;
  atomic(ledgerPath, ledger);

  let submission;
  try {
    submission = await request(`${baseUrl}/api/v1/api`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Idempotency-Key': entry.idempotencyKey }, body: payloadRaw });
  } catch (error) {
    entry.status = 'SUBMISSION_AMBIGUOUS_NO_TASK_ID';
    entry.transportError = error instanceof Error ? error.message : String(error);
    const reconciled = await reconcileAmbiguous(entry.idempotencyKey);
    if (reconciled) { entry.taskId = reconciled; entry.status = 'accepted-reconciled'; }
    atomic(ledgerPath, ledger);
    if (!reconciled) throw new Error(`${spec.styleId}: submission transport result ambiguous and no task ID could be reconciled. Stopped without retry.`);
  }
  if (submission) {
    entry.submissionHttpStatus = submission.response.status;
    entry.initialResponse = submission.data;
    entry.taskId = getTaskId(submission.data);
    entry.reportedCreditCost = Number.isFinite(Number(submission.data.credit_cost)) ? Number(submission.data.credit_cost) : null;
    entry.submittedAt = now();
    entry.status = String(submission.data.status ?? (submission.response.ok ? 'accepted' : 'submission-ambiguous')).toLowerCase();
    if ((!submission.response.ok || !entry.taskId) && submission.response.status >= 500) {
      const reconciled = await reconcileAmbiguous(entry.idempotencyKey);
      if (reconciled) { entry.taskId = reconciled; entry.status = 'accepted-reconciled'; }
      else entry.status = 'SUBMISSION_AMBIGUOUS_NO_TASK_ID';
    }
    atomic(ledgerPath, ledger);
    if (!entry.taskId) throw new Error(`${spec.styleId}: provider response had no task ID. Stopped without retry.`);
    if (entry.reportedCreditCost !== null && entry.reportedCreditCost > unitCost + 0.000001) throw new Error(`${spec.styleId}: provider reported higher cost ${entry.reportedCreditCost}.`);
  }
  await pollAndDownload(entry);
}

ledger.supplierCreditAfter = await balance();
ledger.actualSupplierDebit = Number((ledger.supplierCreditBefore - ledger.supplierCreditAfter).toFixed(4));
ledger.finishedAt = now();
ledger.authorizationState = 'EXECUTED_NO_RETRIES';
atomic(ledgerPath, ledger);
if (ledger.submissionIntents > 4 || ledger.actualSupplierDebit > 1.200001) throw new Error('Campaign exceeded its hard limit.');

console.log(JSON.stringify({
  submissionIntents: ledger.submissionIntents,
  downloaded: Object.values(ledger.jobs).filter((job) => job.status === 'downloaded').length,
  supplierCreditBefore: ledger.supplierCreditBefore,
  supplierCreditAfter: ledger.supplierCreditAfter,
  actualSupplierDebit: ledger.actualSupplierDebit,
  tasks: Object.fromEntries(Object.entries(ledger.jobs).map(([style, job]) => [style, { taskId: job.taskId, status: job.status, reportedCreditCost: job.reportedCreditCost }])),
}, null, 2));
