import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { listQrOrders } from '@/lib/billing/qr-checkout';


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

  // Tenant isolation: ordinary workspace admins cannot inspect another tenant.
  if (order.workspaceId !== session.workspaceId && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Akses Ditolak ke pesanan ini.' }, { status: 403 });
  }

  const wallet = await DurableStore.getWallet(order.workspaceId);
  const qrOrder = order.gatewayProvider === 'qr_manual' ? (await listQrOrders(order.workspaceId, 100)).find(item => item.id === order.id) : null;
  const subscription = await DurableStore.getSubscription(order.workspaceId);

  return NextResponse.json({
    orderId: order.id,
    planId: order.planId,
    status: order.status,
    amountMyr: order.amountMyr,
    creditsGranted: order.creditsGranted,
    paidAt: order.paidAt,
    paymentState: qrOrder?.paymentState || (order.status === 'PAID' ? 'BANK_PAYMENT_VERIFIED' : 'PAYMENT_UNVERIFIED'),
    evidenceSubmittedAt: qrOrder?.evidenceSubmittedAt,
    provisionalGrantedAt: qrOrder?.provisionalGrantedAt,
    bankVerifiedAt: qrOrder?.bankVerifiedAt,
    renewalDate: subscription?.currentPeriodEnd,
    renewalType: 'manual',
    walletBalance: wallet.balance,
  });
}
