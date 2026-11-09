import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const supabase = 'https://oudxnvazrdmnxdndpgmy.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY diperlukan.');
const out = resolve('output/provider-qa', process.env.V8_QA_RUN_NAME || 'v8-journey');
const evidencePath = resolve(out, 'evidence.json');
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
const workspaceId = evidence.account.workspaceId;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

async function api(path) {
  const response = await fetch(`${supabase}${path}`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

const select = 'id,preset_id,status,provider_task_id,compiled_prompt_snapshot,input_options,actual_duration_seconds,output_size_bytes,error_code,error_message,required_credits,created_at,completed_at,result_video_r2_key';
const jobs = await api(`/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&created_at=gte.${encodeURIComponent(evidence.createdAt)}&select=${select}&order=created_at.asc`);
const ids = jobs.map((job) => job.id);
const ledger = ids.length ? await api(`/rest/v1/credit_ledger?workspace_id=eq.${encodeURIComponent(workspaceId)}&reference_id=in.(${ids.join(',')})&select=reference_id,event_type,amount,created_at&order=created_at.asc`) : [];
const reservations = ids.length ? await api(`/rest/v1/credit_reservations?workspace_id=eq.${encodeURIComponent(workspaceId)}&job_id=in.(${ids.join(',')})&select=job_id,amount,status,created_at,settled_at`) : [];
const cases = ['BEAUTY_NX01_V8', 'SUPPLEMENT_NX01_V8', 'KITCHEN_NX01_V8', 'AUTOMOTIVE_NX01_V8'];
const products = ['Seri Dewi Facial Serum', 'Omega 3 Reference', 'Potonggo Manual Chopper', 'Roadgrip Phone Holder'];
const categories = ['beauty', 'wellness', 'kitchen', 'automotive'];

evidence.jobs = jobs.map((job, index) => {
  const mp4Path = resolve(out, `${cases[index]}.mp4`);
  const events = ledger.filter((event) => event.reference_id === job.id);
  const reservation = reservations.find((item) => item.job_id === job.id) || null;
  return {
    case: cases[index] || `JOB_${index + 1}`,
    category: categories[index] || null,
    product: products[index] || null,
    jobId: job.id,
    providerTaskId: job.provider_task_id,
    status: job.status,
    requiredCredits: job.required_credits,
    reservation,
    ledger: events,
    walletIntegrity: events.filter((event) => event.event_type === 'RESERVE').length === 1 &&
      (job.status === 'COMPLETED'
        ? events.filter((event) => event.event_type === 'SETTLE').length === 1
        : events.filter((event) => event.event_type === 'RELEASE').length === 1),
    actualDurationSeconds: job.actual_duration_seconds,
    storedBytes: job.output_size_bytes,
    storageKeyPresent: Boolean(job.result_video_r2_key),
    mp4Path: existsSync(mp4Path) ? mp4Path : null,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    scriptMode: job.input_options?.scriptMode,
    cta: job.input_options?.callToAction,
    promptHasV8: job.compiled_prompt_snapshot?.includes('[HUMAN REALISM MASTERPROMPT V8]') || false,
    promptHasSmartScript: job.compiled_prompt_snapshot?.includes('[V8 SMART SCRIPT CONTROL]') || false,
    promptRemovedSecond11Rule: !job.compiled_prompt_snapshot?.includes('before second 11'),
    createdAt: job.created_at,
    completedAt: job.completed_at,
  };
});
evidence.evidenceReconciledAt = new Date().toISOString();
evidence.auditErrors = evidence.errors;
evidence.errors = evidence.jobs.filter((job) => job.status !== 'COMPLETED').map((job) => ({ case: job.case, message: job.errorMessage || job.errorCode || job.status }));
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ jobs: evidence.jobs, errors: evidence.errors, closingWallet: evidence.account.closingWallet }, null, 2));
