import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import crypto from 'node:crypto';

const base = 'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const supabase = 'https://oudxnvazrdmnxdndpgmy.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const gateKey = process.env.STAGING_GATE_SECRET;
if (!serviceKey || !anonKey || !gateKey) throw new Error('Rahsia staging QA tidak lengkap.');
const out = resolve('output/provider-qa/v7-journey'); mkdirSync(out, { recursive: true });
const input = resolve('output/provider-qa/v7-inputs');
const email = process.env.V7_QA_EMAIL || `codex.v7.qa.${Date.now()}@example.com`;
const password = process.env.V7_QA_PASSWORD || `V7-QA-${crypto.randomBytes(18).toString('base64url')}!`;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

async function api(path, init = {}) {
  const response = await fetch(`${supabase}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

let authUser;
const createUserResponse = await fetch(`${supabase}/auth/v1/admin/users`, { method: 'POST', headers, body: JSON.stringify({
  email, password, email_confirm: true, user_metadata: { full_name: 'Codex V7 QA', whatsapp: '601100000000' },
}) });
if (createUserResponse.ok) authUser = await createUserResponse.json();
else {
  const list = await api('/auth/v1/admin/users?page=1&per_page=1000');
  authUser = list.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!authUser) throw new Error(`Akaun QA tidak dapat dicipta/ditemui: HTTP ${createUserResponse.status}`);
}
const provision = await api('/rest/v1/rpc/provision_verified_account_atomic', { method: 'POST', body: JSON.stringify({
  p_user_id: authUser.id, p_email: email, p_full_name: 'Codex V7 QA', p_whatsapp: '601100000000', p_referral_code: null,
}) });
if (!provision.success || !provision.workspace_id) throw new Error(`Provision gagal: ${JSON.stringify(provision)}`);
const workspaceId = provision.workspace_id;
const walletRows = await api(`/rest/v1/credit_wallets?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=balance,reserved_balance&limit=1`);
const topUp = Math.max(0, 60 - Number(walletRows[0]?.balance || 0));
if (topUp > 0) await api('/rest/v1/rpc/admin_adjust_credits_atomic', { method: 'POST', body: JSON.stringify({
  p_workspace_id: workspaceId, p_amount: topUp, p_reason: 'Controlled V7 four-combination provider QA', p_admin_email: 'qa-system@affimatik.online',
}) });

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const evidence = { testAccountId: authUser.id, workspaceId, createdAt: new Date().toISOString(), jobs: [], desktop: {}, mobile: {}, posters: {}, library: {}, errors: [] };
const styleIds = ['NX01','NX02','NX03','NX05','NX07','NX09','NX10','RH01','RH02','RH03','RH04','RH17','RH19','NX11','NX12','NX13','NX14','NX15','NX16','NX17'];

async function unlock(page) {
  await page.goto(`${base}/__stage_access`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="key"]').fill(gateKey);
  await Promise.all([page.waitForURL(`${base}/`), page.getByRole('button', { name: 'Enter' }).click()]);
}

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(750);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/session') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log Masuk' }).click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Login staging HTTP ${response.status()}: ${JSON.stringify(await response.json().catch(() => ({})))}`);
  await page.waitForURL(/\/dashboard/);
}

