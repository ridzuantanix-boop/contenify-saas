import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';


/**
 * GET /api/admin/diagnostics
 * Strict administrative endpoint for infrastructure diagnostics and deployment health.
 * Access restricted to verified administrators via secure cookie or x-admin-key.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized || auth.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'Akses Ditolak: Hanya pentadbir sah dibenarkan melihat diagnostik sistem.' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    status: 'CONFIGURATION_ONLY',
    version: '3.0.0',
    buildCommit: process.env.CF_PAGES_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
    deployedBranch: process.env.CF_PAGES_BRANCH || null,
    runtime: {
      nodeCompatProcessEnv: typeof process !== 'undefined' && typeof process.env === 'object',
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasSessionSecret: Boolean(process.env.SESSION_SECRET),
      hasCronSecret: Boolean(process.env.CRON_SECRET),
      hasNexabotKey: Boolean(process.env.NEXABOT_API_KEY),
      hasRunningHubKey: Boolean(process.env.RUNNINGHUB_API_KEY),
      hasSupabaseStorageConfiguration: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    systemTime: new Date().toISOString(),
  });
}
