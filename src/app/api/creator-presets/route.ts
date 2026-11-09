import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { sanitizePersonalizationSettings } from '@/lib/personalization/config';

function dbConfig() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Pangkalan data tidak tersedia.');
  return { base, key, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } };
}

async function setDefault(base: string, key: string, workspaceId: string, presetId: string | null) {
  const response = await fetch(`${base}/rest/v1/rpc/set_creator_preset_default`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_workspace_id: workspaceId, p_preset_id: presetId }) });
  if (!response.ok) throw new Error(`Default RPC HTTP ${response.status}`);
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const { base, headers } = dbConfig();
    const response = await fetch(`${base}/rest/v1/creator_presets?workspace_id=eq.${encodeURIComponent(session.workspaceId)}&select=id,name,settings,is_default,created_at,updated_at&order=is_default.desc,updated_at.desc&limit=100`, { headers });
    if (!response.ok) throw new Error(`DB HTTP ${response.status}`);
    const rows = await response.json() as Array<{ id: string; name: string; settings: unknown; is_default: boolean; created_at: string; updated_at: string }>;
    return NextResponse.json({ presets: rows.map((row) => ({ id: row.id, name: row.name, settings: sanitizePersonalizationSettings(row.settings), isDefault: row.is_default, createdAt: row.created_at, updatedAt: row.updated_at })) });
  } catch { return NextResponse.json({ error: 'Pustaka preset tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const body = await req.json() as { name?: string; settings?: unknown; isDefault?: boolean; duplicateFrom?: string };
    const name = String(body.name || '').trim();
    if (!name || name.length > 100) return NextResponse.json({ error: 'Nama preset diperlukan (maksimum 100 aksara).' }, { status: 400 });
    const { base, key, headers } = dbConfig();
    let settings = sanitizePersonalizationSettings(body.settings);
    if (body.duplicateFrom) {
      const source = await fetch(`${base}/rest/v1/creator_presets?id=eq.${encodeURIComponent(body.duplicateFrom)}&workspace_id=eq.${encodeURIComponent(session.workspaceId)}&select=settings&limit=1`, { headers });
      const rows = source.ok ? await source.json() as Array<{ settings: unknown }> : [];
      if (!rows.length) return NextResponse.json({ error: 'Preset sumber tidak ditemui.' }, { status: 404 });
      settings = sanitizePersonalizationSettings(rows[0].settings);
    }
    const id = crypto.randomUUID();
    const response = await fetch(`${base}/rest/v1/creator_presets`, { method: 'POST', headers, body: JSON.stringify({ id, workspace_id: session.workspaceId, name, settings, is_default: false }) });
    if (!response.ok) throw new Error(`DB HTTP ${response.status}`);
    if (body.isDefault) await setDefault(base, key, session.workspaceId, id);
    return NextResponse.json({ id, settings }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Preset tidak dapat disimpan.' }, { status: 503 }); }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const body = await req.json() as { id?: string; name?: string; settings?: unknown; isDefault?: boolean };
    if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: 'ID preset tidak sah.' }, { status: 400 });
    const { base, key, headers } = dbConfig();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length > 100) return NextResponse.json({ error: 'Nama preset tidak sah.' }, { status: 400 });
      patch.name = name;
    }
    if (body.settings !== undefined) patch.settings = sanitizePersonalizationSettings(body.settings);
    const response = await fetch(`${base}/rest/v1/creator_presets?id=eq.${encodeURIComponent(body.id)}&workspace_id=eq.${encodeURIComponent(session.workspaceId)}`, { method: 'PATCH', headers, body: JSON.stringify(patch) });
    if (!response.ok) throw new Error(`DB HTTP ${response.status}`);
    const rows = await response.json() as unknown[];
    if (!rows.length) return NextResponse.json({ error: 'Preset tidak ditemui.' }, { status: 404 });
    if (body.isDefault === true) await setDefault(base, key, session.workspaceId, body.id);
    if (body.isDefault === false) await setDefault(base, key, session.workspaceId, null);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Preset tidak dapat dikemas kini.' }, { status: 503 }); }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ID preset tidak sah.' }, { status: 400 });
  try {
    const { base, headers } = dbConfig();
    const response = await fetch(`${base}/rest/v1/creator_presets?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(session.workspaceId)}`, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`DB HTTP ${response.status}`);
    const rows = await response.json() as unknown[];
    if (!rows.length) return NextResponse.json({ error: 'Preset tidak ditemui.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Preset tidak dapat dipadam.' }, { status: 503 }); }
}
