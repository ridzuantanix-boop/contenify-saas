import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { affiliateRpc } from '@/lib/db/affiliate-ledger';


export async function POST(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.orderId) || typeof body.reason !== 'string' || body.reason.trim().length < 8 || body.reason.length > 500 || typeof body.reference !== 'string' || !body.reference.trim() || body.reference.length > 200) {
    return NextResponse.json({ error: 'ID pesanan, sebab dan rujukan refund bank/gateway yang disahkan diperlukan.' }, { status: 400 });
  }
  try {
    const result = await affiliateRpc('reverse_affiliate_commission_atomic', { p_order_id: body.orderId, p_admin: auth.userId || 'admin', p_reason: body.reason.trim(), p_refund_reference: body.reference.trim() });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: 'Refund tidak dapat direkodkan.' }, { status: 503 }); }
}
