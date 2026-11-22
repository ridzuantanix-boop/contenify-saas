import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { getFomoAdminReport } from '@/lib/billing/fomo-bonus';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try { return NextResponse.json({ success: true, report: await getFomoAdminReport() }); }
  catch { return NextResponse.json({ error: 'Laporan FOMO tidak tersedia.' }, { status: 503 }); }
}
