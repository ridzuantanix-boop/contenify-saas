import { DurableStore, OrderRecord } from '@/lib/db/store';
import { signPrivateAsset } from '@/lib/storage/supabase-assets';

export const QR_CONFIG_KEY = 'qr_checkout_config';
// Keep this below the Cloudflare request-body ceiling while allowing modern
// phone photos (especially iPhone HEIC) without asking customers to resize.
export const MAX_PAYMENT_EVIDENCE_BYTES = 25 * 1024 * 1024;

export type QrPaymentState = 'PAYMENT_EVIDENCE_SUBMITTED' | 'PAYMENT_UNVERIFIED' | 'CREDITS_PROVISIONALLY_GRANTED' | 'BANK_PAYMENT_VERIFIED' | 'PROVISIONALLY_ACTIVE' | 'PAYMENT_CONFIRMED' | 'PAYMENT_REJECTED';

export interface QrCheckoutConfig {
  enabled: boolean;
  autoFulfillEnabled: boolean;
  merchantName: string;
  bankName: string;
  recipientInfo: string;
  instructions: string;
  qrObjectKey: string;
  qrSha256: string;
  recipientConfirmed: boolean;
  provisionalExposureCapMyr: number;
  maxAutoOrderMyr: number;
  instantFullAccessEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_QR_CONFIG: QrCheckoutConfig = {
  enabled: false,
  autoFulfillEnabled: false,
  merchantName: '',
  bankName: '',
  recipientInfo: '',
  instructions: 'Imbas QR menggunakan aplikasi bank anda. Pastikan jumlah dan rujukan pesanan tepat sebelum menghantar bukti bayaran.',
  qrObjectKey: '',
  qrSha256: '',
  recipientConfirmed: false,
  provisionalExposureCapMyr: 300,
  maxAutoOrderMyr: 129,
  instantFullAccessEnabled: false,
};

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function normalizeQrConfig(value: unknown): QrCheckoutConfig {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const cap = Number(raw.provisionalExposureCapMyr);
  const maxOrder = Number(raw.maxAutoOrderMyr);
  return {
    enabled: raw.enabled === true,
    autoFulfillEnabled: raw.autoFulfillEnabled === true,
    merchantName: cleanText(raw.merchantName, 160),
    bankName: cleanText(raw.bankName, 120),
    recipientInfo: cleanText(raw.recipientInfo, 200),
    instructions: cleanText(raw.instructions, 1000) || DEFAULT_QR_CONFIG.instructions,
    qrObjectKey: cleanText(raw.qrObjectKey, 500),
    qrSha256: cleanText(raw.qrSha256, 64),
    recipientConfirmed: raw.recipientConfirmed === true,
    provisionalExposureCapMyr: Number.isFinite(cap) && cap >= 49 && cap <= 5000 ? cap : DEFAULT_QR_CONFIG.provisionalExposureCapMyr,
    maxAutoOrderMyr: Number.isFinite(maxOrder) && [49,129,399].includes(maxOrder) ? maxOrder : DEFAULT_QR_CONFIG.maxAutoOrderMyr,
    instantFullAccessEnabled: raw.instantFullAccessEnabled === true,
    updatedAt: cleanText(raw.updatedAt, 40) || undefined,
    updatedBy: cleanText(raw.updatedBy, 255) || undefined,
  };
}

export async function getQrConfig(): Promise<QrCheckoutConfig> {
  return normalizeQrConfig(await DurableStore.getSystemSettings(QR_CONFIG_KEY));
}

export async function publicQrConfig() {
  const config = await getQrConfig();
  const ready = config.enabled && config.recipientConfirmed && Boolean(config.qrObjectKey && config.merchantName && config.recipientInfo);
  return {
    enabled: ready,
    autoFulfillEnabled: ready && config.autoFulfillEnabled,
    instantFullAccessEnabled: ready && config.autoFulfillEnabled && config.instantFullAccessEnabled,
    merchantName: ready ? config.merchantName : '',
    bankName: ready ? config.bankName : '',
    recipientInfo: ready ? config.recipientInfo : '',
    instructions: ready ? config.instructions : '',
    qrImageUrl: ready ? (process.env.VITEST ? '/api/billing/qr-image' : await signPrivateAsset(config.qrObjectKey, 900)) : '',
    qrDownloadUrl: ready ? '/api/billing/qr-image?download=1' : '',
    maxAutoOrderMyr: config.maxAutoOrderMyr,
  };
}

export function inspectEvidence(bytes: ArrayBuffer, _declaredType: string): { mimeType: string; extension: string } {
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_PAYMENT_EVIDENCE_BYTES) throw new Error('Saiz bukti bayaran mestilah antara 8 bait hingga 25 MB.');
  const head = new Uint8Array(bytes.slice(0, 32));
  const decoder = new TextDecoder();
  const ascii = (start: number, end: number) => decoder.decode(head.slice(start, end));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if ([137,80,78,71,13,10,26,10].every((value, index) => head[index] === value)) return { mimeType: 'image/png', extension: 'png' };
  if (ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP') return { mimeType: 'image/webp', extension: 'webp' };
  if (ascii(0,5) === '%PDF-') return { mimeType: 'application/pdf', extension: 'pdf' };
  if (ascii(0,6) === 'GIF87a' || ascii(0,6) === 'GIF89a') return { mimeType: 'image/gif', extension: 'gif' };
  if (ascii(0,2) === 'BM') return { mimeType: 'image/bmp', extension: 'bmp' };
  if ((ascii(0,2) === 'II' && head[2] === 42 && head[3] === 0) || (ascii(0,2) === 'MM' && head[2] === 0 && head[3] === 42)) return { mimeType: 'image/tiff', extension: 'tiff' };
  if (ascii(4,8) === 'ftyp') {
    const brand = ascii(8,12).toLowerCase();
    if (['heic','heix','hevc','hevx'].includes(brand)) return { mimeType: 'image/heic', extension: 'heic' };
    if (['mif1','msf1','heim','heis'].includes(brand)) return { mimeType: 'image/heif', extension: 'heif' };
  }
  throw new Error('Bukti bayaran mesti fail gambar sebenar (termasuk HEIC/HEIF) atau PDF.');
}

export async function sha256Hex(bytes: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
}

function database() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Pangkalan data tidak tersedia.');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { base: process.env.SUPABASE_URL.replace(/\/$/, ''), headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

export async function qrRpc(name: 'create_qr_order_atomic' | 'provision_qr_order_atomic' | 'verify_qr_order_payment_atomic' | 'reject_qr_provisional_order_atomic' | 'reactivate_workspace_payment_atomic', body: Record<string, unknown>) {
  const { base, headers } = database();
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`QR RPC ${name} HTTP ${response.status}`);
  return result;
}

