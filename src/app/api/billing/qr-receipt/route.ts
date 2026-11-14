import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { isTutorialGuestSession } from '@/lib/auth/tutorial-guest';
import { DurableStore } from '@/lib/db/store';
import { getQrConfig, inspectEvidence, qrRpc, sha256Hex } from '@/lib/billing/qr-checkout';
import { deletePrivateAsset, uploadPrivateAsset } from '@/lib/storage/supabase-assets';
import { sendPaymentEventEmail } from '@/lib/billing/payment-control';
import { recordServerConversion } from '@/lib/analytics/conversion';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  if (isTutorialGuestSession(session)) return NextResponse.json({ error: 'Pembayaran tidak tersedia dalam workspace tutorial.' }, { status: 403 });
  let objectKey = '';
  let uploaded = false;
  try {
    const config = await getQrConfig();
    if (process.env.PUBLIC_CHECKOUT_ENABLED !== 'true' || !config.enabled || !config.autoFulfillEnabled || !config.instantFullAccessEnabled || !config.recipientConfirmed) return NextResponse.json({ error: 'Checkout QR belum dibuka.' }, { status: 403 });
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
        provisionalGranted: order.paymentState === 'CREDITS_PROVISIONALLY_GRANTED' || order.paymentState === 'PROVISIONALLY_ACTIVE',
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
    await recordServerConversion({eventName:'qr_evidence_submitted',dedupeKey:`receipt:${orderId}`,userId:session.userId,workspaceId:session.workspaceId,metadata:{planId:order.planId,source:'qr'}}).catch(()=>false);
    if(result.provisional_granted===true)await Promise.allSettled([
      sendPaymentEventEmail({to:session.email,event:'PAYMENT_DECLARATION_RECEIVED',orderId,amountMyr:order.amountMyr}),
      sendPaymentEventEmail({to:session.email,event:'PAYMENT_PROVISIONAL_ACTIVE',orderId,credits:Number(result.credits_granted||order.creditsGranted)}),
      recordServerConversion({eventName:'credits_provisionally_activated',dedupeKey:`provisional:${orderId}`,userId:session.userId,workspaceId:session.workspaceId,metadata:{planId:order.planId,source:'qr'}}),
    ]);
    return NextResponse.json({
      success: true, orderId, paymentState: result.payment_state, provisionalGranted: result.provisional_granted === true,
      creditsGranted: result.credits_granted || 0, walletBalance: result.balance,
      message: result.provisional_granted===true?'Terima kasih! Kredit pakej anda telah diaktifkan dan boleh digunakan sekarang. Pembayaran anda masih dalam proses pengesahan.':'Bukti pembayaran diterima dan sedang disemak.',
      reason: result.reason,
    });
  } catch (error) {
    if (uploaded && objectKey) await deletePrivateAsset(objectKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : '';
    if (message === 'CHECKOUT_RATE_LIMIT') return NextResponse.json({ error: 'Terlalu banyak cubaan. Sila tunggu 10 minit.' }, { status: 429 });
    return NextResponse.json({ error: message || 'Bukti pembayaran tidak dapat diproses.' }, { status: 503 });
  }
}
