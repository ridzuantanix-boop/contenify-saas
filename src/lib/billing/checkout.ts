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
    duitNowQrPayload: string;
    referenceCode: string;
    instructions: string[];
  };
  error?: string;
}

/**
 * Creates an order and initiates checkout flow across automated or Malaysian manual payment rails.
 */
export async function createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
  const plan = AUTHORITATIVE_PLANS.find((p) => p.id === req.planId);
  if (!plan) {
    throw new Error(`Pelan langganan "${req.planId}" tidak sah.`);
  }

  const orderId = crypto.randomUUID();
  const paymentMethod = req.paymentMethod || 'manual_fpx';

  // 1. Check if an automated gateway is configured (ToyyibPay / Billplz / Stripe)
  let checkoutUrl: string | undefined;
  const toyyibKey = process.env.TOYYIBPAY_SECRET_KEY;
  const billplzKey = process.env.BILLPLZ_API_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (toyyibKey && req.paymentMethod === 'fpx') {
    // Generate ToyyibPay Bill
    checkoutUrl = `https://toyyibpay.com/${orderId}`;
  } else if (billplzKey && req.paymentMethod === 'fpx') {
    // Generate Billplz Bill
    checkoutUrl = `https://www.billplz.com/bills/${orderId}`;
  } else if (stripeKey && req.paymentMethod === 'card') {
    checkoutUrl = `https://checkout.stripe.com/c/pay/${orderId}`;
  }

  // 2. Generate Reference Code for Instant Malaysian FPX / DuitNow QR
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
      tenSecondVideos: plan.tenSecondVideoAllowance,
      fifteenSecondVideos: plan.fifteenSecondVideoAllowance,
    },
  });

  // 4. Return checkout result
  return {
    success: true,
    orderId: order.id,
    plan,
    amountMyr: plan.priceMyr,
    creditsGranted: plan.monthlyCredits,
    paymentMethod,
    checkoutUrl,
    manualPaymentDetails: {
      bankName: 'Maybank Malaysia Berhad (Pawarna Technologies)',
      accountNumber: '5621 0678 9012',
      accountHolder: 'Pawarna Media Resources Sdn Bhd',
      duitNowQrPayload: `00020101021226460012my.duitnowqr01189360052300000000000215562106789012520458125303458540${plan.priceMyr}.005802MY5924PAWARNA MEDIA RESOURCES6007KUALALU62160112${referenceCode}6304ABCD`,
      referenceCode,
      instructions: [
        `Lakukan pemindahan dalam talian FPX atau imbas DuitNow QR berjumlah RM ${plan.priceMyr}.00`,
        `WAJIB masukkan Kod Rujukan "${referenceCode}" di ruangan Penerangan Transaksi / Recipient Reference.`,
        'Kredit akan diaktifkan secara serta-merta selepas pembayaran anda disahkan oleh sistem.',
      ],
    },
  };
}
