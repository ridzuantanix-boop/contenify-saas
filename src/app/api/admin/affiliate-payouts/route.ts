import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';
import { affiliateDb, affiliateRpc } from '@/lib/db/affiliate-ledger';


export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try {
    const { base, headers } = affiliateDb();
    const response = await fetch(`${base}/rest/v1/affiliate_payout_requests?select=id,affiliate_id,amount_myr,status,requested_at,reviewed_at,paid_at,payout_reference,affiliate_partners(user_id,payout_bank,payout_account_number,payout_account_holder)&order=requested_at.desc&limit=100`, { headers });
    if (!response.ok) throw new Error('DB read failed');
    return NextResponse.json({ requests: await response.json() });
  } catch { return NextResponse.json({ error: 'Permintaan payout tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id) || !['APPROVED', 'PAID', 'REJECTED'].includes(body.action) ||
      (body.action === 'PAID' && (typeof body.reference !== 'string' || !body.reference.trim() || body.reference.length > 200))) {
    return NextResponse.json({ error: 'Keputusan payout tidak sah.' }, { status: 400 });
  }
  try {
    const result = await affiliateRpc('review_affiliate_payout_atomic', { p_request_id: body.id, p_action: body.action, p_admin: auth.userId || 'admin', p_reference: body.reference || null });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 409 });
    await DurableStore.recordAuditLog(auth.userId || 'admin', 'AFFILIATE_PAYOUT', 'PAYOUT', body.id, { action: body.action, reference: body.reference || null });
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: 'Payout tidak dapat dikemas kini.' }, { status: 503 }); }
}
