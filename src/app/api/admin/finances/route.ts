import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { calculateFinancialSafety } from '@/lib/admin/finance-calculator';
import { getCommercialOperationsMetrics } from '@/lib/admin/commercial-operations';


/**
 * GET /api/admin/finances
 * Protected financial health, protected operating reserve, and safe-to-withdraw owner metrics.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'Akses Ditolak: Hanya pentadbir sah dibenarkan melihat metrik kewangan.' },
      { status: 403 }
    );
  }

  try {
    const [metrics,commercial] = await Promise.all([calculateFinancialSafety(),getCommercialOperationsMetrics()]);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      finances: metrics,
      commercial,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
