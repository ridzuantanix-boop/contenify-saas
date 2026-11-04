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
