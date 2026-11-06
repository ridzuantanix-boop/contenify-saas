import { DurableStore } from '@/lib/db/store';

export interface FinancialHealthMetrics {
  totalRevenueMyr: number; // Gross amount of settled (PAID) orders
  pendingOrdersCount: number;
  pendingOrderRevenueMyr: number;
  estimatedGatewayFeesMyr: number; // Gateway processing fee deductions (~2% + RM1/txn)
  clearedCashMyr: number; // Cash after gateway fees (excludes pending)
  activePaidCustomers: number;
  customerBreakdown: {
    free: number;
    starter: number;
    pro: number;
    agency: number;
  };
  mrrMyr: number;
  outstandingCreditsCount: number;
  estimatedCreditLiabilityMyr: number; // Conservative fulfillment cost (RM1.50 per 10 credits)
  expectedProviderRenewalMyr: number; // Fixed monthly provider commitments (RM300)
  pendingAffiliateObligationsMyr: number;
  refundBufferMyr: number; // 10% refund/dispute reserve
  requiredOperatingReserveMyr: number; // Sum of credit liability + provider commitments + affiliate + refunds
  safetyBufferMyr: number; // RM500 hard safety buffer
  safeToWithdrawMyr: number; // Safe owner withdrawal after all reserves
  advisorySafeToWithdrawMyr: number;
  reserveStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  emergencyPauseActive: boolean;
  providerUnitCosts: {
    nexabot15sMyr: number;
    runninghub15sMyr: number;
  };
  costsVerified: boolean;
  gatewaySettlementVerified: boolean;
  notes: {
    clearedCashBasis: string;
    creditLiabilityBasis: string;
    safeToWithdrawBasis: string;
  };
}

/**
 * Calculates genuine financial liability, protected operating reserves, and safe-to-withdraw owner funds.
 * Strictly separates paid/cleared cash from pending orders, and applies conservative provider fulfillment costs.
 */
