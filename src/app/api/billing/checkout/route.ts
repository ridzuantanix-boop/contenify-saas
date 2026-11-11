import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { createCheckout } from '@/lib/billing/checkout';
import { DurableStore } from '@/lib/db/store';
import { enforceCheckoutRateLimit, getQrConfig } from '@/lib/billing/qr-checkout';
import { isTutorialGuestSession } from '@/lib/auth/tutorial-guest';


/**
 * POST /api/billing/checkout
 * Initiate checkout for plan subscription or credit purchase.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Akses Ditolak: Anda mesti log masuk untuk memulakan langganan.' },
      { status: 401 }
    );
  }
  if (isTutorialGuestSession(session)) {
    return NextResponse.json({ error: 'Checkout tidak tersedia dalam workspace tutorial.' }, { status: 403 });
  }

  try {
    // Authoritative Server-Controlled Public Checkout Feature Flag
    const qrConfig = await getQrConfig();
    const isPublicCheckoutEnabled = process.env.PUBLIC_CHECKOUT_ENABLED === 'true' && qrConfig.enabled && qrConfig.autoFulfillEnabled && qrConfig.instantFullAccessEnabled && qrConfig.recipientConfirmed && Boolean(qrConfig.qrObjectKey);
    if (!isPublicCheckoutEnabled) {
      return NextResponse.json(
        {
          error: 'PAYMENTS_COMING_SOON',
          code: 'PAYMENTS_COMING_SOON',
          message: 'Checkout QR belum tersedia. Akaun baharu masih menerima 20 kredit percuma.',
          status: 'COMING_SOON',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { planId, paymentMethod, referralCode } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Sila pilih pelan langganan.' }, { status: 400 });
    }
    if (paymentMethod !== undefined && paymentMethod !== 'qr') return NextResponse.json({ error: 'Hanya pembayaran QR manual tersedia.' }, { status: 400 });
    await enforceCheckoutRateLimit(session.userId);

    // Check referral cookie if not supplied in body
    const cookieRef = req.cookies.get('affimatik_ref')?.value;
    let finalReferral = typeof referralCode === 'string' ? referralCode.trim().toUpperCase() : cookieRef;
    // Registration attribution survives browser changes and expired cookies.
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const profile = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(session.userId)}&select=referred_by_affiliate_id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!profile.ok) throw new Error('Atribusi rujukan tidak dapat disemak.');
      const rows = await profile.json() as Array<{ referred_by_affiliate_id: string | null }>;
      if (rows[0]?.referred_by_affiliate_id) {
        const partner = await fetch(`${process.env.SUPABASE_URL}/rest/v1/affiliate_partners?id=eq.${encodeURIComponent(rows[0].referred_by_affiliate_id)}&select=referral_code,status&limit=1`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        if (!partner.ok) throw new Error('Affiliate rujukan tidak dapat disemak.');
        const partners = await partner.json() as Array<{ referral_code: string; status: string }>;
        if (partners[0]?.status === 'APPROVED') finalReferral = partners[0].referral_code;
      }
    }
    if (finalReferral) {
      if (!/^[A-Z0-9_-]{4,50}$/.test(finalReferral)) return NextResponse.json({ error: 'Kod rujukan tidak sah.' }, { status: 400 });
      const partner = await DurableStore.getAffiliatePartner(finalReferral);
      if (!partner || partner.status !== 'APPROVED' || partner.userId === session.userId) {
        return NextResponse.json({ error: 'Kod rujukan tidak layak.' }, { status: 400 });
      }
    }

    const result = await createCheckout({
      workspaceId: session.workspaceId,
      userId: session.userId,
      planId,
      paymentMethod: 'qr',
      referralCode: finalReferral,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'CHECKOUT_RATE_LIMIT') return NextResponse.json({ error: 'Terlalu banyak checkout dibuat. Sila tunggu 10 minit.', code: msg }, { status: 429 });
    if (msg === 'TOPUP_REQUIRES_ACTIVE_PAID_SUBSCRIPTION') return NextResponse.json({ error: 'Top-up hanya tersedia untuk pelanggan dengan langganan berbayar yang masih aktif.', code: msg }, { status: 403 });
    if (msg === 'LAUNCH_PACK_ALREADY_PURCHASED') return NextResponse.json({ error: 'Launch Pack hanya boleh dibeli sekali bagi setiap pelanggan.', code: msg }, { status: 409 });
    if (msg === 'UNRESOLVED_QR_ORDER_EXISTS') return NextResponse.json({ error: 'Selesaikan pesanan QR sedia ada dahulu sebelum membuat pesanan baharu.', code: msg }, { status: 409 });
    if (msg === 'ACCOUNT_PAYMENT_HOLD') return NextResponse.json({ error: 'Checkout dibekukan sementara kerana akaun sedang melalui semakan pembayaran.', code: msg }, { status: 403 });
    return NextResponse.json({ error: msg === 'QR_CHECKOUT_NOT_CONFIGURED' ? 'Checkout QR belum dikonfigurasi.' : msg }, { status: 500 });
  }
}
