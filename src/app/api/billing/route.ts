import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { AUTHORITATIVE_PLANS, GENERATION_COSTS } from '@/lib/billing/plans';


export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Sila log masuk untuk melihat maklumat billing dan kredit akaun.' },
      { status: 401 }
    );
  }

  const wallet = await DurableStore.getWallet(session.workspaceId);
  const ledgerHistory = await DurableStore.getLedgerHistory(session.workspaceId, 20);

  return NextResponse.json({
    workspaceId: session.workspaceId,
    currentTier: session.tier,
    balance: wallet.balance,
    reservedBalance: wallet.reservedBalance,
    lifetimeSpent: wallet.lifetimeSpent,
    generationCosts: GENERATION_COSTS,
    authoritativePlans: AUTHORITATIVE_PLANS,
    publicCheckoutEnabled: process.env.PUBLIC_CHECKOUT_ENABLED === 'true',
    ledger: ledgerHistory,
  });
}
