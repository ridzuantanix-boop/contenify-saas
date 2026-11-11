import { AUTHORITATIVE_PLANS, LAUNCH_PACK, LaunchPackage, PricingPlan, TOP_UP_PACKAGES, TopUpPackage } from './plans';
import { DurableStore, OrderRecord } from '@/lib/db/store';
import { createQrOrderAtomic, publicQrConfig } from './qr-checkout';

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
  plan: PricingPlan | TopUpPackage | LaunchPackage;
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
  const subscriptionPlan = AUTHORITATIVE_PLANS.find((p) => p.id === req.planId);
  const topUp = TOP_UP_PACKAGES.find((p) => p.id === req.planId);
  const launchPack = req.planId === LAUNCH_PACK.id ? LAUNCH_PACK : undefined;
  const plan = subscriptionPlan || topUp || launchPack;
  if (!plan) {
    throw new Error(`Pelan langganan "${req.planId}" tidak sah.`);
  }
  if (topUp) {
    const subscription = await DurableStore.getSubscription(req.workspaceId);
    if (!subscription || subscription.status !== 'active' || new Date(subscription.currentPeriodEnd).getTime() <= Date.now()) {
      throw new Error('TOPUP_REQUIRES_ACTIVE_PAID_SUBSCRIPTION');
    }
  }
  const creditsGranted = subscriptionPlan ? subscriptionPlan.monthlyCredits : launchPack ? launchPack.credits : topUp!.credits;

  const orderId = crypto.randomUUID();
  const paymentMethod = 'qr';
  const config = await publicQrConfig();
  if (!config.enabled) throw new Error('QR_CHECKOUT_NOT_CONFIGURED');

  // 2. Generate a stable, verifiable reference code for this order
  const referenceCode = `AFM-${orderId.substring(0, 8).toUpperCase()}`;

  // 3. Persist order record in database
  let persistedOrderId=orderId;
  if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&!process.env.VITEST){
    const created=await createQrOrderAtomic({workspaceId:req.workspaceId,userId:req.userId,orderId,planId:plan.id,referralCode:req.referralCode});
    if(created.success!==true)throw new Error(String(created.error||'QR_ORDER_CREATE_FAILED'));
  }else{
    const order=await DurableStore.createOrder({id:orderId,workspaceId:req.workspaceId,userId:req.userId,planId:plan.id,amountMyr:plan.priceMyr,creditsGranted,gatewayProvider:'qr_manual',gatewayReference:referenceCode,paymentMethod,referralCode:req.referralCode,metadata:{planName:plan.name,referenceCode,voiceVideos:subscriptionPlan?subscriptionPlan.voiceVideoAllowance:Math.floor(creditsGranted/10),purchaseType:launchPack?'LAUNCH_PACK':topUp?'TOP_UP':'SUBSCRIPTION',creditValidityDays:subscriptionPlan?null:180,paymentAuthority:'CUSTOMER_RECEIPT_UNVERIFIED',renewalType:subscriptionPlan?'manual_30_day':'none'}});persistedOrderId=order.id;
  }

  return {
    success: true,
    orderId: persistedOrderId,
    plan,
    amountMyr: plan.priceMyr,
    creditsGranted,
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
