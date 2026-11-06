import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { affiliateDb, affiliateRpc } from '@/lib/db/affiliate-ledger';

async function authorize(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  return auth.isAuthorized && auth.role === 'superadmin' ? auth : null;
}

export async function GET(req: NextRequest) {
  if (!await authorize(req)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try {
    const { base, headers } = affiliateDb();
    const response = await fetch(`${base}/rest/v1/credit_refund_debts?outstanding_credits=gt.0&select=order_id,workspace_id,original_credits,outstanding_credits,created_at&order=created_at.desc&limit=100`, { headers, cache: 'no-store' });
    if (!response.ok) throw new Error('Debt query failed');
    return NextResponse.json({ debts: await response.json() });
  } catch { return NextResponse.json({ error: 'Hutang kredit refund tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.orderId) || typeof body.reference !== 'string' || !body.reference.trim() || body.reference.length > 200) {
    return NextResponse.json({ error: 'ID pesanan dan rujukan pemulihan diperlukan.' }, { status: 400 });
  }
  try {
    const result = await affiliateRpc('recover_credit_refund_debt_atomic', { p_order_id: body.orderId, p_admin: auth.userId || 'admin', p_reference: body.reference.trim() });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: 'Hutang kredit tidak dapat dipulihkan.' }, { status: 503 }); }
}
