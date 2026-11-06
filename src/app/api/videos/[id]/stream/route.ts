import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { privateAssetResponse } from '@/lib/storage/supabase-assets';


export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  const { id } = await context.params;
  const job = await DurableStore.getJob(id);
  const adminQaPreview = session.role === 'superadmin' && job?.status === 'QA_PENDING';
  if (!job || (!adminQaPreview && job.workspaceId !== session.workspaceId) || !job.videoObjectKey || (job.status !== 'COMPLETED' && !adminQaPreview)) {
    return NextResponse.json({ error: 'Video tidak ditemui.' }, { status: 404 });
  }
  try {
    const upstream = await privateAssetResponse(job.videoObjectKey, req.headers.get('range') || undefined);
    if (upstream.status === 416) {
      const headers = new Headers({ 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' });
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) headers.set('Content-Range', contentRange);
      return new Response(null, { status: 416, headers });
    }
    if (!upstream.ok || !upstream.body) throw new Error('Video unavailable');
    const download = new URL(req.url).searchParams.get('download') === '1';
    const headers = new Headers({
      'Content-Type': 'video/mp4',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="affimatik-${job.id}.mp4"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    });
    for (const name of ['content-length', 'content-range']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch { return NextResponse.json({ error: 'Fail video tidak tersedia.' }, { status: 503 }); }
}
