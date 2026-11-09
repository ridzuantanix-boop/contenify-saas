import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { BUILT_IN_SCENES } from '@/lib/personalization/config';
import { OFFICIAL_BACKGROUNDS } from '@/lib/personalization/official-assets';
import { deletePrivateAsset, signPrivateAsset, uploadPrivateAsset } from '@/lib/storage/supabase-assets';

function dbConfig() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Pangkalan data tidak tersedia.');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } };
}

function validImage(file: File, bytes: ArrayBuffer) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 8 || file.size > 15 * 1024 * 1024) return false;
  const head = new Uint8Array(bytes.slice(0, 12));
  return file.type === 'image/jpeg' ? head[0] === 255 && head[1] === 216 && head[2] === 255
    : file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((v, i) => head[i] === v)
      : new TextDecoder().decode(head.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(head.slice(8, 12)) === 'WEBP';
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const { base, headers } = dbConfig();
    const response = await fetch(`${base}/rest/v1/background_assets?workspace_id=eq.${encodeURIComponent(session.workspaceId)}&select=id,name,description,image_r2_key,mime_type,size_bytes,created_at&order=created_at.desc&limit=100`, { headers });
    if (!response.ok) throw new Error(`DB HTTP ${response.status}`);
    const rows = await response.json() as Array<{ id: string; name: string; description: string | null; image_r2_key: string; mime_type: string; size_bytes: number; created_at: string }>;
    const backgrounds = await Promise.all(rows.map(async (row) => {
      const imageUrl = await signPrivateAsset(row.image_r2_key, 900);
      return {
        id: row.id, name: row.name, description: row.description, mimeType: row.mime_type,
        sizeBytes: row.size_bytes, createdAt: row.created_at, imageUrl, thumbnailUrl: imageUrl,
        referenceUrl: imageUrl, official: false, readOnly: false, source: 'custom' as const,
      };
    }));
    return NextResponse.json({ builtInScenes: BUILT_IN_SCENES, officialBackgrounds: OFFICIAL_BACKGROUNDS, backgrounds });
  } catch {
    return NextResponse.json({ error: 'Pustaka latar tidak tersedia.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('image');
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim().slice(0, 1000);
    if (!name || name.length > 100 || !(file instanceof File)) return NextResponse.json({ error: 'Nama dan imej latar diperlukan.' }, { status: 400 });
    const bytes = await file.arrayBuffer();
    if (!validImage(file, bytes)) return NextResponse.json({ error: 'Imej latar mesti JPEG, PNG atau WebP sah hingga 15 MB.' }, { status: 400 });
    const id = crypto.randomUUID();
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const key = `workspaces/${session.workspaceId}/backgrounds/${id}.${ext}`;
    await uploadPrivateAsset(key, bytes, file.type);
    const { base, headers } = dbConfig();
    const response = await fetch(`${base}/rest/v1/background_assets`, { method: 'POST', headers, body: JSON.stringify({
      id, workspace_id: session.workspaceId, name, description: description || null,
      image_r2_key: key, mime_type: file.type, size_bytes: file.size,
    }) });
    if (!response.ok) { await deletePrivateAsset(key); throw new Error(`DB HTTP ${response.status}`); }
    return NextResponse.json({ id, imageUrl: await signPrivateAsset(key) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Latar tidak dapat disimpan.' }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const body = await req.json() as { id?: string; name?: string; description?: string };
    if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id) || !body.name?.trim() || body.name.trim().length > 100) return NextResponse.json({ error: 'Maklumat latar tidak sah.' }, { status: 400 });
    const { base, headers } = dbConfig();
    const response = await fetch(`${base}/rest/v1/background_assets?id=eq.${encodeURIComponent(body.id)}&workspace_id=eq.${encodeURIComponent(session.workspaceId)}`, {
      method: 'PATCH', headers, body: JSON.stringify({ name: body.name.trim(), description: String(body.description || '').trim().slice(0, 1000) || null, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error(`DB HTTP ${response.status}`);
    const rows = await response.json() as unknown[];
    if (!rows.length) return NextResponse.json({ error: 'Latar tidak ditemui.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Latar tidak dapat dikemas kini.' }, { status: 503 }); }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ID latar tidak sah.' }, { status: 400 });
  try {
    const { base, headers } = dbConfig();
    const filter = `id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(session.workspaceId)}`;
    const lookup = await fetch(`${base}/rest/v1/background_assets?${filter}&select=image_r2_key`, { headers });
    if (!lookup.ok) throw new Error('DB lookup failed');
    const rows = await lookup.json() as Array<{ image_r2_key: string }>;
    if (!rows.length) return NextResponse.json({ error: 'Latar tidak ditemui.' }, { status: 404 });
    const deleted = await fetch(`${base}/rest/v1/background_assets?${filter}`, { method: 'DELETE', headers });
    if (!deleted.ok) throw new Error('DB delete failed');
    await deletePrivateAsset(rows[0].image_r2_key);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Latar tidak dapat dipadam.' }, { status: 503 }); }
}
