import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2];
const label = process.argv[3] || 'capture';
if (!baseUrl) throw new Error('Usage: node sales-v3-visual-qa.mjs <url> <label>');

const stagingKey = process.env.STAGING_GATE_SECRET;
const headers = stagingKey ? { 'x-affimatik-staging-key': stagingKey } : {};
const output = path.resolve('output/sales-page-v3');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

const viewports = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
];

const report = {};
for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: headers,
    locale: 'ms-MY',
  });
  const page = await context.newPage();
  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: path.join(output, `${label}-${viewport.name}.png`), fullPage: true });
  report[viewport.name] = await page.evaluate(() => {
    const launchLinks = [...document.querySelectorAll('a[href*="intent=launch_pack"]')];
    const videos = [...document.querySelectorAll('video')];
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
      sections: document.querySelectorAll('main > section').length,
      launchLinks: launchLinks.map(link => link.getAttribute('href')),
      styleLibraryHref: document.querySelector('a[href="/styles"]')?.getAttribute('href'),
      videoCount: videos.length,
      faqCount: document.querySelectorAll('details').length,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      overflow: document.body.scrollWidth > window.innerWidth + 1,
    };
  });
  report[viewport.name].status = response?.status();
  await context.close();
}

await browser.close();
await writeFile(path.join(output, `${label}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
