import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';


export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try { return NextResponse.json({ applications: await DurableStore.listAffiliatePartners() }); }
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
    const updated = await DurableStore.reviewAffiliatePartner(body.id, body.status, auth.userId || 'admin');
    if (!updated) return NextResponse.json({ error: 'Permohonan tidak ditemui atau tidak layak dikemas kini.' }, { status: 409 });
    await DurableStore.recordAuditLog(auth.userId || 'admin', 'AFFILIATE_REVIEW', 'AFFILIATE', body.id, { status: body.status });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Keputusan tidak dapat disimpan.' }, { status: 503 }); }
}
