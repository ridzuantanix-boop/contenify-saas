import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';
import { affiliateRpc } from '@/lib/db/affiliate-ledger';


export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try {
    const applications = await DurableStore.listAffiliatePartners();
    const enriched = await Promise.all(applications.map(async (application) => {
      try {
        const state = await affiliateRpc('affiliate_partner_state_v1', { p_user_id: application.userId });
        return { ...application, hasEverQualifiedPaidSubscription: state.has_ever_qualified_paid_subscription === true };
      } catch { return { ...application, hasEverQualifiedPaidSubscription: false }; }
    }));
    return NextResponse.json({ applications: enriched });
  }
  catch { return NextResponse.json({ error: 'Senarai permohonan tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !['APPROVED', 'REJECTED', 'SUSPENDED'].includes(body.status)) {
    return NextResponse.json({ error: 'Permohonan atau keputusan tidak sah.' }, { status: 400 });
  }
  try {
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (body.status === 'SUSPENDED' && reason.length < 8) return NextResponse.json({ error: 'Sebab penggantungan audit diperlukan.' }, { status: 400 });
    const updated = await DurableStore.reviewAffiliatePartner(body.id, body.status, auth.userId || 'admin', reason || undefined);
    if (!updated) return NextResponse.json({ error: 'Permohonan tidak ditemui atau tidak layak dikemas kini.' }, { status: 409 });
    await DurableStore.recordAuditLog(auth.userId || 'admin', 'AFFILIATE_REVIEW', 'AFFILIATE', body.id, { status: body.status, reason: reason || null });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Keputusan tidak dapat disimpan.' }, { status: 503 }); }
}
