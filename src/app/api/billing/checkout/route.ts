import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { createCheckout } from '@/lib/billing/checkout';

export const runtime = 'edge';

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

  try {
    // Authoritative Server-Controlled Public Checkout Feature Flag
    const isPublicCheckoutEnabled = process.env.PUBLIC_CHECKOUT_ENABLED === 'true';
    if (!isPublicCheckoutEnabled) {
      return NextResponse.json(
        {
          error: 'PAYMENTS_COMING_SOON',
          code: 'PAYMENTS_COMING_SOON',
          message: 'Pelan berbayar belum dibuka untuk umum. Duit korang simpan dulu! Nikmati 50 kredit percuma anda sekarang untuk cuba jana video.',
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

    // Check referral cookie if not supplied in body
    const cookieRef = req.cookies.get('affimatik_ref')?.value;
    const finalReferral = referralCode || cookieRef;

    const result = await createCheckout({
      workspaceId: session.workspaceId,
      userId: session.userId,
      planId,
      paymentMethod,
      referralCode: finalReferral,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
