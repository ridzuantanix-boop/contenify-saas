import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = 'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const gate = process.env.STAGING_GATE_SECRET;
const adminKey = process.env.ADMIN_ACCESS_KEY;
const email = process.env.QR_QA_EMAIL;
const password = process.env.QR_QA_PASSWORD;
if (![gate, adminKey, email, password].every(Boolean)) throw new Error('Rahsia checkout staging QA tidak lengkap.');

const out = resolve('output/release/p0-launch-checkout');
mkdirSync(out, { recursive: true });
const qrBytes = readFileSync(resolve('output/release/staging-fixtures/synthetic-payment-qr.png'));
const receiptBytes = Buffer.concat([
  readFileSync(resolve('output/release/staging-fixtures/synthetic-receipt.png')),
  Buffer.from(`\nAFFIMATIK-P0-CHECKOUT:${new Date().toISOString()}`),
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
  enabled: 'true', autoFulfillEnabled: 'true', instantFullAccessEnabled: 'true', recipientConfirmed: 'true',
  merchantName: 'AFFIMATIK STAGING — SIMULATED', bankName: 'Synthetic DuitNow',
  recipientInfo: 'BUKAN PENERIMA BANK SEBENAR', instructions: 'UJIAN STAGING SAHAJA. Jangan buat pembayaran sebenar.',
  provisionalExposureCapMyr: '399', maxAutoOrderMyr: '399',
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
if (!before.publicCheckoutEnabled) throw new Error('Checkout staging masih tidak aktif.');
const checkout = (await json('/api/billing/checkout', {
  method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'launch_pack', paymentMethod: 'qr' }),
})).data;
if (checkout.amountMyr !== 19 || checkout.creditsGranted !== 150) throw new Error('Kontrak Launch Pack tidak tepat.');

const receiptForm = () => {
  const form = new FormData();
  form.set('orderId', checkout.orderId);
  form.set('receipt', new File([receiptBytes], 'synthetic-receipt.png', { type: 'image/png' }));
  return form;
};
const submitted = (await json('/api/billing/qr-receipt', { method: 'POST', headers: authHeaders, body: receiptForm() })).data;
const afterGrant = (await json('/api/billing', { headers: authHeaders })).data;
if (!submitted.provisionalGranted || afterGrant.balance !== before.balance + 150) throw new Error('Kredit provisional Launch Pack tidak tepat.');

const replay = (await json('/api/billing/qr-receipt', { method: 'POST', headers: authHeaders, body: receiptForm() })).data;
const afterReplay = (await json('/api/billing', { headers: authHeaders })).data;
if (!replay.idempotentReplay || afterReplay.balance !== afterGrant.balance) throw new Error('Penghantaran semula menggandakan kredit.');

const rejected = (await json('/api/admin/operations', {
  method: 'POST', headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'reject_qr_provisional', orderId: checkout.orderId, reason: 'Synthetic P0 checkout staging cleanup' }),
})).data;
const afterReject = (await json('/api/dashboard', { headers: authHeaders })).data;
if (afterReject.paymentControl?.paymentHold !== true) throw new Error('Penolakan tidak mengaktifkan payment hold.');
if (afterReject.wallet?.balance !== afterGrant.balance) throw new Error('Penolakan telah memadam baki, bertentangan dengan polisi freeze-only.');
const workspaceId = login.data.user?.workspaceId;
const reactivated = (await json('/api/admin/operations', {
  method: 'POST', headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'reactivate_payment_hold', workspaceId, reason: 'Synthetic P0 checkout QA completed' }),
})).data;
const finalState = (await json('/api/billing', { headers: authHeaders })).data;
const finalDashboard = (await json('/api/dashboard', { headers: authHeaders })).data;
if (finalDashboard.paymentControl?.paymentHold !== false) throw new Error('Reaktivasi tidak melepaskan payment hold.');
if (finalState.balance !== afterGrant.balance) throw new Error('Reaktivasi mengubah ledger kredit yang perlu dikekalkan.');

const evidence = {
  createdAt: new Date().toISOString(), synthetic: true, worker: base, workspaceId,
  orderId: checkout.orderId, amountMyr: checkout.amountMyr, credits: checkout.creditsGranted,
  checkoutEnabled: before.publicCheckoutEnabled,
  wallet: { before: before.balance, afterGrant: afterGrant.balance, afterReplay: afterReplay.balance, afterReject: afterReject.wallet?.balance, final: finalState.balance },
  paymentState: submitted.paymentState, idempotentReplay: replay.idempotentReplay === true,
  rejected: rejected.success === true, holdAfterReject: afterReject.paymentControl?.paymentHold === true,
  reactivated: reactivated.success === true, holdAfterReactivate: finalDashboard.paymentControl?.paymentHold === true,
};
writeFileSync(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
