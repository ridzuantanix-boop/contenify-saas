import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

/**
 * GET /api/affiliate/stats
 * Returns the customer's affiliate application and commission ledger.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Akses Ditolak: Sila log masuk.' }, { status: 401 });
  }

  const partner = await DurableStore.getAffiliatePartner(session.userId);

  const commissions = partner ? await DurableStore.listAffiliateCommissions(partner.id) : [];

  const host = req.headers.get('host');
  const baseUrl = host ? `https://${host}` : 'https://affimatik.online';

  const stats = {
    status: partner?.status || 'NOT_APPLIED',
    referralCode: partner?.status === 'APPROVED' ? partner.referralCode : '',
    referralUrl: partner?.status === 'APPROVED' ? `${baseUrl}/?ref=${partner.referralCode}` : '',
    commissionRate: partner?.status === 'APPROVED' ? 10.0 : 0,
    totalReferrals: null, // Click and registration events are not yet persisted.
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
    const partner = await DurableStore.getAffiliatePartner(session.userId);
    if (!partner || partner.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Keahlian affiliate belum diluluskan.' }, { status: 403 });
    }
    const body = await req.json();
    const { payoutBank, payoutAccountNumber, payoutAccountHolder } = body;

    if ([payoutBank, payoutAccountNumber, payoutAccountHolder].some((value) => typeof value !== 'string' || value.trim().length < 2 || value.length > 120)) {
      return NextResponse.json({ error: 'Maklumat pembayaran tidak sah.' }, { status: 400 });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const update = await fetch(`${process.env.SUPABASE_URL}/rest/v1/affiliate_partners?user_id=eq.${encodeURIComponent(session.userId)}`, {
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
      if (!update.ok) throw new Error('Maklumat pembayaran tidak dapat disimpan.');
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('Storan pembayaran tidak tersedia.');
    }

    return NextResponse.json({ success: true, message: 'Maklumat pembayaran komisen affiliate berjaya dikemas kini.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
