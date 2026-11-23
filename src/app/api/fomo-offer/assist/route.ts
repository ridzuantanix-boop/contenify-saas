import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { fomoFeatureEnabled, initializeFomoOffer, reserveFomoAssistance, updateFomoAssistanceEmailStatus, visitorIdFromRequest, type FomoOfferState } from '@/lib/billing/fomo-bonus';

function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '');
  if (/^01\d{8,9}$/.test(compact)) return `60${compact.slice(1)}`;
  if (/^\+?60\d{9,10}$/.test(compact)) return compact.replace(/^\+/, '');
  if (/^\+?[1-9]\d{7,14}$/.test(compact)) return compact.replace(/^\+/, '');
  return '';
}

export async function POST(req: NextRequest) {
  if (!fomoFeatureEnabled()) return NextResponse.json({ error: 'Bantuan tawaran tidak aktif.' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as { whatsapp?: string; privacyAccepted?: boolean; marketingConsent?: boolean; auditTest?: boolean };
  const phone = normalizePhone(String(body.whatsapp || ''));
  if (!phone || body.privacyAccepted !== true) return NextResponse.json({ error: 'Masukkan nombor WhatsApp yang sah dan sahkan notis privasi.' }, { status: 400 });
  if (body.auditTest) {
    const auth = await verifyAdminAccess(req);
    if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ujian ditolak.' }, { status: 403 });
  }
  const visitorId = visitorIdFromRequest(req);
  const session = await getSessionFromRequest(req).catch(() => null);
  const state: FomoOfferState = await initializeFomoOffer(visitorId, session?.userId).catch(() => ({ enabled: false }));
  const hourKey = new Date().toISOString().slice(0, 13);
  const dedupeKey = `whatsapp:${visitorId}:${hourKey}`;
  const phoneCountry = phone.startsWith('60') ? 'MY' : 'INTL';
  let reserved = false;
  try {
    reserved = await reserveFomoAssistance({ visitorId, dedupeKey, campaignId: state.campaign_id,
      userId: session?.userId, workspaceId: session?.workspaceId, claimId: state.claim?.id,
      testRequest: body.auditTest === true, phoneCountry });
  } catch {
    return NextResponse.json({ error: 'Permintaan bantuan belum dapat direkodkan. Sila cuba lagi.' }, { status: 503 });
  }
  let emailStatus = 'NOT_CONFIGURED';
  const ownerEmail = process.env.FOMO_OWNER_NOTIFICATION_EMAIL || '';
  if (!reserved) emailStatus = 'ALREADY_REQUESTED';
  else if (process.env.RESEND_API_KEY && ownerEmail) {
    const claim = state.claim;
    const checkoutUrl = `${process.env.APP_BASE_URL || 'https://affimatik.online'}/register?intent=launch_pack&promo=fomo_v1`;
    const text = [body.auditTest ? 'UJIAN PRODUKSI — BUKAN LEAD ATAU JUALAN PELANGGAN' : 'Permintaan bantuan Bonus 100 Kredit', `Masa: ${new Date().toISOString()}`, `WhatsApp: +${phone}`, `Claim: ${claim?.id || 'Belum diclaim'}`, `Status: ${claim?.status || 'Belum diclaim'}`, `Tamat pembayaran: ${claim?.paymentExpiresAt || '—'}`, `Checkout: ${checkoutUrl}`].join('\n');
    try {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.PAYMENT_EMAIL_FROM || 'AffiMatik <noreply@affimatik.online>', to: [ownerEmail], subject: body.auditTest ? '[UJIAN PRODUKSI] AffiMatik FOMO — bukan lead pelanggan' : '[AffiMatik] Permintaan Bantuan / Bonus 100 Kredit', text, html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[char] || char))}</pre>` }) });
      emailStatus = response.ok ? 'SENT' : `FAILED_${response.status}`;
    } catch { emailStatus = 'FAILED_NETWORK'; }
  }
  if (reserved) await updateFomoAssistanceEmailStatus(dedupeKey, emailStatus, body.auditTest === true, phoneCountry).catch(() => undefined);
  const message = encodeURIComponent('Salam, saya perlukan bantuan untuk claim Bonus 100 Kredit Launch Pack AffiMatik.');
  return NextResponse.json({ success: true, emailStatus, whatsappUrl: `https://wa.me/60195216867?text=${message}`, marketingConsent: body.marketingConsent === true });
}
