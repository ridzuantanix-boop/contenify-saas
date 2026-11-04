import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';

export const runtime = 'edge';

/**
 * GET /api/admin/diagnostics
 * Strict administrative endpoint for infrastructure diagnostics and deployment health.
 * Access restricted to verified administrators via secure cookie or x-admin-key.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { error: 'Akses Ditolak: Hanya pentadbir sah dibenarkan melihat diagnostik sistem.' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    status: 'HEALTHY',
    version: '3.0.0',
    buildCommit: process.env.CF_PAGES_COMMIT_SHA || 'ab4cdaf',
    deployedBranch: process.env.CF_PAGES_BRANCH || 'main',
    runtime: {
      nodeCompatProcessEnv: typeof process !== 'undefined' && typeof process.env === 'object',
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasSessionSecret: Boolean(process.env.SESSION_SECRET || process.env.ADMIN_ACCESS_KEY),
      hasCronSecret: Boolean(process.env.CRON_SECRET),
      hasNexabotKey: Boolean(process.env.NEXABOT_API_KEY),
      hasRunningHubKey: Boolean(process.env.RUNNINGHUB_API_KEY),
      hasR2Storage: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
    },
    systemTime: new Date().toISOString(),
  });
}
