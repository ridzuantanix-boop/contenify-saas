export const AFFILIATE_COMMISSION_RATE = 20;
export const AFFILIATE_HOLD_DAYS = 14;
export const AFFILIATE_MINIMUM_PAYOUT_MYR = 50;

export const QUALIFYING_SUBSCRIPTION_PLAN_IDS = new Set([
  'plan_starter',
  'plan_pro',
  'plan_agency',
]);

const RESERVED_AFFILIATE_USERNAMES = new Set([
  'admin', 'administrator', 'api', 'affimatik', 'billing', 'checkout',
  'help', 'official', 'owner', 'partner', 'payment', 'payments', 'privacy',
  'root', 'security', 'staff', 'support', 'system', 'terms', 'www',
]);

export type AffiliateUsernameValidation =
  | { valid: true; normalized: string }
  | { valid: false; error: string };

export function validateAffiliateUsername(value: unknown): AffiliateUsernameValidation {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    return { valid: false, error: 'Username mesti 3–20 aksara dan hanya menggunakan huruf kecil, nombor atau garis bawah.' };
  }
  if (RESERVED_AFFILIATE_USERNAMES.has(normalized)
    || normalized.startsWith('affimatik_')
    || normalized.endsWith('_official')) {
    return { valid: false, error: 'Username ini dikhaskan atau boleh mengelirukan pengguna.' };
  }
  return { valid: true, normalized };
}

export type QualifyingOrderLike = {
  planId: string;
  status: string;
  paymentState?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function isQualifyingSettledSubscription(order: QualifyingOrderLike): boolean {
  if (!QUALIFYING_SUBSCRIPTION_PLAN_IDS.has(order.planId)) return false;
  if (order.status !== 'PAID') return false;
  if (!['PAYMENT_CONFIRMED', 'BANK_PAYMENT_VERIFIED'].includes(order.paymentState || '')) return false;
  const metadata = order.metadata || {};
  return metadata.qa_simulation !== true
    && metadata.full_refund !== true
    && metadata.chargeback !== true
    && metadata.fraudulent_payment !== true;
}

export function affiliateStatusKeepsLifetimeAccess(status: string): boolean {
  return status === 'APPROVED';
}
