import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = 'https://affimatik.online';
const output = path.resolve('output/fomo-bonus-v1/production');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

let result;
for (let attempt = 0; attempt < 20; attempt += 1) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ms-MY' });
  const page = await context.newPage();
  await page.goto(`${base}/#bonus-launch-pack`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const section = page.locator('#bonus-launch-pack');
  const visible = await section.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
  if (!visible) { await context.close(); continue; }
  await section.screenshot({ path: path.join(output, 'mobile390-active.png'), animations: 'disabled' });
  result = await page.evaluate(() => ({
    title: document.title,
    timer: document.querySelector('[role="timer"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    claimButton: Array.from(document.querySelectorAll('button')).some(button => button.textContent?.includes('Claim 100 Kredit Bonus')),
    total250Visible: document.querySelector('#bonus-launch-pack')?.textContent?.includes('250') === true,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  await context.close();
  break;
}

await browser.close();
if (!result) throw new Error('Kohort OFFER production tidak muncul selepas 20 sesi bersih.');
await writeFile(path.join(output, 'smoke-report.json'), JSON.stringify({ capturedAt: new Date().toISOString(), ...result }, null, 2) + '\n');
console.log(JSON.stringify(result));
