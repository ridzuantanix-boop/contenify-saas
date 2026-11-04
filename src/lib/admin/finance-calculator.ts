import { DurableStore } from '@/lib/db/store';

export interface FinancialHealthMetrics {
  totalRevenueMyr: number;
  clearedCashMyr: number;
  activePaidCustomers: number;
  customerBreakdown: {
    free: number;
    starter: number;
    pro: number;
    agency: number;
  };
  mrrMyr: number;
  outstandingCreditsCount: number;
  estimatedCreditLiabilityMyr: number;
  expectedProviderRenewalMyr: number;
  pendingAffiliateObligationsMyr: number;
  refundBufferMyr: number;
  requiredOperatingReserveMyr: number;
  safetyBufferMyr: number;
  safeToWithdrawMyr: number;
  reserveStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  emergencyPauseActive: boolean;
  providerUnitCosts: {
    nexabot10sMyr: number;
    runninghub15sMyr: number;
  };
}

/**
 * Calculates genuine financial liability, protected operating reserves, and safe-to-withdraw owner funds.
 */
export async function calculateFinancialSafety(): Promise<FinancialHealthMetrics> {
  const orders = await DurableStore.listOrders(undefined, 1000);
  const paidOrders = orders.filter((o) => o.status === 'PAID');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.amountMyr, 0);

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
  // In production, queries credit_wallets sum(balance)
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

  // Cost to fulfill 10 credits = 1x Nexabot video (RM1.50)
  const creditLiability = Math.round(((outstandingCredits / 10) * nexabotCost) * 100) / 100;

  // Provider renewal commitments (Nexabot & RunningHub platform minimums)
  const providerRenewals = 300.00;

  // Pending affiliate commissions
  const commissions = await DurableStore.listAffiliateCommissions();
  const pendingAffiliates = commissions
    .filter((c) => c.status === 'PENDING' || c.status === 'APPROVED' || c.status === 'PAYABLE')
    .reduce((sum, c) => sum + c.amountMyr, 0);

  // Refund reserve
  const refundBuffer = Math.round((totalRevenue * (refundPercent / 100.0)) * 100) / 100;

  // Required Protected Reserve
  const requiredReserve = Math.round((creditLiability + providerRenewals + pendingAffiliates + refundBuffer) * 100) / 100;

  // Safe to Withdraw = Cleared Cash - Required Reserve - Safety Buffer
  const safeToWithdraw = Math.max(0, Math.round((totalRevenue - requiredReserve - safetyBuffer) * 100) / 100);

  let reserveStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (totalRevenue < requiredReserve) {
    reserveStatus = 'CRITICAL';
  } else if (totalRevenue < (requiredReserve + safetyBuffer)) {
    reserveStatus = 'WARNING';
  }

  return {
    totalRevenueMyr: totalRevenue,
    clearedCashMyr: totalRevenue,
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
    safeToWithdrawMyr: safeToWithdraw,
    reserveStatus,
    emergencyPauseActive: Boolean(genSettings.paused),
    providerUnitCosts: {
      nexabot10sMyr: nexabotCost,
      runninghub15sMyr: runninghubCost,
    },
  };
}
