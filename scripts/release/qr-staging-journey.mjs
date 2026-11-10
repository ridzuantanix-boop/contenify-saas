import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = 'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const gate = process.env.STAGING_GATE_SECRET;
const adminKey = process.env.ADMIN_ACCESS_KEY;
const email = process.env.QR_QA_EMAIL;
const password = process.env.QR_QA_PASSWORD;
if (![gate, adminKey, email, password].every(Boolean)) throw new Error('Rahsia QR staging QA tidak lengkap.');

const out = resolve('output/release/qr-staging');
mkdirSync(out, { recursive: true });
const qrBytes = readFileSync(resolve('output/release/staging-fixtures/synthetic-payment-qr.png'));
// A valid PNG may contain trailing private data; append a run nonce so repeat
// staging rehearsals do not collide with an earlier immutable receipt hash.
const receiptBytes = Buffer.concat([
  readFileSync(resolve('output/release/staging-fixtures/synthetic-receipt.png')),
  Buffer.from(`\nAFFIMATIK-SYNTHETIC-RUN:${new Date().toISOString()}`),
]);
const gateHeaders = { 'x-affimatik-staging-key': gate };

async function json(path, init = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, { ...init, headers: { ...gateHeaders, ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (response.status !== expected) throw new Error(`${path} HTTP ${response.status}: ${JSON.stringify(data)}`);
  return { response, data };
}

const configForm = new FormData();
for (const [key, value] of Object.entries({
  enabled: 'true', autoFulfillEnabled: 'true', recipientConfirmed: 'true',
  merchantName: 'AFFIMATIK STAGING — SIMULATED', bankName: 'Synthetic DuitNow',
  recipientInfo: 'BUKAN PENERIMA BANK SEBENAR',
  instructions: 'UJIAN STAGING SAHAJA. Jangan buat pembayaran sebenar.',
  provisionalExposureCapMyr: '300', maxAutoOrderMyr: '129',
})) configForm.set(key, value);
configForm.set('qrImage', new File([qrBytes], 'synthetic-payment-qr.png', { type: 'image/png' }));
await json('/api/admin/billing-settings', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: configForm });

const login = await json('/api/auth/session', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
});
const cookie = login.response.headers.get('set-cookie')?.match(/affimatik_session=([^;]+)/)?.[1];
if (!cookie) throw new Error('Cookie sesi staging tidak diterima.');
const authHeaders = { cookie: `affimatik_session=${cookie}` };

const before = (await json('/api/billing', { headers: authHeaders })).data;
const checkout = (await json('/api/billing/checkout', {
  method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'plan_starter', paymentMethod: 'qr' }),
})).data;
if (checkout.amountMyr !== 49 || checkout.creditsGranted !== 100) throw new Error('Jumlah pelan Starter tidak tepat.');

const qrDownload = await fetch(`${base}/api/billing/qr-image?download=1`, { headers: { ...gateHeaders, ...authHeaders } });
if (!qrDownload.ok || !(qrDownload.headers.get('content-type') || '').startsWith('image/')) throw new Error('Muat turun QR gagal.');

function receiptForm(orderId) {
  const form = new FormData();
  form.set('orderId', orderId);
  form.set('receipt', new File([receiptBytes], 'synthetic-receipt.png', { type: 'image/png' }));
  return form;
}
const submitted = (await json('/api/billing/qr-receipt', { method: 'POST', headers: authHeaders, body: receiptForm(checkout.orderId) })).data;
if (!submitted.provisionalGranted || submitted.creditsGranted !== 100) throw new Error(`Kredit provisional gagal: ${JSON.stringify(submitted)}`);
const afterGrant = (await json('/api/billing', { headers: authHeaders })).data;
if (afterGrant.balance !== before.balance + 100) throw new Error(`Wallet tidak tepat: ${before.balance} -> ${afterGrant.balance}`);

const replay = (await json('/api/billing/qr-receipt', { method: 'POST', headers: authHeaders, body: receiptForm(checkout.orderId) })).data;
const afterReplay = (await json('/api/billing', { headers: authHeaders })).data;
if (!replay.idempotentReplay || afterReplay.balance !== afterGrant.balance) throw new Error('Replay order menggandakan kredit.');

const second = (await json('/api/billing/checkout', {
  method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'plan_starter', paymentMethod: 'qr' }),
})).data;
const receiptReplay = await json('/api/billing/qr-receipt', { method: 'POST', headers: authHeaders, body: receiptForm(second.orderId) }, 409);
if (receiptReplay.data.code !== 'RECEIPT_ALREADY_USED') throw new Error('Hash resit tidak disekat merentas order.');

const rejected = (await json('/api/admin/operations', {
  method: 'POST', headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'reject_qr_provisional', orderId: checkout.orderId, reason: 'Synthetic staging receipt cleanup' }),
})).data;
const afterCleanup = (await json('/api/billing', { headers: authHeaders })).data;
if (afterCleanup.balance !== before.balance || rejected.credit_debt !== 0) throw new Error('Cleanup test tidak memulihkan wallet asal.');

async function setAutoFulfill(value) {
  const form = new FormData();
  for (const [key, item] of Object.entries({
    enabled: 'true', autoFulfillEnabled: String(value), recipientConfirmed: 'true',
    merchantName: 'AFFIMATIK STAGING — SIMULATED', bankName: 'Synthetic DuitNow',
    recipientInfo: 'BUKAN PENERIMA BANK SEBENAR', instructions: 'UJIAN STAGING SAHAJA. Jangan buat pembayaran sebenar.',
    provisionalExposureCapMyr: '300', maxAutoOrderMyr: '129',
  })) form.set(key, item);
  return (await json('/api/admin/billing-settings', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: form })).data;
}
const paused = await setAutoFulfill(false);
if (paused.config?.autoFulfillEnabled !== false) throw new Error('Suis pause auto-fulfillment gagal.');
const resumed = await setAutoFulfill(true);
if (resumed.config?.autoFulfillEnabled !== true) throw new Error('Suis resume auto-fulfillment gagal.');

const evidence = {
  createdAt: new Date().toISOString(), synthetic: true, worker: base,
  account: email, workspaceId: login.data.user?.workspaceId,
  orderId: checkout.orderId, replayOrderId: second.orderId,
  plan: { id: checkout.plan?.id, amountMyr: checkout.amountMyr, credits: checkout.creditsGranted },
  wallet: { before: before.balance, afterGrant: afterGrant.balance, afterReplay: afterReplay.balance, afterCleanup: afterCleanup.balance },
  paymentState: submitted.paymentState, receiptReplayCode: receiptReplay.data.code,
  qrDownload: { status: qrDownload.status, contentType: qrDownload.headers.get('content-type') },
  cleanup: rejected,
  adminPauseResume: true,
};
writeFileSync(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
process.exit(0);