export async function calculateFinancialSafety(): Promise<FinancialHealthMetrics> {
  const orders = await DurableStore.listOrders(undefined, 1000);
  const paidOrders = orders.filter((o) => o.status === 'PAID');
  const pendingOrders = orders.filter((o) => o.status === 'PENDING');

  const grossPaidRevenue = Math.round(paidOrders.reduce((sum, o) => sum + o.amountMyr, 0) * 100) / 100;
  const pendingOrderRevenue = Math.round(pendingOrders.reduce((sum, o) => sum + o.amountMyr, 0) * 100) / 100;

  // Conservative gateway transaction fees estimate: 2% + RM1.00 per paid transaction
  const estimatedGatewayFees = Math.round(
    paidOrders.reduce((sum, o) => sum + (o.amountMyr * 0.02 + 1.00), 0) * 100
  ) / 100;

  // Orders marked PAID are not proof of bank settlement. Do not treat them as cash.
  const clearedCash = 0;

  // Settings
  const genSettings = (await DurableStore.getSystemSettings('generation_status')) || {};
  const costSettings = (await DurableStore.getSystemSettings('provider_unit_costs')) || {};
  const safetySettings = (await DurableStore.getSystemSettings('financial_safety')) || {};

  const nexabotCost = Number(costSettings.nexabot_15s_myr || 1.50);
  const runninghubCost = Number(costSettings.runninghub_15s_myr || 2.00);
  const safetyBuffer = Number(safetySettings.minimum_safety_buffer_myr || 500.00);
  const refundPercent = Number(safetySettings.refund_reserve_percent || 10.0);
  const costsVerified = Boolean(costSettings.verified_at && costSettings.source && costSettings.nexabot_15s_myr);

  // Active customer tiers & MRR estimation
  const customerBreakdown = { free: 0, starter: 0, pro: 0, agency: 0 };

  for (const order of paidOrders) {
    if (order.planId.includes('agency')) {
      customerBreakdown.agency++;
    } else if (order.planId.includes('pro')) {
      customerBreakdown.pro++;
    } else if (order.planId.includes('starter')) {
      customerBreakdown.starter++;
    }
  }

  const activePaidCustomers = customerBreakdown.starter + customerBreakdown.pro + customerBreakdown.agency;

  // Credit liabilities across customer base
  let outstandingCredits = 0;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const sumRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/credit_wallets?select=balance`, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (sumRes.ok) {
        const rows = await sumRes.json();
        outstandingCredits = rows.reduce((sum: number, r: { balance: number }) => sum + (r.balance || 0), 0);
      }
    } catch {
      // fallback
    }
  }

  // Cost to fulfill 10 credits = 1x Nexabot video (RM1.50 conservative cost basis)
  const creditLiability = Math.round(((outstandingCredits / 10) * nexabotCost) * 100) / 100;

  // Provider renewal commitments (Nexabot & RunningHub platform minimums: RM300/mo)
  const providerRenewals = 300.00;

  // Pending affiliate commissions
  const commissions = await DurableStore.listAffiliateCommissions();
  const pendingAffiliates = Math.round(
    commissions
      .filter((c) => c.status === 'PENDING' || c.status === 'APPROVED' || c.status === 'PAYABLE')
      .reduce((sum, c) => sum + c.amountMyr, 0) * 100
  ) / 100;

  // Refund reserve (10% of gross revenue)
  const refundBuffer = Math.round((grossPaidRevenue * (refundPercent / 100.0)) * 100) / 100;

  // Required Operating Reserve (Untouchable working capital)
  const requiredReserve = Math.round(
    (creditLiability + providerRenewals + pendingAffiliates + refundBuffer) * 100
  ) / 100;

  // Advisory Safe to Withdraw = Cleared Cash - Required Operating Reserve - Safety Buffer
  const advisorySafeToWithdraw = Math.max(
    0,
    Math.round((clearedCash - requiredReserve - safetyBuffer) * 100) / 100
  );

  let reserveStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (clearedCash < requiredReserve) {
    reserveStatus = 'CRITICAL';
  } else if (clearedCash < (requiredReserve + safetyBuffer)) {
    reserveStatus = 'WARNING';
  }
  if (!costsVerified) reserveStatus = 'CRITICAL';

  return {
    totalRevenueMyr: grossPaidRevenue,
    pendingOrdersCount: pendingOrders.length,
    pendingOrderRevenueMyr: pendingOrderRevenue,
    estimatedGatewayFeesMyr: estimatedGatewayFees,
    clearedCashMyr: clearedCash,
    activePaidCustomers,
    customerBreakdown,
    mrrMyr: 0, // Manual orders are not verified recurring contracts.
    outstandingCreditsCount: outstandingCredits,
    estimatedCreditLiabilityMyr: creditLiability,
    expectedProviderRenewalMyr: providerRenewals,
    pendingAffiliateObligationsMyr: pendingAffiliates,
    refundBufferMyr: refundBuffer,
    requiredOperatingReserveMyr: requiredReserve,
    safetyBufferMyr: safetyBuffer,
    safeToWithdrawMyr: 0,
    advisorySafeToWithdrawMyr: advisorySafeToWithdraw,
    reserveStatus,
    emergencyPauseActive: Boolean(genSettings.paused),
    providerUnitCosts: {
      nexabot15sMyr: nexabotCost,
      runninghub15sMyr: runninghubCost,
    },
    costsVerified,
    gatewaySettlementVerified: false,
    notes: {
      clearedCashBasis: 'UNAVAILABLE: status PAID dalam aplikasi tidak membuktikan wang telah dijelaskan ke akaun bank.',
      creditLiabilityBasis: 'Anggaran sementara daripada tetapan kos pembekal; kos sebenar belum disahkan.',
      safeToWithdrawBasis: 'RM0 sehingga penyelesaian gateway dan kos pembekal disahkan. Anggaran sahaja tidak boleh digunakan untuk pengeluaran pemilik.',
    },
  };
}