export async function createQrOrderAtomic(input:{workspaceId:string;userId:string;orderId:string;planId:string;referralCode?:string}){
  return qrRpc('create_qr_order_atomic',{p_workspace_id:input.workspaceId,p_user_id:input.userId,p_order_id:input.orderId,p_plan_id:input.planId,p_referral_code:input.referralCode||null});
}

export async function listQrOrders(workspaceId: string, limit = 30): Promise<Array<OrderRecord & { paymentState: QrPaymentState; evidenceSubmittedAt?: string; provisionalGrantedAt?: string; bankVerifiedAt?: string }>> {
  const { base, headers } = database();
  const response = await fetch(`${base}/rest/v1/orders?workspace_id=eq.${encodeURIComponent(workspaceId)}&gateway_provider=eq.qr_manual&select=*&order=created_at.desc&limit=${Math.min(100, limit)}`, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error('Sejarah pesanan QR tidak tersedia.');
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows.map(row => ({
    id: String(row.id), workspaceId: String(row.workspace_id), userId: String(row.user_id), planId: String(row.plan_id),
    amountMyr: Number(row.amount_myr), creditsGranted: Number(row.credits_granted), status: String(row.status) as OrderRecord['status'],
    gatewayProvider: String(row.gateway_provider), gatewayReference: row.gateway_reference ? String(row.gateway_reference) : undefined,
    paymentMethod: row.payment_method ? String(row.payment_method) : undefined, referralCode: row.referral_code ? String(row.referral_code) : undefined,
    paidAt: row.paid_at ? String(row.paid_at) : undefined, createdAt: String(row.created_at), metadata: row.metadata as Record<string, unknown>,
    paymentState: String(row.payment_state || 'PAYMENT_UNVERIFIED') as QrPaymentState,
    evidenceSubmittedAt: row.evidence_submitted_at ? String(row.evidence_submitted_at) : undefined,
    provisionalGrantedAt: row.provisional_granted_at ? String(row.provisional_granted_at) : undefined,
    bankVerifiedAt: row.bank_verified_at ? String(row.bank_verified_at) : undefined,
  }));
}

export async function enforceCheckoutRateLimit(userId: string) {
  // The isolated Vitest store has no PostgREST endpoint. Production always
  // uses the persistent order-count limiter below.
  if (process.env.VITEST && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) return;
  const { base, headers } = database();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const response = await fetch(`${base}/rest/v1/orders?user_id=eq.${encodeURIComponent(userId)}&gateway_provider=eq.qr_manual&created_at=gte.${encodeURIComponent(since)}&select=id&limit=6`, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error('Had checkout tidak dapat disemak.');
  const rows = await response.json() as unknown[];
  if (rows.length >= 5) throw new Error('CHECKOUT_RATE_LIMIT');
}
