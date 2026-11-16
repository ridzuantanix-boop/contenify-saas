import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiKey = process.env.NEXABOT_API_KEY;
if (!apiKey) throw new Error('NEXABOT_API_KEY is required.');
const root = resolve('output/affimatik-real-v2-release');
const manifestPath = resolve(root, 'manifest.json');
const statePath = resolve(root, 'provider-state.json');
const videosDir = resolve(root, 'videos');
const baseUrl = process.env.NEXABOT_BASE_URL || 'https://nexabot.id';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const maximumBudget = 15;
const expectedUnitCost = 0.3;
const maximumActive = 3;
const terminal = new Set(['downloaded','done','failed','cancelled','rejected','submission-ambiguous']);
const active = new Set(['queued','pending','processing','running','accepted']);
if (manifest.jobs?.length !== 30 || manifest.exactInitialSubmissionLimit !== 30 || manifest.totalSupplierBudget !== maximumBudget) throw new Error('Manifest authorization guards do not match the approved 30-demo / 15-credit campaign.');
mkdirSync(videosDir, { recursive: true });

const headers = { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey };
const now = () => new Date().toISOString();
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const atomic = (path, value) => {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { renameSync(temporary, path); return; }
    catch (error) {
      if (!['EPERM','EACCES'].includes(error?.code) || attempt === 19) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
};
async function request(url, options = {}) { const response = await fetch(url, options); const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { data = { raw: raw.slice(0, 2000) }; } return { response, data }; }
async function balance() { const { response, data } = await request(`${baseUrl}/api/v1/credits`, { headers }); const value = Number(data.credit ?? data.balance); if (!response.ok || !Number.isFinite(value)) throw new Error(`Provider balance unavailable: HTTP ${response.status}.`); return value; }

const modes = await request(`${baseUrl}/api/v1/modes`, { headers });
if (!modes.response.ok) throw new Error(`Provider mode preflight failed: HTTP ${modes.response.status}.`);
const videoModels = modes.data.video_models ?? modes.data.modes?.video_models ?? [];
const model = videoModels.find((candidate) => candidate.id === 'omni_flash');
const confirmedUnitCost = Number(model?.credit_cost ?? modes.data.video_credit_costs?.omni_flash ?? modes.data.video_credit_cost);
if (!model || model.duration !== 15 || !model.resolutions?.includes('720p') || !model.modes?.includes('i2v')) throw new Error('Provider did not confirm omni_flash i2v / 15 seconds / 720p. No submission made.');
if (!Number.isFinite(confirmedUnitCost) || confirmedUnitCost > expectedUnitCost + 0.000001 || confirmedUnitCost * 30 > maximumBudget) throw new Error(`Provider cost ${confirmedUnitCost} is outside the authorized budget. No submission made.`);

let state;
if (existsSync(statePath)) {
  state = JSON.parse(readFileSync(statePath, 'utf8'));
  if (state.campaign !== manifest.campaign || state.maximumBudget !== maximumBudget) throw new Error('Existing campaign state guard mismatch.');
} else {
  const jobsResult = await request(`${baseUrl}/api/v1/jobs`, { headers });
  if (!jobsResult.response.ok) throw new Error(`Provider active-job check failed: HTTP ${jobsResult.response.status}.`);
  const providerJobs = jobsResult.data.jobs ?? jobsResult.data.data ?? [];
  const activeBefore = Array.isArray(providerJobs) ? providerJobs.filter((job) => active.has(String(job.status ?? '').toLowerCase())) : [];
  if (activeBefore.length) throw new Error(`Provider has ${activeBefore.length} active job(s). No campaign jobs submitted.`);
  const creditBefore = await balance();
  if (creditBefore < confirmedUnitCost * 30) throw new Error(`Supplier balance ${creditBefore} cannot fund 30 initial demos.`);
  state = { campaign: manifest.campaign, startedAt: now(), confirmedUnitCost, maximumBudget, maximumActive, supplierCreditBefore: creditBefore, submissionIntents: 0, jobs: {} };
  atomic(statePath, state);
}

async function pollBatch(batch) {
  const deadline = Date.now() + 35 * 60 * 1000;
  while (Date.now() < deadline) {
    let completed = 0;
    for (const entry of batch) {
      if (terminal.has(entry.status)) { completed += 1; continue; }
      const { response, data } = await request(`${baseUrl}/api/v1/jobs/${entry.taskId}`, { headers });
      const job = data.job ?? data;
      const status = String(job.status ?? 'unknown').toLowerCase();
      entry.pollHistory.push({ at: now(), httpStatus: response.status, status, progress: job.progress ?? null, error: job.error ?? null });
      entry.status = status;
      entry.finalProviderRecord = job;
      if (status === 'done') {
        const source = job.storage_url || job.video_url || `${baseUrl}/api/v1/jobs/${entry.taskId}/download`;
        const download = await fetch(source.startsWith('http') ? source : `${baseUrl}${source}`, { headers });
        if (!download.ok) throw new Error(`${entry.styleId}: download HTTP ${download.status}.`);
        const video = Buffer.from(await download.arrayBuffer());
        if (video.length < 100000 || !video.subarray(4, 12).toString('ascii').includes('ftyp')) throw new Error(`${entry.styleId}: provider output is not a valid-sized MP4.`);
        entry.outputPath = resolve(videosDir, `${entry.styleId}-${entry.taskId}.mp4`);
        writeFileSync(entry.outputPath, video);
        entry.outputBytes = video.length;
        entry.outputSha256 = sha(video);
        entry.downloadedAt = now();
        entry.status = 'downloaded';
        completed += 1;
      } else if (['failed','cancelled','rejected'].includes(status)) completed += 1;
    }
    atomic(statePath, state);
    if (completed === batch.length) return;
    await wait(6000);
  }
  throw new Error(`Polling timeout for batch ${batch.map((entry) => entry.styleId).join(', ')}. Original task IDs are preserved; no retry was made.`);
}

for (let offset = 0; offset < manifest.jobs.length; offset += maximumActive) {
  const specs = manifest.jobs.slice(offset, offset + maximumActive);
  const batch = [];
  for (const spec of specs) {
    let entry = state.jobs[spec.styleId];
    if (entry?.taskId && !terminal.has(entry.status)) { batch.push(entry); continue; }
    if (entry && terminal.has(entry.status)) continue;
    if (entry && !entry.taskId) throw new Error(`${spec.styleId}: prior ambiguous submission intent has no task ID. Stopped without resubmitting.`);
    if (state.submissionIntents >= 30) throw new Error('Hard submission-intent limit reached.');
    const currentBalance = await balance();
    const debitSoFar = Number((state.supplierCreditBefore - currentBalance).toFixed(4));
    if (debitSoFar + confirmedUnitCost > maximumBudget + 0.000001) throw new Error(`Budget guard stopped before ${spec.styleId}.`);
    const prompt = readFileSync(spec.promptPath, 'utf8');
    const image = readFileSync(spec.imagePath);
    if (sha(prompt) !== spec.promptSha256 || sha(image) !== spec.imageSha256) throw new Error(`${spec.styleId}: preflight bytes changed.`);
    const mime = spec.imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const imageData = `data:${mime};base64,${image.toString('base64')}`;
    const idempotencyKey = `affimatik-real-v2-${spec.styleId.toLowerCase()}-${spec.promptSha256.slice(0,12)}-${spec.imageSha256.slice(0,12)}`;
    entry = { styleId: spec.styleId, styleName: spec.styleName, productLabel: spec.productLabel, imageSha256: spec.imageSha256, promptSha256: spec.promptSha256, promptPath: spec.promptPath, promptLength: spec.promptLength, cta: spec.cta, idempotencyKey, mediaCount: 2, mediaOrder: [spec.imageSha256, spec.imageSha256], submissionIntentAt: now(), status: 'submission-intent-recorded', pollHistory: [], sanitizedPayload: { model:'omni_flash', mode:'i2v', promptPath:spec.promptPath, promptSha256:spec.promptSha256, media:[{order:1,sha256:spec.imageSha256,bytes:image.length},{order:2,sha256:spec.imageSha256,bytes:image.length}], ratio:2, resolution:720, duration:15, use_unlimited:false } };
    state.jobs[spec.styleId] = entry;
    state.submissionIntents += 1;
    atomic(statePath, state);
    const payload = { model:'omni_flash', mode:'i2v', prompt, telegram_id:'web', media:[imageData,imageData], ratio:2, resolution:720, duration:15, use_unlimited:false };
    const { response, data } = await request(`${baseUrl}/api/v1/api`, { method:'POST', headers:{...headers,'Content-Type':'application/json','X-Idempotency-Key':idempotencyKey}, body:JSON.stringify(payload) });
    entry.submissionHttpStatus = response.status;
    entry.initialResponse = data;
    entry.taskId = String(data.job_id ?? data.task_id ?? data.id ?? '');
    entry.reportedCreditCost = Number.isFinite(Number(data.credit_cost)) ? Number(data.credit_cost) : null;
    entry.submittedAt = now();
    entry.status = String(data.status ?? (response.ok ? 'accepted' : 'submission-ambiguous')).toLowerCase();
    if (!response.ok || !entry.taskId) entry.status = 'submission-ambiguous';
    atomic(statePath, state);
    if (entry.reportedCreditCost !== null && entry.reportedCreditCost > confirmedUnitCost + 0.000001) throw new Error(`${spec.styleId}: provider price increased to ${entry.reportedCreditCost}.`);
    if (entry.status === 'submission-ambiguous') throw new Error(`${spec.styleId}: ambiguous submission. Stopped without retry.`);
    batch.push(entry);
  }
  if (batch.length) await pollBatch(batch);
}

state.supplierCreditAfter = await balance();
state.actualSupplierDebit = Number((state.supplierCreditBefore - state.supplierCreditAfter).toFixed(4));
state.finishedAt = now();
atomic(statePath, state);
if (state.actualSupplierDebit > maximumBudget + 0.000001) throw new Error(`Actual debit ${state.actualSupplierDebit} exceeded ${maximumBudget}.`);
console.log(JSON.stringify({ submitted: state.submissionIntents, downloaded: Object.values(state.jobs).filter((job) => job.status === 'downloaded').length, failed: Object.values(state.jobs).filter((job) => ['failed','cancelled','rejected'].includes(job.status)).length, creditBefore: state.supplierCreditBefore, creditAfter: state.supplierCreditAfter, debit: state.actualSupplierDebit, tasks: Object.fromEntries(Object.entries(state.jobs).map(([id, job]) => [id, { taskId: job.taskId, status: job.status, credit: job.reportedCreditCost }])) }, null, 2));
