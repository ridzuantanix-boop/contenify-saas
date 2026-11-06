import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { affiliateDb, affiliateRpc } from '@/lib/db/affiliate-ledger';


export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const partner = await DurableStore.getAffiliatePartner(session.userId);
    if (!partner || partner.status !== 'APPROVED') return NextResponse.json({ error: 'Affiliate belum diluluskan.' }, { status: 403 });
    const { base, headers } = affiliateDb();
    const [payoutRes, partnerRes, commissionRes] = await Promise.all([
      fetch(`${base}/rest/v1/affiliate_payout_requests?affiliate_id=eq.${encodeURIComponent(partner.id)}&select=id,amount_myr,status,requested_at,reviewed_at,paid_at,payout_reference&order=requested_at.desc&limit=100`, { headers }),
      fetch(`${base}/rest/v1/affiliate_partners?id=eq.${encodeURIComponent(partner.id)}&select=payout_bank,payout_account_number,payout_account_holder`, { headers }),
      fetch(`${base}/rest/v1/affiliate_commissions?affiliate_id=eq.${encodeURIComponent(partner.id)}&select=amount_myr,status,available_at,payout_request_id`, { headers }),
    ]);
    if (!payoutRes.ok || !partnerRes.ok || !commissionRes.ok) throw new Error('DB read failed');
    const [requests, details, commissions] = await Promise.all([payoutRes.json(), partnerRes.json(), commissionRes.json()]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>];
    const now = Date.now();
    const available = commissions.filter((entry) => ['PENDING', 'APPROVED', 'PAYABLE'].includes(String(entry.status)) && !entry.payout_request_id && Date.parse(String(entry.available_at)) <= now).reduce((sum, entry) => sum + Number(entry.amount_myr), 0);
    const account = String(details[0]?.payout_account_number || '');
    return NextResponse.json({
      availableMyr: Math.round(available * 100) / 100,
      minimumMyr: 50,
      destination: details.length ? { bank: details[0].payout_bank, holder: details[0].payout_account_holder, maskedAccount: account ? `••••${account.slice(-4)}` : '' } : null,
      requests,
    });
  } catch { return NextResponse.json({ error: 'Sejarah payout tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const partner = await DurableStore.getAffiliatePartner(session.userId);
    if (!partner || partner.status !== 'APPROVED') return NextResponse.json({ error: 'Affiliate belum diluluskan.' }, { status: 403 });
    const result = await affiliateRpc('request_affiliate_payout_atomic', { p_affiliate_id: partner.id });
    if (!result.success) return NextResponse.json({ error: result.error || 'Permintaan tidak layak.' }, { status: 409 });
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: 'Permintaan payout gagal.' }, { status: 503 }); }
}
