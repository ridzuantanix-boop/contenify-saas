import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Storan tidak tersedia.' }, { status: 503 });
  const page = Math.max(0, Math.min(1000, Number(new URL(req.url).searchParams.get('page')) || 0));
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(session.workspaceId)}&status=eq.COMPLETED&result_video_r2_key=not.is.null&select=id,preset_id,provider,duration_seconds,created_at,completed_at,result_video_r2_key,input_options&order=created_at.desc&limit=24&offset=${page * 24}`;
  try {
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error('Video query failed');
    const rows = await response.json() as Array<Record<string, unknown>>;
    return NextResponse.json({ videos: rows.map((row) => ({
      id: row.id,
      styleId: row.preset_id,
      provider: row.provider,
      durationSeconds: row.duration_seconds,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      imageAssetId: (row.input_options as { imageAssetId?: string } | null)?.imageAssetId || null,
      streamUrl: `/api/videos/${row.id}/stream`,
      downloadUrl: `/api/videos/${row.id}/stream?download=1`,
    })), hasMore: rows.length === 24 });
  } catch { return NextResponse.json({ error: 'Pustaka video tidak tersedia.' }, { status: 503 }); }
}
