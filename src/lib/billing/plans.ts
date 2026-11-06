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
  tenSecondVideoAllowance: number;
  fifteenSecondVideoAllowance: number;
  features: string[];
  isPopular?: boolean;
  highlightBadge?: string;
}

export const GENERATION_COSTS = {
  TEN_SECONDS_NEXABOT: 10, // 10 credits for 10-second Nexabot video with spoken BM
  FIFTEEN_SECONDS_RUNNINGHUB: 15, // 15 credits for 15-second RunningHub video (visual, no voice)
} as const;

export const AUTHORITATIVE_PLANS: PricingPlan[] = [
  {
    id: 'plan_starter',
    name: 'Starter Creator',
    priceFormatted: 'RM 49',
    priceMyr: 49,
    billingPeriod: '/bulan',
    monthlyCredits: 100,
    tenSecondVideoAllowance: 10,
    fifteenSecondVideoAllowance: 6,
    features: [
      '100 Kredit Sebulan',
      'Hingga 10 video Voice atau 6 video Motion',
      'Akses Penuh Video Style Library',
      '13 gaya video rasmi',
      'Video menegak 9:16',
    ],
  },
  {
    id: 'plan_pro',
    name: 'Pro Creator',
    priceFormatted: 'RM 129',
    priceMyr: 129,
    billingPeriod: '/bulan',
    monthlyCredits: 300,
    tenSecondVideoAllowance: 30,
    fifteenSecondVideoAllowance: 20,
    isPopular: true,
    highlightBadge: 'Paling Popular',
    features: [
      '300 Kredit Sebulan',
      'Hingga 30 video Voice atau 20 video Motion',
      'Semua Ciri Starter',
      'Akses Penuh Enjin AffiMatik Motion Visual Realistik',
      'Akses 13 gaya video rasmi',
    ],
  },
  {
    id: 'plan_agency',
    name: 'Agency Studio',
    priceFormatted: 'RM 399',
    priceMyr: 399,
    billingPeriod: '/bulan',
    monthlyCredits: 1000,
    tenSecondVideoAllowance: 100,
    fifteenSecondVideoAllowance: 66,
    features: [
      '1,000 Kredit Sebulan',
      'Hingga 100 video Voice atau 66 video Motion',
      'Akses 13 gaya video rasmi',
    ],
  },
];

export function calculateGenerationCredits(durationSeconds: 10 | 15): number {
  return durationSeconds === 10
    ? GENERATION_COSTS.TEN_SECONDS_NEXABOT
    : GENERATION_COSTS.FIFTEEN_SECONDS_RUNNINGHUB;
}

export function calculateVideosPossible(credits: number, durationSeconds: 10 | 15): number {
  const cost = calculateGenerationCredits(durationSeconds);
  return Math.floor(credits / cost);
}
