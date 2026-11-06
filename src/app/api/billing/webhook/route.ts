import { NextRequest, NextResponse } from 'next/server';


/**
 * POST /api/billing/webhook
 * Automated payment webhooks are explicitly DISABLED for launch until a real payment
 * provider (ToyyibPay/Stripe) is integrated with its full documented signature verification.
 * Commercial launch strictly operates on verified manual bank transfers with explicit
 * administrative verification via /api/admin/operations (manual_verify_payment).
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'Automated payment webhooks are disabled for launch. Subscriptions and credits are settled via manual bank transfer with explicit administrative receipt verification.',
      status: 'WEBHOOKS_DISABLED',
    },
    { status: 403 }
  );
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      status: 'WEBHOOKS_DISABLED',
      message: 'Automated payment webhooks are currently disabled.',
    },
    { status: 403 }
  );
}
