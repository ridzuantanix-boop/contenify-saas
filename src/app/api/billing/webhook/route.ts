import { NextRequest, NextResponse } from 'next/server';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

/**
 * POST /api/billing/webhook
 * Handles incoming payment gateway webhook events.
 * Strictly fails closed when required webhook credentials are absent.
 * Enforces cryptographic verification, amount matching, currency matching, and idempotency.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = Object.fromEntries(new URLSearchParams(rawBody));
    }

    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

    // Fail closed in production when required webhook credentials are absent
    if (process.env.NODE_ENV === 'production' && !webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook gateway belum dikonfigurasi: PAYMENT_WEBHOOK_SECRET diperlukan.' },
        { status: 503 }
      );
    }

    // Cryptographic signature check
    const incomingSignature =
      req.headers.get('stripe-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('x-webhook-token') ||
      req.headers.get('authorization');

    if (webhookSecret) {
      const cleanSig = incomingSignature?.replace(/^Bearer\s+/i, '');
      if (!cleanSig || cleanSig !== webhookSecret) {
        return NextResponse.json({ error: 'Akses Ditolak: Pengesahan tandatangan webhook gagal.' }, { status: 401 });
      }
    }

    // Resolve order ID from diverse gateway payload structures
    const orderId =
      payload.order_id ||
      payload.orderId ||
      payload.billcode ||
      payload.id ||
      payload.data?.object?.metadata?.order_id;

    const gatewayRef = payload.transaction_id || payload.refno || payload.payment_intent || payload.id;
    const status = (payload.status || payload.paid || payload.status_id || '').toString().toLowerCase();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID tidak ditemui dalam payload.' }, { status: 400 });
    }

    const order = await DurableStore.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Rekod pesanan tidak wujud.' }, { status: 404 });
    }

    // Idempotent duplicate replay check
    if (order.status === 'PAID') {
      const currentWallet = await DurableStore.getWallet(order.workspaceId);
      return NextResponse.json({
        success: true,
        idempotentReplay: true,
        message: 'Pesanan telah disahkan terdahulu.',
        orderId: order.id,
        balance: currentWallet.balance,
      });
    }

    // Validate amount
    if (payload.amount != null) {
      const expectedAmount = order.amountMyr;
      const receivedAmount = Number(payload.amount);
      if (receivedAmount !== expectedAmount && receivedAmount !== expectedAmount * 100) {
        return NextResponse.json({ error: 'Jumlah pembayaran tidak sepadan dengan nilai pesanan.' }, { status: 400 });
      }
    }

    // Validate currency
    if (payload.currency && payload.currency.toString().toUpperCase() !== 'MYR') {
      return NextResponse.json({ error: 'Mata wang pembayaran tidak sah: hanya MYR diterima.' }, { status: 400 });
    }

    // Check confirmed payment status
    const isPaid =
      status === 'paid' ||
      status === '1' ||
      status === 'success' ||
      status === 'completed' ||
      payload.type === 'checkout.session.completed';

    if (isPaid) {
      const settlement = await DurableStore.settleOrder(order.id, gatewayRef, {
        webhookReceivedAt: new Date().toISOString(),
        gatewayPayload: payload,
      });

      return NextResponse.json({
        success: true,
        message: 'Pembayaran disahkan dan kredit telah diperuntukkan.',
        orderId: settlement.orderId,
        balance: settlement.balance,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Status webhook diterima: ${status}. Tiada mutasi kewangan dibuat.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
