import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { AUTHORITATIVE_PLANS } from '@/lib/billing/plans';
import { affiliateDb } from '@/lib/db/affiliate-ledger';
import { getWorkspacePaymentControl, listCustomerNotifications } from '@/lib/billing/payment-control';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const [wallet, recentJobs, orders, partner,paymentControl,notifications] = await Promise.all([
      DurableStore.getWallet(session.workspaceId), DurableStore.listJobs(session.workspaceId, 5),
      DurableStore.listOrders(session.workspaceId, 10), DurableStore.getAffiliatePartner(session.userId),getWorkspacePaymentControl(session.workspaceId),listCustomerNotifications(session.workspaceId),
    ]);
    const plan = AUTHORITATIVE_PLANS.find((candidate) => candidate.id === `plan_${session.tier}`);
    let counts: Record<string, number> | null = null;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { base, headers } = affiliateDb();
      const response = await fetch(`${base}/rest/v1/rpc/dashboard_workspace_metrics`, {
        method: 'POST', headers, body: JSON.stringify({ p_workspace_id: session.workspaceId }),
      });
      if (!response.ok) throw new Error('Metrics unavailable');
      counts = await response.json() as Record<string, number>;
    } else if (process.env.NODE_ENV === 'production' && !process.env.VITEST) throw new Error('Database unavailable');
    return NextResponse.json({
      account: { email: session.email, name: session.fullName, tier: session.tier },
      wallet: { balance: wallet.balance, reserved: wallet.reservedBalance, available: wallet.balance - wallet.reservedBalance,
        lifetimeSpent: wallet.lifetimeSpent },
      monthlyAllowance: plan?.monthlyCredits || 0,
      counts,
      recentJobs: recentJobs.map((job) => ({ id: job.id, status: job.status, styleId: job.styleId, createdAt: job.createdAt })),
      billingHistory: orders.map((order) => ({ id: order.id, planId: order.planId, amountMyr: order.amountMyr, status: order.status, createdAt: order.createdAt })),
      affiliateStatus: partner?.status || 'NOT_APPLIED',
      paymentControl,notifications,
    });
  } catch { return NextResponse.json({ error: 'Dashboard tidak tersedia.' }, { status: 503 }); }
}
