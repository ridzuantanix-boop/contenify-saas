import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

/**
 * GET /api/billing/verify-order?orderId=...
 * Allows customer frontend to poll and check whether payment has cleared.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Akses Ditolak: Sila log masuk.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json({ error: 'orderId diperlukan.' }, { status: 400 });
  }

  const order = await DurableStore.getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak dijumpai.' }, { status: 404 });
  }

  // Tenant isolation: Only order owner or admin can inspect order
  if (order.workspaceId !== session.workspaceId && session.role !== 'owner' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Akses Ditolak ke pesanan ini.' }, { status: 403 });
  }

  const wallet = await DurableStore.getWallet(session.workspaceId);

  return NextResponse.json({
    orderId: order.id,
    planId: order.planId,
    status: order.status,
    amountMyr: order.amountMyr,
    creditsGranted: order.creditsGranted,
    paidAt: order.paidAt,
    walletBalance: wallet.balance,
  });
}
