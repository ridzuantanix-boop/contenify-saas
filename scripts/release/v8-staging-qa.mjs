import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import crypto from 'node:crypto';

const base = process.env.V8_QA_BASE || 'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const accessControlledStaging = base.includes('affimatik-launch-lite-staging');
const supabase = 'https://oudxnvazrdmnxdndpgmy.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const gateKey = process.env.STAGING_GATE_SECRET;
const email = process.env.V8_QA_EMAIL || 'codex.v8.qa@affimatik.online';
const password = process.env.V8_QA_PASSWORD;
const nexabotKey = process.env.NEXABOT_API_KEY;
if (!serviceKey || !password || !nexabotKey || (accessControlledStaging && !gateKey)) throw new Error('Rahsia V8 QA tidak lengkap.');

const out = resolve('output/provider-qa', process.env.V8_QA_RUN_NAME || 'v8-journey');
mkdirSync(out, { recursive: true });
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
const evidence = { createdAt: new Date().toISOString(), base, account: {}, desktop: {}, mobile: {}, jobs: [], errors: [] };

async function api(path, init = {}) {
  const response = await fetch(`${supabase}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function ensureTestAccount() {
  const list = await api('/auth/v1/admin/users?page=1&per_page=1000');
  let user = list.users?.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    const response = await fetch(`${supabase}/auth/v1/admin/users`, { method: 'POST', headers, body: JSON.stringify({
      email, password, email_confirm: true, user_metadata: { full_name: 'Codex V8 QA', whatsapp: '601100000000' },
    }) });
    if (!response.ok) throw new Error(`Cipta akaun V8 QA gagal: ${response.status}`);
    user = await response.json();
  }
  const provision = await api('/rest/v1/rpc/provision_verified_account_atomic', { method: 'POST', body: JSON.stringify({
    p_user_id: user.id, p_email: email, p_full_name: 'Codex V8 QA', p_whatsapp: '601100000000', p_referral_code: null,
  }) });
  if (!provision.success || !provision.workspace_id) throw new Error(`Provision V8 QA gagal: ${JSON.stringify(provision)}`);
  const workspaceId = provision.workspace_id;
  const wallets = await api(`/rest/v1/credit_wallets?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=balance,reserved_balance&limit=1`);
  const minimumBalance = Number(process.env.V8_QA_MIN_BALANCE || 60);
  const topUp = Math.max(0, minimumBalance - Number(wallets[0]?.balance || 0));
  if (topUp > 0) await api('/rest/v1/rpc/admin_adjust_credits_atomic', { method: 'POST', body: JSON.stringify({
    p_workspace_id: workspaceId, p_amount: topUp, p_reason: 'Controlled V8 four-category staging QA', p_admin_email: 'qa-system@affimatik.online',
  }) });
  evidence.account = { userId: user.id, workspaceId, openingWallet: (await api(`/rest/v1/credit_wallets?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=balance,reserved_balance&limit=1`))[0] };
  return { user, workspaceId };
}

async function unlock(page) {
  if (!accessControlledStaging) {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    return;
  }
  await page.goto(`${base}/__stage_access`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="key"]').fill(gateKey);
  await Promise.all([page.waitForURL(`${base}/`), page.getByRole('button', { name: 'Enter' }).click()]);
}

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Log Masuk' }).click();
  await page.waitForURL(/\/dashboard/);
}

async function wallet(page) {
  const session = await page.evaluate(async () => (await fetch('/api/auth/session', { cache: 'no-store' })).json());
  return session.wallet;
}

async function authenticatedReadSmoke(page) {
  return page.evaluate(async () => {
    const readJson = async (path, init) => {
      const response = await fetch(path, { cache: 'no-store', ...init });
      return { status: response.status, data: await response.json().catch(() => ({})) };
    };
    const [session, products, videos, styles] = await Promise.all([
      readJson('/api/auth/session'), readJson('/api/products'), readJson('/api/videos'), readJson('/api/styles'),
    ]);
    const firstVideo = videos.data?.videos?.[0];
    const privateRange = firstVideo?.streamUrl
      ? await fetch(firstVideo.streamUrl, { headers: { Range: 'bytes=0-1023' }, cache: 'no-store' })
      : null;
    const previews = Array.isArray(styles.data?.styles)
      ? await Promise.all(styles.data.styles.map(async (style) => {
          const url = style.previewVideoUrl || style.preview_video_url;
          if (!url) return { id: style.id, status: 0 };
          const response = await fetch(url, { headers: { Range: 'bytes=0-1023' }, cache: 'no-store' });
          return { id: style.id, status: response.status };
        }))
      : [];
    const checkout = await fetch('/api/billing/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: 'starter' }),
    });
    return {
      sessionStatus: session.status,
      authenticated: session.data?.authenticated === true,
      wallet: session.data?.wallet || null,
      productsStatus: products.status,
      productCount: products.data?.assets?.length || 0,
      videosStatus: videos.status,
      videoCount: videos.data?.videos?.length || 0,
      privateRangeStatus: privateRange?.status || null,
      privateContentRange: privateRange?.headers.get('content-range') || null,
      styleCount: styles.data?.count || 0,
      previewPassCount: previews.filter((item) => item.status === 200 || item.status === 206).length,
      previewResults: previews,
      checkoutStatus: checkout.status,
    };
  });
}

async function providerCredits() {
  const response = await fetch('https://nexabot.id/api/v1/credits', {
    headers: { Authorization: `Bearer ${nexabotKey}`, 'X-API-Key': nexabotKey },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.credit !== 'number') throw new Error(`Semakan kredit provider gagal HTTP ${response.status}`);
  return data.credit;
}

async function waitForJob(page, jobId, timeoutMs = 12 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await page.evaluate(async (id) => {
      const response = await fetch(`/api/jobs?jobId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      return { http: response.status, data: await response.json() };
    }, jobId);
    if (result.data.status === 'COMPLETED') return result.data;
    if (['FAILED', 'REJECTED'].includes(result.data.status)) throw new Error(`Provider job ${jobId} ${result.data.status}: ${result.data.error || ''}`);
    await new Promise((done) => setTimeout(done, 10000));
  }
  throw new Error(`Timeout menunggu provider job ${jobId}`);
}

