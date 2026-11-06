import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { affiliateDb } from '@/lib/db/affiliate-ledger';


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

  const baseUrl = 'https://affimatik.online';

  let clicks = 0;
  let registrations = 0;
  let qualifiedCustomers = 0;
  let availableCommissionsMyr = 0;
  let outstandingClawbackMyr = 0;
  const campaigns: Record<string, number> = {};
  if (partner?.status === 'APPROVED' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { base, headers } = affiliateDb();
      const [eventsResponse, commissionResponse, clawbackResponse] = await Promise.all([
        fetch(`${base}/rest/v1/affiliate_referral_events?affiliate_id=eq.${encodeURIComponent(partner.id)}&select=event_type,referred_user_id,campaign&limit=10000`, { headers }),
        fetch(`${base}/rest/v1/affiliate_commissions?affiliate_id=eq.${encodeURIComponent(partner.id)}&select=workspace_id,amount_myr,status,available_at,payout_request_id&limit=10000`, { headers }),
        fetch(`${base}/rest/v1/affiliate_clawbacks?affiliate_id=eq.${encodeURIComponent(partner.id)}&status=eq.OPEN&select=amount_myr&limit=10000`, { headers }),
      ]);
      if (!eventsResponse.ok || !commissionResponse.ok || !clawbackResponse.ok) throw new Error('DB read failed');
      const events = await eventsResponse.json() as Array<{ event_type: string; referred_user_id: string | null; campaign: string | null }>;
      const ledger = await commissionResponse.json() as Array<{ workspace_id: string; amount_myr: number; status: string; available_at: string; payout_request_id: string | null }>;
      const clawbacks = await clawbackResponse.json() as Array<{ amount_myr: number }>;
      outstandingClawbackMyr = clawbacks.reduce((sum, row) => sum + Number(row.amount_myr), 0);
      clicks = events.filter((event) => event.event_type === 'CLICK').length;
      for (const event of events) if (event.event_type === 'CLICK') campaigns[event.campaign || 'Tanpa kempen'] = (campaigns[event.campaign || 'Tanpa kempen'] || 0) + 1;
      registrations = events.filter((event) => event.event_type === 'REGISTRATION').length;
      qualifiedCustomers = new Set(ledger.filter((entry) => entry.status !== 'REVERSED').map((entry) => entry.workspace_id)).size;
      availableCommissionsMyr = ledger.filter((entry) => ['PENDING', 'APPROVED', 'PAYABLE'].includes(entry.status) && !entry.payout_request_id && Date.parse(entry.available_at) <= Date.now()).reduce((sum, entry) => sum + Number(entry.amount_myr), 0);
    } catch { return NextResponse.json({ error: 'Statistik affiliate tidak tersedia.' }, { status: 503 }); }
  }

  const stats = {
    status: partner?.status || 'NOT_APPLIED',
    referralCode: partner?.status === 'APPROVED' ? partner.referralCode : '',
    referralUrl: partner?.status === 'APPROVED' ? `${baseUrl}/?ref=${partner.referralCode}` : '',
    commissionRate: partner?.status === 'APPROVED' ? 10.0 : 0,
    clicks,
    registrations,
    qualifiedCustomers,
    availableCommissionsMyr,
    outstandingClawbackMyr,
    campaigns,
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
