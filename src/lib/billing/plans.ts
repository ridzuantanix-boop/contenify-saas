/**
 * AFFIMATIK by Pawarna — Authoritative Billing & Pricing Configuration
 * Single source of truth for subscription plans, credit allowances, and generation costs.
 */

export interface PricingPlan {
  id: string;
  name: string;
  priceFormatted: string;
  priceMyr: number;
  billingPeriod: string;
  monthlyCredits: number;
  voiceVideoAllowance: number;
  features: string[];
  isPopular?: boolean;
  highlightBadge?: string;
}

export interface TopUpPackage {
  id: string;
  name: string;
  priceMyr: number;
  priceFormatted: string;
  credits: number;
  validityDays: 180;
  effectiveMyrPerVideo: number;
}

export interface LaunchPackage extends TopUpPackage {
  oneTime: true;
  requiresPaidSubscription: false;
}

export const GENERATION_COSTS = {
  VOICE_NEXABOT: 10, // 10 wallet credits for Nexabot Voice; independent of duration
  TEN_SECONDS_NEXABOT: 10, // Legacy alias for historical records
  FIFTEEN_SECONDS_RUNNINGHUB: 15, // 15 credits for 15-second RunningHub video (visual, no voice)
} as const;

export const AUTHORITATIVE_PLANS: PricingPlan[] = [
  {
    id: 'plan_starter',
    name: 'Starter Creator',
    priceFormatted: 'RM 49',
    priceMyr: 49,
    billingPeriod: '/bulan',
    monthlyCredits: 500,
    voiceVideoAllowance: 50,
    features: [
      '500 Kredit Sebulan',
      'Hingga 50 video Voice 15 saat',
      'Akses Penuh Video Style Library',
      '20 gaya AffiMatik Voice V6',
      'Video menegak 9:16',
    ],
  },
  {
    id: 'plan_pro',
    name: 'Pro Creator',
    priceFormatted: 'RM 129',
    priceMyr: 129,
    billingPeriod: '/bulan',
    monthlyCredits: 2000,
    voiceVideoAllowance: 200,
    isPopular: true,
    highlightBadge: 'Paling Popular',
    features: [
      '2,000 Kredit Sebulan',
      'Hingga 200 video Voice 15 saat',
      'Semua Ciri Starter',
      'RunningHub kekal tidak aktif',
      '20 gaya AffiMatik Voice V6',
    ],
  },
  {
    id: 'plan_agency',
    name: 'Agency Studio',
    priceFormatted: 'RM 399',
    priceMyr: 399,
    billingPeriod: '/bulan',
    monthlyCredits: 8000,
    voiceVideoAllowance: 800,
    features: [
      '8,000 Kredit Sebulan',
      'Hingga 800 video Voice 15 saat',
      '20 gaya AffiMatik Voice V6',
    ],
  },
];

export const FREE_TRIAL = { id: 'free_trial', name: 'Free Trial', priceMyr: 0, credits: 20, videos: 2, oneTime: true } as const;

export const LAUNCH_PACK: LaunchPackage = {
  id: 'launch_pack',
  name: 'Launch Pack',
  priceMyr: 19,
  priceFormatted: 'RM 19',
  credits: 150,
  validityDays: 180,
  effectiveMyrPerVideo: 1.27,
  oneTime: true,
  requiresPaidSubscription: false,
};

export const TOP_UP_PACKAGES: TopUpPackage[] = [
  { id: 'topup_mini', name: 'Mini', priceMyr: 15, priceFormatted: 'RM 15', credits: 100, validityDays: 180, effectiveMyrPerVideo: 1.5 },
  { id: 'topup_plus', name: 'Plus', priceMyr: 34, priceFormatted: 'RM 34', credits: 300, validityDays: 180, effectiveMyrPerVideo: 1.13 },
  { id: 'topup_max', name: 'Max', priceMyr: 55, priceFormatted: 'RM 55', credits: 500, validityDays: 180, effectiveMyrPerVideo: 1.1 },
];

export function effectiveMyrPerVideo(plan: PricingPlan): number {
  return Math.round((plan.priceMyr / plan.voiceVideoAllowance) * 100) / 100;
}

export function calculateGenerationCredits(provider: 'nexabot' | 'runninghub'): number {
  return provider === 'nexabot' ? GENERATION_COSTS.VOICE_NEXABOT : GENERATION_COSTS.FIFTEEN_SECONDS_RUNNINGHUB;
}

export function calculateVideosPossible(credits: number, provider: 'nexabot' | 'runninghub'): number {
  const cost = calculateGenerationCredits(provider);
  return Math.floor(credits / cost);
}
