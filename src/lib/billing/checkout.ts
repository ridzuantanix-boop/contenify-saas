import { AUTHORITATIVE_PLANS, PricingPlan } from './plans';
import { DurableStore, OrderRecord } from '@/lib/db/store';
import { publicQrConfig } from './qr-checkout';

export interface CheckoutRequest {
  workspaceId: string;
  userId: string;
  planId: string;
  paymentMethod?: 'qr';
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
  qrCheckout?: {
    merchantName: string;
    bankName: string;
    recipientInfo: string;
    qrImageUrl: string;
    qrDownloadUrl: string;
    referenceCode: string;
    instructions: string;
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
  const paymentMethod = 'qr';
  const config = await publicQrConfig();
  if (!config.enabled) throw new Error('QR_CHECKOUT_NOT_CONFIGURED');

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
    gatewayProvider: 'qr_manual',
    gatewayReference: referenceCode,
    paymentMethod,
    referralCode: req.referralCode,
    metadata: {
      planName: plan.name,
      referenceCode,
      voiceVideos: plan.voiceVideoAllowance,
      paymentAuthority: 'CUSTOMER_RECEIPT_UNVERIFIED',
      renewalType: 'manual_30_day',
    },
  });

  return {
    success: true,
    orderId: order.id,
    plan,
    amountMyr: plan.priceMyr,
    creditsGranted: plan.monthlyCredits,
    paymentMethod,
    qrCheckout: {
      merchantName: config.merchantName,
      bankName: config.bankName,
      recipientInfo: config.recipientInfo,
      qrImageUrl: config.qrImageUrl,
      qrDownloadUrl: config.qrDownloadUrl,
      referenceCode,
      instructions: config.instructions,
    },
  };
}
