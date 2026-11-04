import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

/**
 * POST /api/admin/operations
 * Unified Administrative Control Endpoint:
 * - manual_verify_payment: Audited manual verification of bank transfer / FPX orders
 * - adjust_customer_credits: Audited credit adjustments
 * - toggle_generation_pause: Emergency circuit breaker / generation freeze
 * - manage_affiliate_commission: Approve, pay, or reverse commissions
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { error: 'Akses Ditolak: Hanya pentadbir sah dibenarkan melakukan operasi ini.' },
      { status: 403 }
    );
  }

  const adminEmail = auth.userId || 'admin@affimatik.internal';

  try {
    const body = await req.json();
    const { action } = body;

    // 1. Manual Customer Activation (Complimentary Early Access or Manually Paid)
    if (action === 'manual_activate_customer') {
      const {
        workspaceId,
        userId,
        activationType,
        planId,
        credits,
        tier,
        amountPaidMyr,
        paymentReference,
        reason,
      } = body;

      const result = await DurableStore.manualActivateCustomer({
        workspaceId,
        userId,
        activationType,
        planId,
        credits,
        tier,
        amountPaidMyr,
        paymentReference,
        reason,
        adminEmail,
      });

      return NextResponse.json(result);
    }

    // 2. Lookup Customer by Email
    if (action === 'lookup_customer') {
      const { email } = body;
      if (!email) {
        return NextResponse.json({ error: 'Emel diperlukan.' }, { status: 400 });
      }

      const customer = await DurableStore.findCustomerByEmail(email);
      if (!customer) {
        return NextResponse.json({ error: 'Pelanggan dengan emel ini tidak ditemui.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, customer });
    }

    // 3. Manual Payment Verification
    if (action === 'manual_verify_payment') {
      const { orderId, referenceNote } = body;
      if (!orderId) {
        return NextResponse.json({ error: 'orderId diperlukan.' }, { status: 400 });
      }

      const settlement = await DurableStore.settleOrder(orderId, referenceNote || `manual_admin_${Date.now()}`, {
        verifiedByAdmin: adminEmail,
        verifiedAt: new Date().toISOString(),
      });

      await DurableStore.recordAuditLog(
        adminEmail,
        'MANUAL_PAYMENT_VERIFIED',
        'ORDER',
        orderId,
        { referenceNote, settlement }
      );

      return NextResponse.json({
        success: true,
        message: 'Pesanan berjaya disahkan dan kredit diperuntukkan.',
        settlement,
      });
    }

    // 2. Adjust Customer Credits (Durable, Transactional & Audited)
    if (action === 'adjust_customer_credits') {
      const { workspaceId, amount, reason } = body;
      if (!workspaceId || typeof amount !== 'number') {
        return NextResponse.json({ error: 'workspaceId dan amount nombor diperlukan.' }, { status: 400 });
      }

      const result = await DurableStore.adjustCredits(workspaceId, amount, reason, adminEmail);

      return NextResponse.json({
        success: true,
        message: `Kredit berjaya diselaraskan (${amount > 0 ? `+${amount}` : amount}). Baki baharu: ${result.newBalance}`,
        balance: result.newBalance,
        adjustedBy: result.adjustedBy,
      });
    }

    // 3. Emergency Generation Pause / Circuit Breaker
    if (action === 'toggle_generation_pause') {
      const { paused, reason } = body;
      await DurableStore.setSystemSettings('generation_status', {
        paused: Boolean(paused),
        reason: reason || (paused ? 'Dijeda sementara oleh pentadbir bagi tujuan penyelenggaraan.' : ''),
        pausedBy: adminEmail,
        updatedAt: new Date().toISOString(),
      });

      await DurableStore.recordAuditLog(
        adminEmail,
        paused ? 'EMERGENCY_GENERATION_PAUSED' : 'GENERATION_RESUMED',
        'SYSTEM',
        'generation_status',
        { paused, reason }
      );

      return NextResponse.json({
        success: true,
        message: paused ? 'Penjanaan video di seluruh sistem telah DIJEDA.' : 'Penjanaan video telah DITERUSKAN.',
        isPaused: Boolean(paused),
      });
    }

    // 4. Manage Affiliate Commission (Approve / Pay / Reverse)
    if (action === 'manage_affiliate_commission') {
      const { commissionId, newStatus, payoutReference } = body;
      if (!commissionId || !newStatus) {
        return NextResponse.json({ error: 'commissionId dan newStatus diperlukan.' }, { status: 400 });
      }

      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/affiliate_commissions?id=eq.${encodeURIComponent(commissionId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            status: newStatus,
            payout_reference: payoutReference,
            approved_at: newStatus === 'APPROVED' ? new Date().toISOString() : undefined,
            paid_at: newStatus === 'PAID' ? new Date().toISOString() : undefined,
          }),
        });
      }

      await DurableStore.recordAuditLog(
        adminEmail,
        `AFFILIATE_COMMISSION_${newStatus}`,
        'COMMISSION',
        commissionId,
        { newStatus, payoutReference }
      );

      return NextResponse.json({
        success: true,
        message: `Status komisen affiliate dikemas kini kepada ${newStatus}.`,
      });
    }

    return NextResponse.json({ error: 'Tindakan tidak sah.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/admin/operations?view=customers|orders|affiliates
 * Retrieve administrative collections.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: 'Akses Ditolak.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'orders';

  if (view === 'metrics') {
    const metrics = await DurableStore.getSoftLaunchMetrics();
    return NextResponse.json({ success: true, metrics });
  }

  if (view === 'lookup') {
    const email = searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Emel diperlukan untuk carian.' }, { status: 400 });
    }
    const customer = await DurableStore.findCustomerByEmail(email);
    if (!customer) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemui.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, customer });
  }

  if (view === 'orders') {
    const orders = await DurableStore.listOrders(undefined, 100);
    return NextResponse.json({ orders });
  }

  if (view === 'affiliates') {
    const commissions = await DurableStore.listAffiliateCommissions();
    return NextResponse.json({ commissions });
  }

  return NextResponse.json({ error: 'View tidak sah.' }, { status: 400 });
}
