import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const base = 'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const gate = process.env.STAGING_GATE_SECRET;
const service = process.env.STAGING_SERVICE_ROLE_KEY;
if (!gate || !service) throw new Error('STAGING_GATE_SECRET dan STAGING_SERVICE_ROLE_KEY diperlukan.');

const output = path.resolve('output/fomo-bonus-v1');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

async function offerVisitor() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const visitor = crypto.randomUUID();
    const response = await fetch(`${base}/api/fomo-offer`, {
      headers: { 'x-affimatik-staging-key': gate, cookie: `affimatik_visitor=${visitor}` },
    });
    const state = await response.json();
    if (state.enabled && state.cohort === 'OFFER') return { visitor, state };
  }
  throw new Error('Tidak memperoleh kohort OFFER selepas 20 cubaan.');
}

async function contextFor(visitor, viewport) {
  const context = await browser.newContext({
    viewport,
    locale: 'ms-MY',
    colorScheme: 'light',
    extraHTTPHeaders: { 'x-affimatik-staging-key': gate },
  });
  await context.addCookies([{ name: 'affimatik_visitor', value: visitor, url: base, httpOnly: true, sameSite: 'Lax' }]);
  return context;
}

async function captureActive(name, viewport) {
  const { visitor, state: initial } = await offerVisitor();
  const context = await contextFor(visitor, viewport);
  const page = await context.newPage();
  await page.goto(`${base}/#bonus-launch-pack`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const section = page.locator('#bonus-launch-pack');
  await section.waitFor({ state: 'visible', timeout: 30_000 });
  await section.screenshot({ path: path.join(output, `${name}-active.png`), animations: 'disabled' });
  const active = await section.evaluate((element) => ({
    text: element.textContent?.replace(/\s+/g, ' ').trim(),
    overflow: element.scrollWidth > element.clientWidth + 1,
  }));
  await context.close();
  return { visitor, initial, active };
}

const viewports = {
  mobile375: { width: 375, height: 812 },
  mobile390: { width: 390, height: 844 },
  mobile430: { width: 430, height: 932 },
  desktop1440: { width: 1440, height: 1000 },
};
const captures = {};
for (const [name, viewport] of Object.entries(viewports)) captures[name] = await captureActive(name, viewport);

const claimFixture = await offerVisitor();
const claimContext = await contextFor(claimFixture.visitor, viewports.mobile390);
const claimPage = await claimContext.newPage();
await claimPage.goto(`${base}/#bonus-launch-pack`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await claimPage.getByRole('button', { name: 'Claim 100 Kredit Bonus' }).click();
await claimPage.getByText('Bonus berjaya ditempah.', { exact: false }).waitFor({ state: 'visible', timeout: 30_000 });
await claimPage.locator('#bonus-launch-pack').screenshot({ path: path.join(output, 'mobile390-claimed.png'), animations: 'disabled' });
const firstClaim = await claimPage.request.post(`${base}/api/fomo-offer`, { data: { action: 'claim' } }).then(response => response.json());
const secondClaim = await claimPage.request.post(`${base}/api/fomo-offer`, { data: { action: 'claim' } }).then(response => response.json());
const help = await claimPage.request.post(`${base}/api/fomo-offer/assist`, {
  data: { whatsapp: '0195216867', privacyAccepted: true, marketingConsent: false },
}).then(response => response.json());
await claimContext.close();

const expiredFixture = await offerVisitor();
const expireResponse = await fetch(`https://bymorrozeokshzuzcdro.supabase.co/rest/v1/fomo_offer_assignments?visitor_id=eq.${expiredFixture.visitor}`, {
  method: 'PATCH',
  headers: {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ offer_expires_at: new Date(Date.now() - 60_000).toISOString() }),
});
if (!expireResponse.ok) throw new Error(`Gagal menyediakan fixture expired: ${expireResponse.status}`);
const expiredContext = await contextFor(expiredFixture.visitor, viewports.mobile390);
const expiredPage = await expiredContext.newPage();
await expiredPage.goto(`${base}/#bonus-launch-pack`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await expiredPage.getByText('Tempoh bonus untuk sesi ini telah tamat', { exact: false }).waitFor({ state: 'visible', timeout: 30_000 });
await expiredPage.locator('#bonus-launch-pack').screenshot({ path: path.join(output, 'mobile390-expired.png'), animations: 'disabled' });
const expiredState = await expiredPage.request.get(`${base}/api/fomo-offer`).then(response => response.json());
await expiredContext.close();

await browser.close();
const report = {
  capturedAt: new Date().toISOString(),
  worker: '931e7935-088f-4c87-b19c-ede4b21ef14c',
  captures: Object.fromEntries(Object.entries(captures).map(([name, value]) => [name, {
    cohort: value.initial.cohort,
    amountMyr: value.initial.amount_myr,
    baseCredits: value.initial.base_credits,
    bonusCredits: value.initial.bonus_credits,
    totalCredits: value.initial.total_credits,
    overflow: value.active.overflow,
  }])),
  claim: {
    idempotent: firstClaim.claim_id === secondClaim.claim_id,
    claimId: firstClaim.claim_id,
    status: firstClaim.status,
    paymentExpiresAt: firstClaim.payment_expires_at,
  },
  assistance: { success: help.success === true, emailStatus: help.emailStatus, marketingConsent: help.marketingConsent },
  expired: { cohort: expiredState.cohort, offerExpiresAt: expiredState.offer_expires_at, serverNow: expiredState.server_now },
};
await writeFile(path.join(output, 'visual-qa-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
