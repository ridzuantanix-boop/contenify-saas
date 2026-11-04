import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

/**
 * GET /api/affiliate/stats
 * Returns the customer's affiliate partner details, 20% commission rates, and commission ledger.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Akses Ditolak: Sila log masuk.' }, { status: 401 });
  }

  let partner = await DurableStore.getAffiliatePartner(session.userId);

  // Auto-provision affiliate code if not already assigned
  if (!partner) {
    const code = `${session.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}${Math.floor(10 + Math.random() * 90)}`;
    partner = await DurableStore.createAffiliatePartner(session.userId, code) as any;
  }

  const commissions = await DurableStore.listAffiliateCommissions(partner?.id || partner?.referralCode);

  const stats = {
    referralCode: partner?.referralCode || '',
    referralUrl: `https://contenify-saas.pages.dev/?ref=${partner?.referralCode}`,
    commissionRate: 20.0,
    totalReferrals: commissions.length,
    pendingCommissionsMyr: commissions
      .filter((c) => c.status === 'PENDING')
      .reduce((sum, c) => sum + c.amountMyr, 0),
    approvedCommissionsMyr: commissions
      .filter((c) => c.status === 'APPROVED' || c.status === 'PAYABLE')
      .reduce((sum, c) => sum + c.amountMyr, 0),
    paidCommissionsMyr: commissions
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + c.amountMyr, 0),
    commissionsHistory: commissions.slice(0, 20),
  };

  return NextResponse.json(stats);
}

/**
 * POST /api/affiliate/stats
 * Customizes or updates payout details (bank name, account number).
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Akses Ditolak: Sila log masuk.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { payoutBank, payoutAccountNumber, payoutAccountHolder } = body;

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/affiliate_partners?user_id=eq.${encodeURIComponent(session.userId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          payout_bank: payoutBank,
          payout_account_number: payoutAccountNumber,
          payout_account_holder: payoutAccountHolder,
        }),
      });
    }

    return NextResponse.json({ success: true, message: 'Maklumat pembayaran komisen affiliate berjaya dikemas kini.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
