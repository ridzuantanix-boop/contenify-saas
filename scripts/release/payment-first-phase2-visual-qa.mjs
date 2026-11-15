import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const stagingKey = process.env.STAGING_GATE_SECRET;
if (!stagingKey) throw new Error('STAGING_GATE_SECRET diperlukan.');

const baseUrl = 'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const outputDir = path.resolve('output/payment-first-phase2-qa');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

async function inspectLanding(name, viewport) {
  const context = await browser.newContext({
    viewport,
    locale: 'ms-MY',
    extraHTTPHeaders: { 'x-affimatik-staging-key': stagingKey },
  });
  const page = await context.newPage();
  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.screenshot({ path: path.join(outputDir, `landing-${name}.png`), fullPage: true });
  const result = await page.evaluate(() => {
    const body = document.body.innerText;
    const launchCta = document.querySelector('a[href*="intent=launch_pack"]');
    return {
      title: document.title,
      heading: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
      launchHref: launchCta?.getAttribute('href'),
      softLaunch: body.includes('Akses Awal (Soft Launch)'),
      cleanMp4: body.includes('Clean MP4'),
      stylePills: [
        'Sembang Kawan Santai', 'Review Sambil Pegang', 'Recommend Spontan',
        'POV Masalah Harian', 'Unboxing Ringkas', 'Demo Guna Produk',
        'Hard Sell Beg Kuning', 'Gaya Mak-Mak / Santai Rumah',
      ].filter((label) => body.includes(label)).length,
      comparison: body.includes('Buat Sendiri') && body.includes('45 minit') && body.includes('RM1.27 sevideo'),
      paymentFirstCopy: body.includes('Daftar akaun dan terus bayar melalui QR'),
      finalSteps: body.includes('Terus Bayar RM19 via QR & Upload Resit'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  await context.close();
  return { status: response?.status(), viewport, ...result };
}

const mobile = await inspectLanding('mobile-390', { width: 390, height: 844 });
const desktop = await inspectLanding('desktop-1440', { width: 1440, height: 1000 });

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'ms-MY',
  extraHTTPHeaders: { 'x-affimatik-staging-key': stagingKey },
});
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.locator('a[href*="intent=launch_pack"]').first().click();
await page.waitForURL('**/register?**', { timeout: 30_000 });
await page.getByRole('heading', { name: 'Cipta Akaun AffiMatik' }).waitFor({ state: 'visible', timeout: 30_000 });
await page.screenshot({ path: path.join(outputDir, 'register-mobile-390.png'), fullPage: true });
const register = await page.evaluate(() => ({
  url: location.href,
  heading: document.querySelector('h1,h2')?.textContent?.replace(/\s+/g, ' ').trim(),
  emailField: Boolean(document.querySelector('input[type="email"]')),
  passwordField: Boolean(document.querySelector('input[type="password"]')),
  phoneField: Boolean(document.querySelector('input[type="tel"]')),
  submitText: document.querySelector('button[type="submit"]')?.textContent?.replace(/\s+/g, ' ').trim(),
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
}));
await context.close();
await browser.close();

const report = { mobile, desktop, register };
await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