async function generate(page, spec, workspaceId) {
  await page.goto(`${base}/factory?styleId=${encodeURIComponent(spec.styleId || 'NX01')}`, { waitUntil: 'networkidle' });
  const before = await wallet(page);
  const providerCreditBefore = await providerCredits();
  await page.locator('label').filter({ hasText: 'Pilih atau Seret Gambar Produk' }).locator('input[type="file"]').setInputFiles(spec.image);
  await page.getByText('Identiti produk dikunci').waitFor();
  await page.locator('input[placeholder*="Serum Rawatan"]').fill(spec.name);
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('button', { name: 'Smart Script', exact: false }).click();
  await page.locator('label').filter({ hasText: 'CTA' }).locator('select').selectOption(spec.cta || 'none');
  await page.locator('label').filter({ hasText: 'Niche / Kategori' }).locator('select').selectOption(spec.niche);
  if (spec.fact) {
    await page.locator('label').filter({ hasText: 'Satu Fakta Produk Yang Disahkan' }).locator('input').fill(spec.fact);
  }
  await page.screenshot({ path: resolve(out, `${spec.case}-before-submit.png`), fullPage: true });
  const submitPromise = page.waitForResponse((response) => response.url().endsWith('/api/jobs') && response.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: /Jana Video Sekarang/ }).click();
  const submitResponse = await submitPromise;
  const submit = await submitResponse.json();
  if (!submitResponse.ok()) throw new Error(`Submit ${spec.case} HTTP ${submitResponse.status()}: ${JSON.stringify(submit)}`);
  const reserved = await wallet(page);
  const completed = await waitForJob(page, submit.jobId);
  const after = await wallet(page);
  const providerCreditAfter = await providerCredits();
  const media = await page.request.get(`${base}/api/videos/${submit.jobId}/stream`);
  const bytes = await media.body();
  const mp4Path = resolve(out, `${spec.case}.mp4`);
  writeFileSync(mp4Path, bytes);
  const range = await page.request.get(`${base}/api/videos/${submit.jobId}/stream`, { headers: { Range: 'bytes=0-1023' } });
  const rows = await api(`/rest/v1/video_jobs?id=eq.${encodeURIComponent(submit.jobId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,provider_task_id,status,compiled_prompt_snapshot,input_options,actual_duration_seconds,output_size_bytes&limit=1`);
  const row = rows[0] || {};
  const result = {
    case: spec.case, category: spec.niche, product: spec.name, styleId: spec.styleId || 'NX01', requestedCta: spec.cta || 'none',
    requestedFact: spec.fact || null, source: basename(spec.image), jobId: submit.jobId,
    providerTaskId: submit.providerTaskId, status: completed.status, before, reserved, after,
    mp4Path, fullStatus: media.status(), fullBytes: bytes.length, rangeStatus: range.status(), contentRange: range.headers()['content-range'] || null,
    actualDurationSeconds: row.actual_duration_seconds, storedBytes: row.output_size_bytes,
    providerCreditBefore, providerCreditAfter, providerCost: Number((providerCreditBefore - providerCreditAfter).toFixed(4)),
    scriptMode: row.input_options?.scriptMode, cta: row.input_options?.callToAction,
    promptHasV8: typeof row.compiled_prompt_snapshot === 'string' && row.compiled_prompt_snapshot.includes('[HUMAN REALISM MASTERPROMPT V8]'),
    promptHasSmartScript: typeof row.compiled_prompt_snapshot === 'string' && row.compiled_prompt_snapshot.includes('[V8 SMART SCRIPT CONTROL]'),
    promptHasIngredientReferenceLock: typeof row.compiled_prompt_snapshot === 'string' && row.compiled_prompt_snapshot.includes('[INGREDIENT REFERENCE — NEVER FIRST FRAME LOCK]'),
    promptDeclaresDuplicateProduct: typeof row.compiled_prompt_snapshot === 'string' && row.compiled_prompt_snapshot.includes('Reference images 1 and 2 are intentionally IDENTICAL'),
    promptRequiresFreshOpening: typeof row.compiled_prompt_snapshot === 'string' && row.compiled_prompt_snapshot.includes('first generated video frame must be a freshly composed live-action frame'),
  };
  evidence.jobs.push(result);
  writeFileSync(resolve(out, 'progress.json'), JSON.stringify(evidence, null, 2));
  return result;
}

