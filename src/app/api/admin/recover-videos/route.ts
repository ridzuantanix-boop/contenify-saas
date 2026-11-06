import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';
import { DurableStore } from '@/lib/db/store';
import { ingestProviderMp4 } from '@/lib/storage/supabase-assets';

export const runtime = 'edge';

function authorized(role: string | undefined, valid: boolean) { return valid && role === 'superadmin'; }

async function candidates() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.SUPABASE_URL;
  if (!key || !base) throw new Error('Database unavailable');
  const url = `${base}/rest/v1/video_jobs?status=eq.COMPLETED&result_video_r2_key=is.null&result_video_url=not.is.null&select=id,workspace_id,provider,result_video_url&order=created_at.asc&limit=10`;
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error('Candidate lookup failed');
  return response.json() as Promise<Array<{ id: string; workspace_id: string; provider: 'nexabot' | 'runninghub'; result_video_url: string }>>;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!authorized(auth.role, auth.isAuthorized)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try { return NextResponse.json({ candidates: (await candidates()).map(({ id, provider }) => ({ id, provider })) }); }
  catch { return NextResponse.json({ error: 'Semakan sejarah gagal.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!authorized(auth.role, auth.isAuthorized)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try {
    const rows = await candidates();
    const results: Array<{ id: string; recovered: boolean; reason?: string }> = [];
    for (const row of rows) {
      try {
        const stored = await ingestProviderMp4(row.provider, row.result_video_url, row.workspace_id, row.id);
        await DurableStore.updateJobStatus(row.id, { videoObjectKey: stored.objectKey, videoUrl: `/api/videos/${row.id}/stream` });
        results.push({ id: row.id, recovered: true });
      } catch (error) {
        results.push({ id: row.id, recovered: false, reason: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    await DurableStore.recordAuditLog(auth.userId || 'admin', 'HISTORICAL_VIDEO_RECOVERY', 'VIDEO_JOB', 'batch', { results });
    return NextResponse.json({ results });
  } catch { return NextResponse.json({ error: 'Pemulihan sejarah gagal.' }, { status: 503 }); }
}
