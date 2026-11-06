import { AUTHORITATIVE_PLANS, PricingPlan } from './plans';
import { DurableStore, OrderRecord } from '@/lib/db/store';

export interface CheckoutRequest {
  workspaceId: string;
  userId: string;
  planId: string;
  paymentMethod?: 'fpx' | 'card' | 'qr' | 'manual_fpx';
  referralCode?: string;
  callbackUrl?: string;
}

export interface CheckoutResult {
  success: boolean;
  orderId: string;
  plan: PricingPlan;
  amountMyr: number;
  creditsGranted: number;
  paymentMethod: string;
  checkoutUrl?: string;
  manualPaymentDetails?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    referenceCode: string;
    instructions: string[];
  };
  error?: string;
}

/**
 * Creates an order and initiates checkout flow across automated or Malaysian manual payment rails.
 * Does not emit fabricated gateway URLs or unverified hardcoded bank accounts.
 */
export async function createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
  const plan = AUTHORITATIVE_PLANS.find((p) => p.id === req.planId);
  if (!plan) {
    throw new Error(`Pelan langganan "${req.planId}" tidak sah.`);
  }

  const orderId = crypto.randomUUID();
  const paymentMethod = req.paymentMethod || 'manual_fpx';

  // 1. Check if a genuine automated gateway is configured
  let checkoutUrl: string | undefined;
  // If an active gateway is integrated with real credentials, create real gateway session here.
  // Otherwise, fallback honestly to manual bank-transfer payments verified by administrator.

  // 2. Generate a stable, verifiable reference code for this order
  const referenceCode = `AFM-${orderId.substring(0, 8).toUpperCase()}`;

  // 3. Persist order record in database
  const order = await DurableStore.createOrder({
    id: orderId,
    workspaceId: req.workspaceId,
    userId: req.userId,
    planId: plan.id,
    amountMyr: plan.priceMyr,
    creditsGranted: plan.monthlyCredits,
    gatewayProvider: checkoutUrl ? 'gateway_redirect' : 'manual_fpx',
    gatewayReference: referenceCode,
    paymentMethod,
    referralCode: req.referralCode,
    metadata: {
      planName: plan.name,
      referenceCode,
      voiceVideos: plan.voiceVideoAllowance,
    },
  });

  // 4. Resolve bank details from environment or system settings (never hardcoded unverified accounts)
  const bankSettings = (await DurableStore.getSystemSettings('bank_transfer_details')) || {};
  const bankName = process.env.MANUAL_PAYMENT_BANK_NAME || bankSettings.bankName || 'Akaun Rasmi Pawarna / AffiMatik';
  const accountNumber = process.env.MANUAL_PAYMENT_ACCOUNT_NUMBER || bankSettings.accountNumber || 'Sila rujuk pentadbir akaun';
  const accountHolder = process.env.MANUAL_PAYMENT_ACCOUNT_HOLDER || bankSettings.accountHolder || 'Pengurusan Pawarna Media Resources';

  return {
    success: true,
    orderId: order.id,
    plan,
    amountMyr: plan.priceMyr,
    creditsGranted: plan.monthlyCredits,
    paymentMethod,
    checkoutUrl,
    manualPaymentDetails: {
      bankName,
      accountNumber,
      accountHolder,
      referenceCode,
      instructions: [
        `Lakukan pemindahan perbankan dalam talian / FPX berjumlah RM ${plan.priceMyr}.00`,
        `WAJIB masukkan Kod Rujukan "${referenceCode}" di ruangan Catatan / Recipient Reference.`,
        'Selepas pembayaran dibuat, kemukakan rujukan pesanan anda kepada pentadbir untuk pengesahan.',
        'Kredit akan dimasukkan serta-merta selepas bayaran disahkan diterima dalam akaun.',
      ],
    },
  };
}