const { workspaceId } = await ensureTestAccount();
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await desktop.newPage();
  await unlock(page); await login(page);
  evidence.desktop.readSmoke = await authenticatedReadSmoke(page);
  await page.goto(`${base}/factory`, { waitUntil: 'networkidle' });
  evidence.desktop.generatePresent = await page.getByRole('button', { name: /Jana Video Sekarang/ }).count() > 0;
  await page.getByRole('button', { name: 'Customize' }).click();
  evidence.desktop.smartScriptVisible = await page.getByRole('button', { name: 'Smart Script', exact: false }).isVisible();
  evidence.desktop.customScriptVisible = await page.getByRole('button', { name: 'Custom Script', exact: false }).isVisible();
  evidence.desktop.providerAutoVisible = await page.getByRole('button', { name: 'Provider Auto', exact: false }).isVisible();
  evidence.desktop.ctaOptions = await page.locator('label').filter({ hasText: 'CTA' }).locator('option').allTextContents();
  await page.screenshot({ path: resolve(out, 'desktop-v8-controls.png'), fullPage: true });

  const originalSpecs = [
    { case: 'BEAUTY_NX01_V8', niche: 'beauty', name: 'Seri Dewi Facial Serum', image: resolve('output/provider-qa/v7-inputs/beauty-seri-dewi.png') },
    { case: 'SUPPLEMENT_NX01_V8', niche: 'wellness', name: 'Omega 3 Reference', image: resolve('output/release/journey-ui/health-omega3.png') },
    { case: 'KITCHEN_NX01_V8', niche: 'kitchen', name: 'Potonggo Manual Chopper', image: resolve('output/provider-qa/v7-inputs/kitchen-potonggo.png') },
    { case: 'AUTOMOTIVE_NX01_V8', niche: 'automotive', name: 'Roadgrip Phone Holder', image: resolve('output/provider-qa/v7-inputs/automotive-roadgrip.png') },
  ];
  const v81CtaSpecs = [
    { case: 'SUPPLEMENT_NX07_V81_BEG_KUNING', styleId: 'NX07', cta: 'tiktok_shop', niche: 'wellness', name: 'Omega 3 Reference', fact: 'mengandungi Omega-3', image: resolve('output/release/journey-ui/health-omega3.png') },
    { case: 'BEAUTY_NX16_V81_KLIK', styleId: 'NX16', cta: 'click_button', niche: 'beauty', name: 'Seri Dewi Facial Serum', fact: 'serum untuk rutin wajah', image: resolve('output/provider-qa/v7-inputs/beauty-seri-dewi.png') },
    { case: 'KITCHEN_NX17_V81_NONE', styleId: 'NX17', cta: 'none', niche: 'kitchen', name: 'Potonggo Manual Chopper', fact: 'pemotong manual untuk bahan dapur', image: resolve('output/provider-qa/v7-inputs/kitchen-potonggo.png') },
  ];
  const allSpecs = process.env.V8_QA_PROFILE === 'v81_cta' ? v81CtaSpecs : originalSpecs;
  const selectedCases = new Set((process.env.V8_QA_CASES || '').split(',').map((value) => value.trim()).filter(Boolean));
  const specs = selectedCases.size ? allSpecs.filter((spec) => selectedCases.has(spec.case)) : allSpecs;
  for (const spec of specs) {
    try { await generate(page, spec, workspaceId); }
    catch (error) {
      evidence.errors.push({ case: spec.case, message: error instanceof Error ? error.message : String(error) });
      writeFileSync(resolve(out, 'progress.json'), JSON.stringify(evidence, null, 2));
    }
  }
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobilePage = await mobile.newPage();
  await unlock(mobilePage); await login(mobilePage);
  await mobilePage.goto(`${base}/factory`, { waitUntil: 'networkidle' });
  evidence.mobile.generatePresent = await mobilePage.getByRole('button', { name: 'Jana Video', exact: true }).count() > 0;
  await mobilePage.getByRole('button', { name: 'Customize' }).click();
  evidence.mobile.smartScriptVisible = await mobilePage.getByRole('button', { name: 'Smart Script', exact: false }).isVisible();
  evidence.mobile.customScriptVisible = await mobilePage.getByRole('button', { name: 'Custom Script', exact: false }).isVisible();
  await mobilePage.screenshot({ path: resolve(out, 'mobile-v8-controls.png'), fullPage: true });
  await mobile.close();
} finally {
  evidence.finishedAt = new Date().toISOString();
  evidence.account.closingWallet = (await api(`/rest/v1/credit_wallets?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=balance,reserved_balance&limit=1`))[0];
  writeFileSync(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ account: evidence.account, desktop: evidence.desktop, mobile: evidence.mobile, jobs: evidence.jobs, errors: evidence.errors }, null, 2));

