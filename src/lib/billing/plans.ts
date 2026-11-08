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
    monthlyCredits: 100,
    voiceVideoAllowance: 10,
    features: [
      '100 Kredit Sebulan',
      'Hingga 10 video Voice 15 saat',
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
    monthlyCredits: 300,
    voiceVideoAllowance: 30,
    isPopular: true,
    highlightBadge: 'Paling Popular',
    features: [
      '300 Kredit Sebulan',
      'Hingga 30 video Voice 15 saat',
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
    monthlyCredits: 1000,
    voiceVideoAllowance: 100,
    features: [
      '1,000 Kredit Sebulan',
      'Hingga 100 video Voice 15 saat',
      '20 gaya AffiMatik Voice V6',
    ],
  },
];

export function calculateGenerationCredits(provider: 'nexabot' | 'runninghub'): number {
  return provider === 'nexabot' ? GENERATION_COSTS.VOICE_NEXABOT : GENERATION_COSTS.FIFTEEN_SECONDS_RUNNINGHUB;
}

export function calculateVideosPossible(credits: number, provider: 'nexabot' | 'runninghub'): number {
  const cost = calculateGenerationCredits(provider);
  return Math.floor(credits / cost);
}
