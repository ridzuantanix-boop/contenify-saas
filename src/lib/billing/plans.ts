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
    monthlyCredits: 50,
    tenSecondVideoAllowance: 5, // 50 / 10 = 5 videos
    fifteenSecondVideoAllowance: 3, // 50 / 15 = 3 videos (remainder 5 credits)
    features: [
      '50 Kredit Sebulan',
      'Hingga 5x Video 10s (Nexabot) atau 3x Video 15s (RunningHub)',
      'Akses Penuh Video Style Library',
      'AI Creative Director & Smart Match',
      'Kualiti 720P / 1080P Menegak (9:16)',
      'Simpanan Video 14 Hari',
    ],
  },
  {
    id: 'plan_pro',
    name: 'Pro Affiliate',
    priceFormatted: 'RM 129',
    priceMyr: 129,
    billingPeriod: '/bulan',
    monthlyCredits: 160,
    tenSecondVideoAllowance: 16, // 160 / 10 = 16 videos
    fifteenSecondVideoAllowance: 10, // 160 / 15 = 10 videos (remainder 10 credits)
    isPopular: true,
    highlightBadge: 'Paling Popular',
    features: [
      '160 Kredit Sebulan',
      'Hingga 16x Video 10s atau 10x Video 15s',
      'Semua Ciri Starter',
      'Akses Penuh RunningHub No-Voice Workflow',
      'Simpan Produk & Avatar Sendiri',
      'Simpanan Video 60 Hari',
      'Muat Turun Tanpa Had & Eksport Pukal',
    ],
  },
  {
    id: 'plan_agency',
    name: 'Agency Studio',
    priceFormatted: 'RM 399',
    priceMyr: 399,
    billingPeriod: '/bulan',
    monthlyCredits: 600,
    tenSecondVideoAllowance: 60, // 600 / 10 = 60 videos
    fifteenSecondVideoAllowance: 40, // 600 / 15 = 40 videos
    features: [
      '600 Kredit Sebulan',
      'Hingga 60x Video 10s atau 40x Video 15s',
      'Sokongan Multi-Workspace',
      'Pemprosesan Keutamaan Awan (Fast Queue)',
      'Storan Video Tanpa Had',
      'Sokongan Dedikasi Pawarna 24/7',
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
