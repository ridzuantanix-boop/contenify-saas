import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

const categories = new Set(['cta_cutoff','dialogue_cutoff','robotic_voice','lip_sync','visual_motion','product_identity','niqab_exposure','audio_broken','other']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  const origin = req.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ error: 'Permintaan tidak dibenarkan.' }, { status: 403 }); }
    catch { return NextResponse.json({ error: 'Permintaan tidak dibenarkan.' }, { status: 403 }); }
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Laporan tidak tersedia.' }, { status: 503 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const jobId = typeof body.jobId === 'string' && uuid.test(body.jobId) ? body.jobId : '';
  const category = typeof body.category === 'string' && categories.has(body.category) ? body.category : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!jobId || !category || description.length > 2000) return NextResponse.json({ error: 'Maklumat laporan tidak sah.' }, { status: 400 });
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const lookup = await fetch(`${base}/rest/v1/video_jobs?id=eq.${jobId}&workspace_id=eq.${session.workspaceId}&status=eq.COMPLETED&result_video_r2_key=not.is.null&select=id,preset_id,provider,created_at,result_video_r2_key&limit=1`, { headers, cache: 'no-store' });
    if (!lookup.ok) throw new Error('lookup');
    const jobs = await lookup.json() as Array<{ id: string; preset_id: string; provider: string; created_at: string; result_video_r2_key: string }>;
    if (!jobs.length) return NextResponse.json({ error: 'Video tidak ditemui dalam akaun anda.' }, { status: 404 });
    const job = jobs[0];
    const saved = await fetch(`${base}/rest/v1/video_quality_reports?on_conflict=job_id,user_id,category`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({
        job_id: job.id, workspace_id: session.workspaceId, user_id: session.userId,
        video_object_key: job.result_video_r2_key, style_id: job.preset_id,
        provider: job.provider, generation_at: job.created_at, category, description,
      }),
    });
    if (!saved.ok) throw new Error('save');
    return NextResponse.json({ success: true, message: 'Laporan masalah video diterima untuk semakan.' });
  } catch {
    return NextResponse.json({ error: 'Laporan tidak dapat disimpan sekarang.' }, { status: 503 });
  }
}
