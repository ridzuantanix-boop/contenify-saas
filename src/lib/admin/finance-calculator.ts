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
    nexabot10sMyr: number;
    runninghub15sMyr: number;
  };
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

  // Actual cleared cash in owner bank account (excluding pending transfer receipts)
  const clearedCash = Math.max(0, Math.round((grossPaidRevenue - estimatedGatewayFees) * 100) / 100);

  // Settings
  const genSettings = (await DurableStore.getSystemSettings('generation_status')) || {};
  const costSettings = (await DurableStore.getSystemSettings('provider_unit_costs')) || {};
  const safetySettings = (await DurableStore.getSystemSettings('financial_safety')) || {};

  const nexabotCost = Number(costSettings.nexabot_10s_myr || 1.50);
  const runninghubCost = Number(costSettings.runninghub_15s_myr || 2.00);
  const safetyBuffer = Number(safetySettings.minimum_safety_buffer_myr || 500.00);
  const refundPercent = Number(safetySettings.refund_reserve_percent || 10.0);

  // Active customer tiers & MRR estimation
  const customerBreakdown = { free: 0, starter: 0, pro: 0, agency: 0 };
  let mrr = 0;

  for (const order of paidOrders) {
    if (order.planId.includes('agency')) {
      customerBreakdown.agency++;
      mrr += 399;
    } else if (order.planId.includes('pro')) {
      customerBreakdown.pro++;
      mrr += 129;
    } else if (order.planId.includes('starter')) {
      customerBreakdown.starter++;
      mrr += 49;
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

  return {
    totalRevenueMyr: grossPaidRevenue,
    pendingOrdersCount: pendingOrders.length,
    pendingOrderRevenueMyr: pendingOrderRevenue,
    estimatedGatewayFeesMyr: estimatedGatewayFees,
    clearedCashMyr: clearedCash,
    activePaidCustomers,
    customerBreakdown,
    mrrMyr: mrr,
    outstandingCreditsCount: outstandingCredits,
    estimatedCreditLiabilityMyr: creditLiability,
    expectedProviderRenewalMyr: providerRenewals,
    pendingAffiliateObligationsMyr: pendingAffiliates,
    refundBufferMyr: refundBuffer,
    requiredOperatingReserveMyr: requiredReserve,
    safetyBufferMyr: safetyBuffer,
    safeToWithdrawMyr: advisorySafeToWithdraw,
    advisorySafeToWithdrawMyr: advisorySafeToWithdraw,
    reserveStatus,
    emergencyPauseActive: Boolean(genSettings.paused),
    providerUnitCosts: {
      nexabot10sMyr: nexabotCost,
      runninghub15sMyr: runninghubCost,
    },
    notes: {
      clearedCashBasis: 'Dikira dari pesanan PAID ditolak anggaran yuran gateway (2% + RM1). Pesanan PENDING tidak dikira.',
      creditLiabilityBasis: 'Anggaran kos pemenuhan liabiliti kredit aktif berdasarkan RM1.50 per 10 kredit Nexabot.',
      safeToWithdrawBasis: 'Anggaran jumlah selamat dikeluarkan selepas menolak simpanan operasi, liabiliti AI provider (RM300), komisen affiliate, dan rizab keselamatan (RM500).',
    },
  };
}