async function loadLazyPosters(page) {
  const posters = page.locator('img[alt^="Poster gaya"]');
  for (let index = 0; index < await posters.count(); index += 1) {
    await posters.nth(index).scrollIntoViewIfNeeded();
    await posters.nth(index).waitFor({ state: 'visible' });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function wallet(page) {
  return page.evaluate(async () => (await fetch('/api/auth/session', { cache: 'no-store' })).json());
}

async function uploadWithDialogs(page, locator, file, answers) {
  const queue = [...answers];
  const handler = async (dialog) => {
    const answer = queue.shift();
    if (dialog.type() === 'prompt') await dialog.accept(String(answer || 'QA Asset'));
    else if (dialog.type() === 'confirm') await dialog.accept();
    else await dialog.dismiss();
  };
  page.on('dialog', handler);
  try { await locator.setInputFiles(file); await page.waitForTimeout(1000); }
  finally { page.off('dialog', handler); }
}

async function selectCustomization(page, { avatar, background }) {
  await page.getByRole('button', { name: 'Customize' }).click();
  if (avatar) await page.locator('button').filter({ has: page.locator(`img[alt="${avatar}"]`) }).click();
  else await page.getByRole('button', { name: 'Auto Presenter', exact: true }).click();
  if (background) await page.locator('button').filter({ has: page.locator(`img[alt="${background}"]`) }).click();
  else await page.getByRole('button', { name: 'Auto Sesuai Produk', exact: true }).click();
}

async function waitForJob(page, jobId, timeoutMs = 12 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await page.evaluate(async (id) => { const response = await fetch(`/api/jobs?jobId=${encodeURIComponent(id)}`, { cache: 'no-store' }); return { status: response.status, data: await response.json() }; }, jobId);
    if (job.data.status === 'COMPLETED') return job.data;
    if (job.data.status === 'FAILED' || job.data.status === 'REJECTED') throw new Error(`Job ${jobId} ${job.data.status}: ${job.data.errorMessage || ''}`);
    await new Promise((done) => setTimeout(done, 10000));
  }
  throw new Error(`Timeout menunggu job ${jobId}`);
}

async function generate(page, spec) {
  await page.goto(`${base}/factory`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'AffiMatik Creator Studio' }).waitFor();
  const before = await wallet(page);
  await page.locator('label').filter({ hasText: 'Pilih atau Seret Gambar Produk' }).locator('input[type="file"]').setInputFiles(spec.product);
  await page.getByText('Identiti produk dikunci').waitFor();
  await page.locator('input[placeholder*="Serum Rawatan"]').fill(spec.name);
  await selectCustomization(page, spec);
  await page.locator('select').filter({ has: page.locator('option[value="auto"]') }).first().selectOption(spec.niche);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/jobs') && response.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: /Jana Video Sekarang/ }).click();
  const submitResponse = await responsePromise; const submit = await submitResponse.json();
  if (!submitResponse.ok()) throw new Error(`Submit ${spec.case}: ${JSON.stringify(submit)}`);
  const reserved = await wallet(page);
  const completed = await waitForJob(page, submit.jobId);
  const after = await wallet(page);
  const row = { case: spec.case, niche: spec.niche, product: basename(spec.product), avatar: spec.avatar || null, background: spec.background || null,
    jobId: submit.jobId, providerTaskId: submit.providerTaskId, before: before.wallet, reserved: reserved.wallet, after: after.wallet,
    videoUrl: completed.videoUrl || null, status: completed.status };
  evidence.jobs.push(row); writeFileSync(resolve(out, 'progress.json'), JSON.stringify(evidence, null, 2));
  return row;
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage(); await unlock(page); await login(page);
  await page.goto(`${base}/styles`, { waitUntil: 'networkidle' });
  const posterImages = page.locator('img[alt^="Poster gaya"]');
  await posterImages.first().waitFor();
  evidence.posters.desktopCount = await posterImages.count();
  evidence.posters.urls = {};
  for (const id of styleIds) {
    const poster = await page.request.get(`${base}/style-posters/${id}.webp`);
    const sample = await page.request.get(`${base}/api/style-samples/${id}`, { headers: { Range: 'bytes=0-1023' } });
    evidence.posters.urls[id] = { posterStatus: poster.status(), posterBytes: (await poster.body()).length, sampleStatus: sample.status(), sampleRange: sample.headers()['content-range'] || null };
  }
  const firstMedia = page.getByTestId('style-media-NX01');
  await firstMedia.hover();
  await firstMedia.locator('video').waitFor();
  evidence.posters.desktopHoverVideo = await firstMedia.locator('video').isVisible();
  await page.locator('h2').hover();
  evidence.posters.desktopReturnsToPoster = await firstMedia.locator('video').count() === 0;
  await firstMedia.getByRole('button', { name: /Preview video/ }).click();
  evidence.posters.desktopModal = await page.getByRole('dialog').isVisible();
  await page.screenshot({ path: resolve(out, 'desktop-style-preview.png'), fullPage: false });
  await page.getByRole('button', { name: 'Tutup preview' }).click();
  await loadLazyPosters(page);
  await page.screenshot({ path: resolve(out, 'desktop-style-posters.png'), fullPage: true });
  await page.goto(`${base}/factory`, { waitUntil: 'networkidle' });
  evidence.desktop = { quickVisible: await page.getByRole('button', { name: 'Quick Mode' }).isVisible(), customizeVisible: await page.getByRole('button', { name: 'Customize' }).isVisible(), generateVisible: await page.getByRole('button', { name: /Jana Video Sekarang/ }).isVisible() };
  await page.getByRole('button', { name: 'Customize' }).click();
  if (await page.getByText('Aina Synthetic QA', { exact: true }).count() === 0) {
    await uploadWithDialogs(page, page.locator('label').filter({ hasText: 'Upload Baru' }).locator('input[type="file"]'), resolve(input, 'synthetic-presenter-aina.png'), ['Aina Synthetic QA', true]);
  }
  await page.getByText('Aina Synthetic QA', { exact: true }).waitFor();
  if (await page.getByText('Dapur QA', { exact: true }).count() === 0) {
    await uploadWithDialogs(page, page.locator('label').filter({ hasText: 'Upload Latar Sendiri' }).locator('input[type="file"]'), resolve(input, 'kitchen-background.png'), ['Dapur QA']);
  }
  await page.getByText('Dapur QA', { exact: true }).waitFor();
  await loadLazyPosters(page);
  await page.screenshot({ path: resolve(out, 'desktop-customize.png'), fullPage: true });

  if (process.env.V7_SKIP_PROVIDER !== '1') {
    await generate(page, { case: 'A_PRODUCT_ONLY', product: resolve(input, 'beauty-seri-dewi.png'), name: 'Seri Dewi Facial Serum', niche: 'beauty' });
    await generate(page, { case: 'B_PRODUCT_AVATAR', product: resolve('output/release/journey-ui/health-omega3.png'), name: 'Omega 3 Reference', niche: 'wellness', avatar: 'Aina Synthetic QA' });
    await generate(page, { case: 'C_PRODUCT_BACKGROUND', product: resolve(input, 'kitchen-potonggo.png'), name: 'Potonggo Manual Chopper', niche: 'kitchen', background: 'Dapur QA' });
    await generate(page, { case: 'D_PRODUCT_AVATAR_BACKGROUND', product: resolve(input, 'automotive-roadgrip.png'), name: 'Roadgrip Phone Holder', niche: 'automotive', avatar: 'Aina Synthetic QA', background: 'Dapur QA' });
  }

  await page.goto(`${base}/factory`, { waitUntil: 'networkidle' }); await selectCustomization(page, { avatar: 'Aina Synthetic QA', background: 'Dapur QA' });
  if (await page.getByRole('button', { name: /Aina \+ Dapur QA/ }).count() === 0) {
    page.once('dialog', (dialog) => dialog.accept('Aina + Dapur QA'));
    await page.getByRole('button', { name: 'Simpan sebagai Preset' }).click();
    await page.getByText(/berjaya disimpan/).waitFor();
  }
  await page.goto(`${base}/presets`, { waitUntil: 'networkidle' });
  evidence.library.presetVisible = await page.getByText('Aina + Dapur QA', { exact: true }).isVisible();
  const originalPreset = page.locator('article').filter({ hasText: 'Aina + Dapur QA' }).first();
  page.once('dialog', (dialog) => dialog.accept('Aina + Dapur QA Copy'));
  await originalPreset.getByTitle('Duplikasi').click();
  await page.getByText('Aina + Dapur QA Copy', { exact: true }).waitFor();
  const copyPreset = page.locator('article').filter({ hasText: 'Aina + Dapur QA Copy' });
  page.once('dialog', (dialog) => dialog.accept('Aina + Dapur QA Edited'));
  await copyPreset.getByTitle('Edit nama').click();
  await page.getByText('Aina + Dapur QA Edited', { exact: true }).waitFor();
  const editedPreset = page.locator('article').filter({ hasText: 'Aina + Dapur QA Edited' });
  await editedPreset.getByTitle('Jadikan default').click();
  await page.getByText('Preset default ditetapkan.').waitFor();
  page.once('dialog', (dialog) => dialog.accept());
  await editedPreset.getByTitle('Padam').click();
  await page.getByText('Preset dipadam.').waitFor();
  await page.locator('article').filter({ hasText: 'Aina + Dapur QA' }).first().getByTitle('Jadikan default').click();
  await page.getByText('Preset default ditetapkan.').waitFor();
  evidence.library.presetCrud = true;
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' });
  evidence.library.products = await page.locator('img').count();
  await page.goto(`${base}/library`, { waitUntil: 'networkidle' });
  evidence.library.completedCards = await page.getByText('Selesai', { exact: false }).count();
  await page.screenshot({ path: resolve(out, 'desktop-video-library.png'), fullPage: true });

  const videosResult = await page.evaluate(async () => { const r = await fetch('/api/videos'); return { status: r.status, data: await r.json() }; });
  const ownVideos = videosResult.data.videos || [];
  evidence.library.completedCards = ownVideos.length;
  const generatedIds = new Set(evidence.jobs.map((job) => job.jobId));
  const mediaToVerify = evidence.jobs.length > 0
    ? ownVideos.filter((video) => generatedIds.has(video.jobId || video.job_id || video.id))
    : ownVideos.slice(0, 1);
  for (const item of mediaToVerify) {
    const id = item.id || item.jobId || item.job_id;
    const full = await page.request.get(`${base}/api/videos/${id}/stream`);
    const fullBody = await full.body();
    writeFileSync(resolve(out, `${evidence.jobs.find((job) => job.jobId === (item.jobId || item.job_id || item.id))?.case || id}.mp4`), fullBody);
    const range = await page.request.get(`${base}/api/videos/${id}/stream`, { headers: { Range: 'bytes=0-1023' } });
    evidence.library[id] = { fullStatus: full.status(), fullBytes: fullBody.length, rangeStatus: range.status(), contentRange: range.headers()['content-range'] || null };
  }
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobilePage = await mobile.newPage(); await unlock(mobilePage); await login(mobilePage);
  await mobilePage.goto(`${base}/styles`, { waitUntil: 'networkidle' });
  evidence.posters.mobileCount = await mobilePage.locator('img[alt^="Poster gaya"]').count();
  await mobilePage.getByTestId('style-media-NX01').getByRole('button', { name: /Preview video/ }).click();
  evidence.posters.mobileTapModal = await mobilePage.getByRole('dialog').isVisible();
  await mobilePage.screenshot({ path: resolve(out, 'mobile-style-preview.png'), fullPage: false });
  await mobilePage.getByRole('button', { name: 'Tutup preview' }).click();
  await loadLazyPosters(mobilePage);
  await mobilePage.screenshot({ path: resolve(out, 'mobile-style-posters.png'), fullPage: true });
  await mobilePage.goto(`${base}/factory`, { waitUntil: 'networkidle' });
  evidence.mobile = { quickVisible: await mobilePage.getByRole('button', { name: 'Quick Mode' }).isVisible(), customizeVisible: await mobilePage.getByRole('button', { name: 'Customize' }).isVisible(), stickyGenerateVisible: await mobilePage.getByRole('button', { name: 'Jana Video', exact: true }).isVisible() };
  await mobilePage.getByRole('button', { name: 'Customize' }).click(); await mobilePage.getByText('Aina Synthetic QA', { exact: true }).scrollIntoViewIfNeeded();
  evidence.mobile.defaultPresetApplied = await mobilePage.getByRole('button', { name: /Aina \+ Dapur QA/ }).count() > 0;
  await loadLazyPosters(mobilePage);
  await mobilePage.screenshot({ path: resolve(out, 'mobile-customize.png'), fullPage: true }); await mobile.close();
} catch (error) {
  evidence.errors.push(error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) });
  throw error;
} finally {
  evidence.finishedAt = new Date().toISOString(); writeFileSync(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2)); await browser.close();
}
console.log(JSON.stringify({ workspaceId, jobs: evidence.jobs.map((job) => ({ case: job.case, jobId: job.jobId, providerTaskId: job.providerTaskId, before: job.before, reserved: job.reserved, after: job.after })), desktop: evidence.desktop, mobile: evidence.mobile, library: evidence.library }, null, 2));
