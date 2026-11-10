import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';
import { DEFAULT_QR_CONFIG, getQrConfig, inspectEvidence, normalizeQrConfig, QR_CONFIG_KEY, sha256Hex } from '@/lib/billing/qr-checkout';
import { deletePrivateAsset, signPrivateAsset, uploadPrivateAsset } from '@/lib/storage/supabase-assets';

async function superadmin(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return null;
  return auth;
}

export async function GET(req: NextRequest) {
  const auth = await superadmin(req);
  if (!auth) return NextResponse.json({ error: 'Akses superadmin diperlukan.' }, { status: 403 });
  const config = await getQrConfig();
  return NextResponse.json({ config: { ...config, qrImageUrl: config.qrObjectKey ? await signPrivateAsset(config.qrObjectKey, 900) : '' } });
}

export async function POST(req: NextRequest) {
  const auth = await superadmin(req);
  if (!auth) return NextResponse.json({ error: 'Akses superadmin diperlukan.' }, { status: 403 });
  const admin = auth.userId || 'superadmin';
  let uploadedKey = '';
  try {
    const current = await getQrConfig();
    const form = await req.formData();
    const enabled = form.get('enabled') === 'true';
    const autoFulfillEnabled = form.get('autoFulfillEnabled') === 'true';
    const recipientConfirmed = form.get('recipientConfirmed') === 'true';
    const candidate = normalizeQrConfig({
      ...current,
      enabled,
      autoFulfillEnabled: enabled && autoFulfillEnabled,
      recipientConfirmed,
      merchantName: form.get('merchantName'),
      bankName: form.get('bankName'),
      recipientInfo: form.get('recipientInfo'),
      instructions: form.get('instructions'),
      provisionalExposureCapMyr: Number(form.get('provisionalExposureCapMyr')),
      maxAutoOrderMyr: Number(form.get('maxAutoOrderMyr')),
      instantFullAccessEnabled: form.get('instantFullAccessEnabled') === 'true',
      updatedAt: new Date().toISOString(),
      updatedBy: admin,
    });
    const file = form.get('qrImage');
    if (file instanceof File && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const inspected = inspectEvidence(bytes, file.type);
      if (inspected.mimeType === 'application/pdf') return NextResponse.json({ error: 'QR mesti imej JPEG, PNG atau WebP.' }, { status: 400 });
      if (bytes.byteLength < 10_000) return NextResponse.json({ error: 'Imej QR terlalu kecil untuk disahkan sebagai imej pembayaran yang jelas.' }, { status: 400 });
      const hash = await sha256Hex(bytes);
      uploadedKey = `system/qr-checkout/${Date.now()}-${hash.slice(0,16)}.${inspected.extension}`;
      await uploadPrivateAsset(uploadedKey, bytes, inspected.mimeType);
      candidate.qrObjectKey = uploadedKey;
      candidate.qrSha256 = hash;
    }
    if (enabled && (!candidate.qrObjectKey || !candidate.merchantName || !candidate.recipientInfo || !recipientConfirmed)) {
      if (uploadedKey) await deletePrivateAsset(uploadedKey);
      return NextResponse.json({ error: 'QR, nama merchant, maklumat penerima dan pengesahan destinasi diperlukan sebelum checkout boleh diaktifkan.' }, { status: 400 });
    }
    await DurableStore.setSystemSettings(QR_CONFIG_KEY, candidate);
    await DurableStore.recordAuditLog(admin, 'QR_CHECKOUT_CONFIG_UPDATED', 'SYSTEM', QR_CONFIG_KEY, {
      enabled: candidate.enabled, autoFulfillEnabled: candidate.autoFulfillEnabled, merchantName: candidate.merchantName,
      bankName: candidate.bankName, recipientInfo: candidate.recipientInfo, qrSha256: candidate.qrSha256,
      recipientConfirmed: candidate.recipientConfirmed, provisionalExposureCapMyr: candidate.provisionalExposureCapMyr,
      maxAutoOrderMyr: candidate.maxAutoOrderMyr,
      instantFullAccessEnabled: candidate.instantFullAccessEnabled,
    });
    if (uploadedKey && current.qrObjectKey && current.qrObjectKey !== uploadedKey) await deletePrivateAsset(current.qrObjectKey);
    return NextResponse.json({ success: true, config: { ...candidate, qrImageUrl: candidate.qrObjectKey ? await signPrivateAsset(candidate.qrObjectKey, 900) : '' } });
  } catch (error) {
    console.error('[QR billing settings] save failed:', error instanceof Error ? error.message : String(error));
    if (uploadedKey) await deletePrivateAsset(uploadedKey).catch(() => undefined);
    return NextResponse.json({ error: 'Tetapan QR tidak dapat disimpan.' }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await superadmin(req);
  if (!auth) return NextResponse.json({ error: 'Akses superadmin diperlukan.' }, { status: 403 });
  try {
    const current = await getQrConfig();
    const next = { ...DEFAULT_QR_CONFIG, updatedAt: new Date().toISOString(), updatedBy: auth.userId || 'superadmin' };
    await DurableStore.setSystemSettings(QR_CONFIG_KEY, next);
    await DurableStore.recordAuditLog(auth.userId || 'superadmin', 'QR_CHECKOUT_CONFIG_REMOVED', 'SYSTEM', QR_CONFIG_KEY, { previousQrSha256: current.qrSha256 });
    if (current.qrObjectKey) await deletePrivateAsset(current.qrObjectKey);
    return NextResponse.json({ success: true, config: next });
  } catch { return NextResponse.json({ error: 'QR tidak dapat dibuang.' }, { status: 503 }); }
}
