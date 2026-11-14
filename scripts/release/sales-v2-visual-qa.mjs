import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const stagingKey = process.env.STAGING_GATE_SECRET;
if (!stagingKey) throw new Error('STAGING_GATE_SECRET diperlukan.');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
const root = path.resolve('output/sales-v2-audit');
await mkdir(root, { recursive: true });
const viewports = [
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
];

async function inspect(url, viewport, headers = {}, screenshotName) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: headers, locale: 'ms-MY' });
  const page = await context.newPage();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: path.join(root, screenshotName), fullPage: true });
  const result = await page.evaluate(() => {
    const launch = document.querySelector('a[href*="intent=launch_pack"]');
    const videos = [...document.querySelectorAll('video')];
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
      sections: document.querySelectorAll('main > section').length,
      launchHref: launch?.getAttribute('href'),
      videoCount: videos.length,
      faqCount: document.querySelectorAll('details').length,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      overflow: document.body.scrollWidth > window.innerWidth + 1,
    };
  });
  await context.close();
  return { status: response?.status(), ...result };
}

const report = { before: {}, after: {} };
report.before.mobile = await inspect('https://affimatik.online', viewports[1], {}, 'before-mobile-390.png');
report.before.desktop = await inspect('https://affimatik.online', viewports[4], {}, 'before-desktop.png');
for (const viewport of viewports) {
  report.after[viewport.name] = await inspect(
    'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev',
    viewport,
    { 'x-affimatik-staging-key': stagingKey },
    `after-${viewport.name}.png`,
  );
}

const context = await browser.newContext({ viewport: viewports[1], extraHTTPHeaders: { 'x-affimatik-staging-key': stagingKey } });
const page = await context.newPage();
await page.goto('https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2_000);
await page.locator('a[href*="intent=launch_pack"]').first().click();
await page.waitForLoadState('domcontentloaded');
report.funnel = {
  url: page.url(),
  heading: await page.locator('h2').first().textContent(),
  launchCopyVisible: await page.getByText('Launch Pack 15 video pada RM19', { exact: false }).isVisible().catch(() => false),
};
await page.screenshot({ path: path.join(root, 'register-launch-intent-390.png'), fullPage: true });
await context.close();
await browser.close();
await writeFile(path.join(root, 'visual-qa.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
