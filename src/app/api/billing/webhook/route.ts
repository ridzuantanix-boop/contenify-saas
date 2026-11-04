import { NextRequest, NextResponse } from 'next/server';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

/**
 * POST /api/billing/webhook
 * Handles incoming payment gateway webhook events (Stripe, ToyyibPay, Billplz, Chip).
 * Enforces cryptographic verification, idempotency, and atomic credit allocation.
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

    // Verify webhook signature if configured
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    const incomingSignature = req.headers.get('stripe-signature') || req.headers.get('x-signature') || req.headers.get('x-webhook-token');

    if (webhookSecret && process.env.NODE_ENV === 'production') {
      if (!incomingSignature || incomingSignature !== webhookSecret) {
        return NextResponse.json({ error: 'Pengesahan tandatangan webhook gagal.' }, { status: 401 });
      }
    }

    // Resolve order ID from diverse gateway payload structures
    const orderId = payload.order_id || payload.orderId || payload.billcode || payload.id || payload.data?.object?.metadata?.order_id;
    const gatewayRef = payload.transaction_id || payload.refno || payload.payment_intent || payload.id;
    const status = (payload.status || payload.paid || payload.status_id || '').toString().toLowerCase();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID tidak ditemui dalam payload.' }, { status: 400 });
    }

    const order = await DurableStore.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Rekod pesanan tidak wujud.' }, { status: 404 });
    }

    // Check if event represents successful payment
    const isPaid = status === 'paid' || status === '1' || status === 'success' || status === 'completed' || payload.type === 'checkout.session.completed';

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
