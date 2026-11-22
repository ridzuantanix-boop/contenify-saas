import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(['OPEN','REVIEWING','RESOLVED','DISMISSED']);

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return NextResponse.json({ error: 'Semakan tidak tersedia.' }, { status: 503 });
  const response = await fetch(`${base}/rest/v1/video_quality_reports?select=id,job_id,workspace_id,style_id,provider,generation_at,category,description,status,admin_note,created_at,reviewed_at&order=created_at.desc&limit=100`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store',
  });
  if (!response.ok) return NextResponse.json({ error: 'Laporan tidak tersedia.' }, { status: 503 });
  return NextResponse.json({ reports: await response.json() });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  if (!auth.isAuthorized) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  const origin = req.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ error: 'Permintaan tidak dibenarkan.' }, { status: 403 }); }
    catch { return NextResponse.json({ error: 'Permintaan tidak dibenarkan.' }, { status: 403 }); }
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = typeof body.id === 'string' && uuid.test(body.id) ? body.id : '';
  const status = typeof body.status === 'string' && statuses.has(body.status) ? body.status : '';
  const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : '';
  if (!id || !status || adminNote.length > 2000) return NextResponse.json({ error: 'Semakan tidak sah.' }, { status: 400 });
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return NextResponse.json({ error: 'Semakan tidak tersedia.' }, { status: 503 });
  const response = await fetch(`${base}/rest/v1/video_quality_reports?id=eq.${id}`, {
    method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status, admin_note: adminNote, reviewed_at: new Date().toISOString() }),
  });
  if (!response.ok) return NextResponse.json({ error: 'Semakan tidak dapat disimpan.' }, { status: 503 });
  const rows = await response.json() as unknown[];
  return rows.length ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Laporan tidak ditemui.' }, { status: 404 });
}
