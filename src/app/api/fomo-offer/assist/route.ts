import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { fomoFeatureEnabled, initializeFomoOffer, recordFomoEvent, visitorIdFromRequest, type FomoOfferState } from '@/lib/billing/fomo-bonus';

function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '');
  if (/^01\d{8,9}$/.test(compact)) return `60${compact.slice(1)}`;
  if (/^\+?60\d{9,10}$/.test(compact)) return compact.replace(/^\+/, '');
  if (/^\+?[1-9]\d{7,14}$/.test(compact)) return compact.replace(/^\+/, '');
  return '';
}

export async function POST(req: NextRequest) {
  if (!fomoFeatureEnabled()) return NextResponse.json({ error: 'Bantuan tawaran tidak aktif.' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as { whatsapp?: string; privacyAccepted?: boolean; marketingConsent?: boolean };
  const phone = normalizePhone(String(body.whatsapp || ''));
  if (!phone || body.privacyAccepted !== true) return NextResponse.json({ error: 'Masukkan nombor WhatsApp yang sah dan sahkan notis privasi.' }, { status: 400 });
  const visitorId = visitorIdFromRequest(req);
  const session = await getSessionFromRequest(req).catch(() => null);
  const state: FomoOfferState = await initializeFomoOffer(visitorId, session?.userId).catch(() => ({ enabled: false }));
  const hourKey = new Date().toISOString().slice(0, 13);
  let emailStatus = 'NOT_CONFIGURED';
  const ownerEmail = process.env.FOMO_OWNER_NOTIFICATION_EMAIL || '';
  if (process.env.RESEND_API_KEY && ownerEmail) {
    const claim = state.claim;
    const checkoutUrl = `${process.env.APP_BASE_URL || 'https://affimatik.online'}/register?intent=launch_pack&promo=fomo_v1`;
    const text = [`Permintaan bantuan Bonus 100 Kredit`, `Masa: ${new Date().toISOString()}`, `WhatsApp: +${phone}`, `Claim: ${claim?.id || 'Belum diclaim'}`, `Status: ${claim?.status || 'Belum diclaim'}`, `Tamat pembayaran: ${claim?.paymentExpiresAt || '—'}`, `Checkout: ${checkoutUrl}`].join('\n');
    try {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.PAYMENT_EMAIL_FROM || 'AffiMatik <noreply@affimatik.online>', to: [ownerEmail], subject: '[AffiMatik] Permintaan Bantuan / Bonus 100 Kredit', text, html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[char] || char))}</pre>` }) });
      emailStatus = response.ok ? 'SENT' : `FAILED_${response.status}`;
    } catch { emailStatus = 'FAILED_NETWORK'; }
  }
  await recordFomoEvent({ visitorId, userId: session?.userId, workspaceId: session?.workspaceId, campaignId: state.campaign_id, claimId: state.claim?.id, eventName: 'fomo_whatsapp_request', dedupeKey: `whatsapp:${visitorId}:${hourKey}`, metadata: { emailStatus, phoneCountry: phone.startsWith('60') ? 'MY' : 'INTL' } }).catch(() => false);
  const message = encodeURIComponent('Salam, saya perlukan bantuan untuk claim Bonus 100 Kredit Launch Pack AffiMatik.');
  return NextResponse.json({ success: true, emailStatus, whatsappUrl: `https://wa.me/60195216867?text=${message}`, marketingConsent: body.marketingConsent === true });
}
