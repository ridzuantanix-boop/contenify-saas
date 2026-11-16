import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const key = process.env.NEXABOT_API_KEY;
if (!key) throw new Error('NEXABOT_API_KEY is required.');
const root = resolve('output/expansion-v1-owner-rerun');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const ledgerPath = resolve(root, 'submission-ledger.json');
const videos = resolve(root, 'videos');
mkdirSync(videos, { recursive: true });
const headers = { Authorization: `Bearer ${key}`, 'x-api-key': key };
const base = 'https://nexabot.id';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const atomic = (value) => { const temp = `${ledgerPath}.tmp`; writeFileSync(temp, JSON.stringify(value, null, 2)); renameSync(temp, ledgerPath); };
async function request(url, options = {}) { const response = await fetch(url, options); const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { data = { raw: raw.slice(0, 1000) }; } return { response, data }; }
async function balance() { const { response, data } = await request(`${base}/api/v1/credits`, { headers }); const value = Number(data.credit ?? data.balance); if (!response.ok || !Number.isFinite(value)) throw new Error(`Balance unavailable: HTTP ${response.status}.`); return value; }
const taskId = (data) => String(data?.job_id ?? data?.task_id ?? data?.id ?? data?.job?.id ?? '');
async function reconcile(idempotencyKey) { const { response, data } = await request(`${base}/api/v1/jobs`, { headers }); if (!response.ok) return null; const rows = data.jobs ?? data.data ?? []; const found = Array.isArray(rows) && rows.find((job) => job.idempotency_key === idempotencyKey || job.idempotencyKey === idempotencyKey || job.client_request_id === idempotencyKey); return found ? String(found.id ?? found.job_id ?? found.task_id ?? '') : null; }
async function poll(entry) {
  const deadline = Date.now() + 35 * 60 * 1000;
  entry.pollHistory ||= [];
  while (Date.now() < deadline) {
    const result = await request(`${base}/api/v1/jobs/${entry.taskId}`, { headers });
    const job = result.data.job ?? result.data;
    const status = String(job.status ?? 'unknown').toLowerCase();
    entry.pollHistory.push({ at: now(), httpStatus: result.response.status, status, progress: job.progress ?? null, error: job.error ?? null });
    entry.status = status; entry.finalProviderRecord = job; atomic(ledger);
    if (status === 'done') {
      const source = job.storage_url || job.video_url || `${base}/api/v1/jobs/${entry.taskId}/download`;
      const response = await fetch(source.startsWith('http') ? source : `${base}${source}`, { headers });
      if (!response.ok) throw new Error(`${entry.styleId}: download HTTP ${response.status}.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100000 || !bytes.subarray(4, 12).toString('ascii').includes('ftyp')) throw new Error(`${entry.styleId}: invalid MP4.`);
      entry.outputPath = resolve(videos, `${entry.styleId}-${entry.taskId}.mp4`); writeFileSync(entry.outputPath, bytes);
      entry.outputBytes = bytes.length; entry.outputSha256 = sha(bytes); entry.status = 'downloaded'; entry.downloadedAt = now(); atomic(ledger); return;
    }
    if (['failed', 'cancelled', 'rejected'].includes(status)) return;
    await wait(7000);
  }
  entry.status = 'poll-timeout-original-task-preserved'; atomic(ledger); throw new Error(`${entry.styleId}: polling timeout; no retry made.`);
}

if (manifest.jobs.map((job) => job.styleId).join(',') !== 'NX27,NX30') throw new Error('Manifest does not match the approved two-style rerun.');
const modes = await request(`${base}/api/v1/modes`, { headers });
const models = modes.data.video_models ?? modes.data.modes?.video_models ?? [];
const model = models.find((candidate) => candidate.id === 'omni_flash');
const unitCost = Number(model?.credit_cost ?? modes.data.video_credit_costs?.omni_flash ?? modes.data.video_credit_cost);
if (!modes.response.ok || !model || model.duration !== 15 || !model.resolutions?.includes('720p') || !model.modes?.includes('i2v')) throw new Error('Provider no longer confirms omni_flash i2v 15s 720p.');
if (!Number.isFinite(unitCost) || unitCost * 2 > 0.600001) throw new Error(`Two jobs would exceed 0.60 credits at ${unitCost} each.`);
let ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
ledger.confirmedUnitCost = unitCost; ledger.startedAt ||= now();
const jobsResponse = await request(`${base}/api/v1/jobs`, { headers });
const active = (jobsResponse.data.jobs ?? jobsResponse.data.data ?? []).filter((job) => ['queued','pending','processing','running','accepted'].includes(String(job.status ?? '').toLowerCase()));
if (!jobsResponse.response.ok || active.length) throw new Error(`Provider active-job preflight failed or found ${active.length} active job(s).`);
ledger.supplierCreditBefore ||= await balance();
if (ledger.supplierCreditBefore < unitCost * 2) throw new Error('Insufficient supplier balance.');
atomic(ledger);

for (const spec of manifest.jobs) {
  const entry = ledger.jobs[spec.styleId]; entry.styleId = spec.styleId;
  if (entry.taskId) { if (entry.status !== 'downloaded') await poll(entry); continue; }
  if (entry.status !== 'PREPARED_NOT_SUBMITTED' || ledger.submissionIntents >= 2) throw new Error(`${spec.styleId}: unsafe submission state.`);
  const payloadRaw = readFileSync(spec.payloadPath, 'utf8'); const payload = JSON.parse(payloadRaw); const prompt = readFileSync(spec.promptPath, 'utf8');
  if (payload.prompt !== prompt || sha(prompt) !== spec.promptSha256 || payload.media.length !== 2 || payload.media[0] !== payload.media[1]) throw new Error(`${spec.styleId}: prepared bytes changed.`);
  if (sha(Buffer.from(payload.media[0].split(',')[1], 'base64')) !== spec.imageSha256) throw new Error(`${spec.styleId}: reference changed.`);
  entry.status = 'SUBMISSION_INTENT_RECORDED'; entry.submissionIntentAt = now(); ledger.submissionIntents += 1; atomic(ledger);
  let result;
  try { result = await request(`${base}/api/v1/api`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Idempotency-Key': spec.idempotencyKey }, body: payloadRaw }); }
  catch (error) { entry.status = 'SUBMISSION_AMBIGUOUS_NO_TASK_ID'; entry.transportError = String(error); entry.taskId = await reconcile(spec.idempotencyKey); atomic(ledger); if (!entry.taskId) throw new Error(`${spec.styleId}: ambiguous submission; stopped without retry.`); }
  if (result) { entry.submissionHttpStatus = result.response.status; entry.initialResponse = result.data; entry.taskId = taskId(result.data); entry.reportedCreditCost = Number(result.data.credit_cost ?? unitCost); entry.status = String(result.data.status ?? 'accepted').toLowerCase(); if ((!result.response.ok || !entry.taskId) && result.response.status >= 500) entry.taskId = await reconcile(spec.idempotencyKey); atomic(ledger); if (!entry.taskId) throw new Error(`${spec.styleId}: no task ID; stopped without retry.`); }
  await poll(entry);
}
ledger.supplierCreditAfter = await balance(); ledger.actualSupplierDebit = Number((ledger.supplierCreditBefore - ledger.supplierCreditAfter).toFixed(4)); ledger.finishedAt = now(); atomic(ledger);
if (ledger.submissionIntents > 2 || ledger.actualSupplierDebit > 0.600001) throw new Error('Hard campaign limit exceeded.');
console.log(JSON.stringify({ submissionIntents: ledger.submissionIntents, unitCost, supplierCreditBefore: ledger.supplierCreditBefore, supplierCreditAfter: ledger.supplierCreditAfter, actualSupplierDebit: ledger.actualSupplierDebit, jobs: ledger.jobs }, null, 2));
