import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { getQrConfig, inspectEvidence, qrRpc, sha256Hex } from '@/lib/billing/qr-checkout';
import { deletePrivateAsset, uploadPrivateAsset } from '@/lib/storage/supabase-assets';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  let objectKey = '';
  let uploaded = false;
  try {
    const config = await getQrConfig();
    if (process.env.PUBLIC_CHECKOUT_ENABLED !== 'true' || !config.enabled || !config.recipientConfirmed) return NextResponse.json({ error: 'Checkout QR belum dibuka.' }, { status: 403 });
    const form = await req.formData();
    const orderId = String(form.get('orderId') || '');
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'ID pesanan tidak sah.' }, { status: 400 });
    const order = await DurableStore.getOrder(orderId);
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemui.' }, { status: 404 });
    if (order.workspaceId !== session.workspaceId || order.userId !== session.userId) return NextResponse.json({ error: 'Anda tidak dibenarkan menghantar bukti untuk pesanan ini.' }, { status: 403 });
    if (order.gatewayProvider !== 'qr_manual' || order.paymentMethod !== 'qr') return NextResponse.json({ error: 'Pesanan ini bukan pesanan QR.' }, { status: 409 });
    if (order.receiptSha256) {
      return NextResponse.json({
        success: true,
        idempotentReplay: true,
        orderId,
        paymentState: order.paymentState,
        provisionalGranted: order.paymentState === 'CREDITS_PROVISIONALLY_GRANTED',
        creditsGranted: 0,
        message: 'Bukti untuk pesanan ini telah diterima sebelum ini. Tiada kredit tambahan diberikan.',
      });
    }
    const file = form.get('receipt');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Bukti pembayaran diperlukan.' }, { status: 400 });
    const bytes = await file.arrayBuffer();
    const inspected = inspectEvidence(bytes, file.type);
    const hash = await sha256Hex(bytes);
    objectKey = `workspaces/${session.workspaceId}/payment-evidence/${orderId}.${inspected.extension}`;
    await uploadPrivateAsset(objectKey, bytes, inspected.mimeType);
    uploaded = true;
    const result = await qrRpc('provision_qr_order_atomic', {
      p_order_id: orderId, p_receipt_sha256: hash, p_receipt_object_key: objectKey,
      p_receipt_mime_type: inspected.mimeType, p_receipt_size_bytes: bytes.byteLength,
    });
    if (result.success !== true) {
      await deletePrivateAsset(objectKey).catch(() => undefined);
      uploaded = false;
      const code = String(result.error || 'PAYMENT_EVIDENCE_REJECTED');
      return NextResponse.json({ error: code === 'RECEIPT_ALREADY_USED' ? 'Bukti pembayaran ini telah digunakan pada pesanan lain.' : 'Bukti pembayaran tidak dapat diproses.', code }, { status: 409 });
    }
    return NextResponse.json({
      success: true, orderId, paymentState: result.payment_state, provisionalGranted: result.provisional_granted === true,
      creditsGranted: result.credits_granted || 0, walletBalance: result.balance,
      message: result.provisional_granted === true
        ? 'Bukti diterima. Kredit provisional telah dimasukkan sementara menunggu rekonsiliasi bank.'
        : 'Bukti diterima tetapi kredit provisional tidak dikeluarkan kerana had risiko. Pentadbir akan membuat rekonsiliasi bank.',
      reason: result.reason,
    });
  } catch (error) {
    if (uploaded && objectKey) await deletePrivateAsset(objectKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : '';
    if (message === 'CHECKOUT_RATE_LIMIT') return NextResponse.json({ error: 'Terlalu banyak cubaan. Sila tunggu 10 minit.' }, { status: 429 });
    return NextResponse.json({ error: message || 'Bukti pembayaran tidak dapat diproses.' }, { status: 503 });
  }
}
