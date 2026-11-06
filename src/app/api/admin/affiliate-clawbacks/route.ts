import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { affiliateDb, affiliateRpc } from '@/lib/db/affiliate-ledger';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try {
    const { base, headers } = affiliateDb();
    const response = await fetch(`${base}/rest/v1/affiliate_clawbacks?select=id,affiliate_id,order_id,amount_myr,status,created_at,recovered_at,recovery_reference&order=created_at.desc&limit=100`, { headers });
    if (!response.ok) throw new Error('DB read failed');
    return NextResponse.json({ clawbacks: await response.json() });
  } catch { return NextResponse.json({ error: 'Clawback tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.reference !== 'string' || !body.reference.trim() || body.reference.length > 200) return NextResponse.json({ error: 'ID dan rujukan pemulihan diperlukan.' }, { status: 400 });
  try {
    const result = await affiliateRpc('recover_affiliate_clawback_atomic', { p_clawback_id: body.id, p_admin: auth.userId || 'admin', p_reference: body.reference.trim() });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: 'Clawback tidak dapat dikemas kini.' }, { status: 503 }); }
}
