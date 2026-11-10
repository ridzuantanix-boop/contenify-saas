import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';


export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Storan tidak tersedia.' }, { status: 503 });
  const page = Math.max(0, Math.min(1000, Number(new URL(req.url).searchParams.get('page')) || 0));
  const search = new URL(req.url).searchParams;
  const uuid = (value: string | null) => value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  const batchId = uuid(search.get('batchId'));
  const profileId = uuid(search.get('profileId'));
  const styleId = String(search.get('styleId') || '').match(/^[A-Z]{2}\d{2}$/)?.[0] || null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const filters = [batchId ? `auto_factory_batch_id=eq.${batchId}` : '', profileId ? `creator_profile_id=eq.${profileId}` : '', styleId ? `preset_id=eq.${styleId}` : ''].filter(Boolean).join('&');
  const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(session.workspaceId)}&status=eq.COMPLETED&result_video_r2_key=not.is.null${filters ? `&${filters}` : ''}&select=id,preset_id,provider,duration_seconds,actual_duration_seconds,output_has_audio,output_size_bytes,created_at,completed_at,result_video_r2_key,input_options,auto_factory_batch_id,creator_profile_id,generation_snapshot&order=created_at.desc&limit=24&offset=${page * 24}`;
  try {
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error('Video query failed');
    const rows = await response.json() as Array<Record<string, unknown>>;
    return NextResponse.json({ videos: rows.map((row) => ({
      id: row.id,
      styleId: row.preset_id,
      provider: row.provider,
      durationSeconds: row.actual_duration_seconds || row.duration_seconds,
      durationVerified: row.actual_duration_seconds !== null,
      hasAudio: row.output_has_audio,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      imageAssetId: (row.input_options as { imageAssetId?: string } | null)?.imageAssetId || null,
      batchId: row.auto_factory_batch_id || null,
      creatorProfileId: row.creator_profile_id || null,
      productId: (row.generation_snapshot as { productId?: string } | null)?.productId || null,
      productFolderId: (row.generation_snapshot as { productFolderId?: string } | null)?.productFolderId || null,
      streamUrl: `/api/videos/${row.id}/stream`,
      downloadUrl: `/api/videos/${row.id}/stream?download=1`,
    })), hasMore: rows.length === 24 });
  } catch { return NextResponse.json({ error: 'Pustaka video tidak tersedia.' }, { status: 503 }); }
}
