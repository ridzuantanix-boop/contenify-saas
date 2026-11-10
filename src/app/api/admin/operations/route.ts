import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';
import { reconcileOrphanAccounts } from '@/lib/db/reconcile';
import { qrRpc } from '@/lib/billing/qr-checkout';


/**
 * POST /api/admin/operations
 * Unified Administrative Control Endpoint:
 * - manual_verify_payment: Audited manual verification of bank transfer / FPX orders
 * - adjust_customer_credits: Audited credit adjustments
 * - toggle_generation_pause: Emergency circuit breaker / generation freeze
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'Akses Ditolak: Hanya pentadbir sah dibenarkan melakukan operasi ini.' },
      { status: 403 }
    );
  }

  const adminEmail = auth.userId || 'admin@affimatik.internal';

  try {
    const body = await req.json();
    const { action } = body;

    // Reconcile Orphan Accounts Idempotently
    if (action === 'reconcile_accounts') {
      const report = await reconcileOrphanAccounts();
      await DurableStore.recordAuditLog(
        adminEmail,
        'ACCOUNTS_RECONCILED',
        'SYSTEM',
        'reconcile',
        { report }
      );
      return NextResponse.json({ success: true, report });
    }

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
      if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId) || typeof referenceNote !== 'string' || !referenceNote.trim() || referenceNote.length > 200) {
        return NextResponse.json({ error: 'ID pesanan dan rujukan bayaran bank/gateway yang disahkan diperlukan.' }, { status: 400 });
      }

      const order = await DurableStore.getOrder(orderId);
      if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemui.' }, { status: 404 });
      // Unit smoke tests use the isolated in-memory store. Real PostgreSQL RPC
      // behavior (including provisional idempotency) is covered separately.
      const settlement = order.gatewayProvider === 'qr_manual' && !(process.env.VITEST && !process.env.SUPABASE_URL)
        ? await qrRpc('verify_qr_order_payment_atomic', { p_order_id: orderId, p_bank_reference: referenceNote.trim(), p_admin: adminEmail })
        : await DurableStore.settleOrder(orderId, referenceNote.trim(), { verifiedByAdmin: adminEmail, verifiedAt: new Date().toISOString() });
      if (!settlement.success) {
        return NextResponse.json({ error: settlement.error || 'Bayaran tidak dapat disahkan.', settlement }, { status: 409 });
      }

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

    if (action === 'reject_qr_provisional') {
      const { orderId, reason } = body;
      if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId) || typeof reason !== 'string' || reason.trim().length < 8 || reason.length > 500) {
        return NextResponse.json({ error: 'ID pesanan dan sebab penolakan diperlukan.' }, { status: 400 });
      }
      const result = await qrRpc('reject_qr_provisional_order_atomic', { p_order_id: orderId, p_admin: adminEmail, p_reason: reason.trim() });
      if (result.success !== true) return NextResponse.json({ error: result.error || 'Kredit provisional tidak dapat dibalikkan.' }, { status: 409 });
      return NextResponse.json(result);
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
  if (!auth.isAuthorized || auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Akses Ditolak.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'orders';

  if (view === 'metrics') {
    const [metrics,nexabotQueue] = await Promise.all([DurableStore.getSoftLaunchMetrics(),DurableStore.getNexabotQueueMetrics()]);
    if (process.env.NEXABOT_API_KEY) {
      try {
        const balanceResponse = await fetch(`${process.env.NEXABOT_BASE_URL || 'https://nexabot.id'}/api/v1/credits`, { headers: { Authorization: `Bearer ${process.env.NEXABOT_API_KEY}`, 'X-API-Key': process.env.NEXABOT_API_KEY }, cache: 'no-store' });
        if (balanceResponse.ok) {
          const balance = await balanceResponse.json() as Record<string,unknown>;
          nexabotQueue.provider_balance = Number(balance.credit ?? balance.credits ?? balance.balance ?? NaN);
          if (!Number.isFinite(nexabotQueue.provider_balance)) nexabotQueue.provider_balance = null;
        }
      } catch { nexabotQueue.provider_balance = null; }
    }
    return NextResponse.json({ success: true, metrics: { ...metrics, nexabotQueue } });
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

  if (view === 'users') {
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;
    const result = await DurableStore.listRegisteredUsers({ search, limit, offset });
    return NextResponse.json({ success: true, ...result });
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
