import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.V8_3_STAGING_BASE || 'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const gateKey = process.env.STAGING_GATE_SECRET;
const email = process.env.V8_QA_EMAIL;
const password = process.env.V8_QA_PASSWORD;
if (!gateKey || !email || !password) throw new Error('Staging gate and isolated QA account credentials are required.');
const output = resolve('output/provider-qa/v8-3-ui');
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const evidence = { checkedAt: new Date().toISOString(), base, desktop: {}, mobile: {} };

async function unlock(page) {
  await page.goto(`${base}/__stage_access`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="key"]').fill(gateKey);
  await Promise.all([page.waitForURL(`${base}/`), page.getByRole('button', { name: 'Enter' }).click()]);
}

async function inspect(viewport, name) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await unlock(page);
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([page.waitForURL(/\/dashboard/), page.getByRole('button', { name: 'Log Masuk' }).click()]);
  await page.goto(`${base}/factory`, { waitUntil: 'networkidle' });
  const quickPreset = page.getByText('Auto / Tanpa Preset', { exact: true });
  const scriptReview = page.getByRole('heading', { name: 'Semak Skrip & CTA' });
  const generate = page.getByRole('button', { name: /Jana Video Sekarang|Muat Naik Gambar Produk Dahulu/ }).first();
  await generate.scrollIntoViewIfNeeded();
  const box = await generate.boundingBox();
  const result = {
    url: page.url(),
    title: await page.title(),
    officialStyleCards: await page.locator('[data-testid^="style-media-"]').count(),
    quickPresetVisible: await quickPreset.isVisible(),
    scriptReviewVisible: await scriptReview.isVisible(),
    generateVisible: await generate.isVisible(),
    generateBox: box,
    viewport,
    pageErrors,
  };
  await page.screenshot({ path: resolve(output, `${name}-factory.png`), fullPage: true });
  await context.close();
  return result;
}

try {
  evidence.desktop = await inspect({ width: 1440, height: 900 }, 'desktop');
  evidence.mobile = await inspect({ width: 390, height: 844 }, 'mobile');
  writeFileSync(resolve(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.desktop.quickPresetVisible || !evidence.desktop.scriptReviewVisible || evidence.desktop.officialStyleCards !== 20) process.exitCode = 1;
  if (!evidence.mobile.generateVisible || evidence.mobile.officialStyleCards !== 20) process.exitCode = 1;
  if (evidence.desktop.pageErrors.length || evidence.mobile.pageErrors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
