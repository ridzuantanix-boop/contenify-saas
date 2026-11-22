export type FomoEconomicsInput = {
  priceMyr: number;
  credits: number;
  creditsPerVideo: number;
  observedProviderCostMyrPerVideo: number;
  conservativeReserveMyrPerVideo: number;
  refundReservePercent: number;
  affiliateCommissionPercent: number;
  paymentProcessingMyr: number;
};

export function calculatePackEconomics(input: FomoEconomicsInput) {
  const videos = Math.floor(input.credits / input.creditsPerVideo);
  const providerObservedMyr = videos * input.observedProviderCostMyrPerVideo;
  const providerReserveMyr = videos * input.conservativeReserveMyrPerVideo;
  const refundReserveMyr = input.priceMyr * input.refundReservePercent / 100;
  const affiliateLiabilityMyr = input.priceMyr * input.affiliateCommissionPercent / 100;
  const contributionAfterConservativeReservesMyr = input.priceMyr - providerReserveMyr - refundReserveMyr - affiliateLiabilityMyr - input.paymentProcessingMyr;
  return {
    credits: input.credits,
    videos,
    providerObservedMyr: Number(providerObservedMyr.toFixed(2)),
    providerReserveMyr: Number(providerReserveMyr.toFixed(2)),
    refundReserveMyr: Number(refundReserveMyr.toFixed(2)),
    affiliateLiabilityMyr: Number(affiliateLiabilityMyr.toFixed(2)),
    paymentProcessingMyr: Number(input.paymentProcessingMyr.toFixed(2)),
    contributionAfterConservativeReservesMyr: Number(contributionAfterConservativeReservesMyr.toFixed(2)),
    commerciallyPositive: contributionAfterConservativeReservesMyr > 0,
  };
}

export function compareLaunchPackEconomics(input: Omit<FomoEconomicsInput, 'credits'>) {
  const base = calculatePackEconomics({ ...input, credits: 150 });
  const promotional = calculatePackEconomics({ ...input, credits: 250 });
  return {
    base,
    promotional,
    incrementalCredits: 100,
    incrementalVideos: promotional.videos - base.videos,
    incrementalConservativeLiabilityMyr: Number((promotional.providerReserveMyr - base.providerReserveMyr).toFixed(2)),
    contributionReductionMyr: Number((base.contributionAfterConservativeReservesMyr - promotional.contributionAfterConservativeReservesMyr).toFixed(2)),
  };
}
