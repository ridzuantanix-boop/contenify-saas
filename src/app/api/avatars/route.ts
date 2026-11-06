import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { deletePrivateAsset, signPrivateAsset, uploadPrivateAsset } from '@/lib/storage/supabase-assets';


function dbConfig() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Pangkalan data tidak tersedia.');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } };
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const { base, headers } = dbConfig();
    const result = await fetch(`${base}/rest/v1/avatars?workspace_id=eq.${encodeURIComponent(session.workspaceId)}&select=id,name,description,gender,modesty_style,image_r2_key,consent_confirmed,created_at&order=created_at.desc&limit=100`, { headers });
    if (!result.ok) throw new Error(`DB HTTP ${result.status}`);
    const rows = await result.json() as Array<{ id: string; name: string; description: string | null; gender: string; modesty_style: string; image_r2_key: string; consent_confirmed: boolean; created_at: string }>;
    return NextResponse.json({ avatars: await Promise.all(rows.map(async (row) => ({
      id: row.id, name: row.name, description: row.description, gender: row.gender,
      modestyStyle: row.modesty_style, consentConfirmed: row.consent_confirmed,
      createdAt: row.created_at, imageUrl: await signPrivateAsset(row.image_r2_key, 900),
    }))) });
  } catch { return NextResponse.json({ error: 'Pustaka avatar tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('image');
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim().slice(0, 1000);
    const gender = String(form.get('gender') || 'faceless');
    if (!name || name.length > 100 || !['female', 'male', 'faceless'].includes(gender) || form.get('consent') !== 'true') {
      return NextResponse.json({ error: 'Nama, jenis dan pengesahan hak/keizinan avatar diperlukan.' }, { status: 400 });
    }
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 8 || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imej avatar mesti JPEG, PNG atau WebP hingga 10 MB.' }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const head = new Uint8Array(bytes.slice(0, 12));
    const valid = file.type === 'image/jpeg' ? head[0] === 255 && head[1] === 216 && head[2] === 255
      : file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((value, index) => head[index] === value)
        : new TextDecoder().decode(head.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(head.slice(8, 12)) === 'WEBP';
    if (!valid) return NextResponse.json({ error: 'Kandungan imej tidak sepadan dengan format.' }, { status: 400 });
    const id = crypto.randomUUID();
    const key = `workspaces/${session.workspaceId}/avatars/${id}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
    await uploadPrivateAsset(key, bytes, file.type);
    const { base, headers } = dbConfig();
    const result = await fetch(`${base}/rest/v1/avatars`, { method: 'POST', headers, body: JSON.stringify({
      id, workspace_id: session.workspaceId, name, description: description || null, gender,
      modesty_style: 'general_modest', image_r2_key: key, consent_confirmed: true, is_official: false,
    }) });
    if (!result.ok) { await deletePrivateAsset(key); throw new Error(`DB HTTP ${result.status}`); }
    return NextResponse.json({ id, imageUrl: await signPrivateAsset(key) }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Avatar tidak dapat disimpan.' }, { status: 503 }); }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ID avatar tidak sah.' }, { status: 400 });
  try {
    const { base, headers } = dbConfig();
    const filter = `id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(session.workspaceId)}&is_official=eq.false`;
    const lookup = await fetch(`${base}/rest/v1/avatars?${filter}&select=image_r2_key`, { headers });
    if (!lookup.ok) throw new Error('DB lookup failed');
    const rows = await lookup.json() as Array<{ image_r2_key: string }>;
    if (!rows.length) return NextResponse.json({ error: 'Avatar tidak ditemui.' }, { status: 404 });
    const deleted = await fetch(`${base}/rest/v1/avatars?${filter}`, { method: 'DELETE', headers });
    if (!deleted.ok) throw new Error('DB delete failed');
    await deletePrivateAsset(rows[0].image_r2_key);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Avatar tidak dapat dipadam.' }, { status: 503 }); }
}
