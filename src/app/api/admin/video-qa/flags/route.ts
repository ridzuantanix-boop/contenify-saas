import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codes = ['POST_CTA_SPEECH_REVIEW', 'PRODUCT_FACT_REVIEW'] as const;

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.SUPABASE_URL) throw new Error('Database unavailable');
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function admin(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  return auth.isAuthorized && auth.role === 'superadmin' && auth.userId ? auth : null;
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.get('host'); } catch { return false; }
}

async function rpc(name: string, body: Record<string, unknown>) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { ...serviceHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store',
  });
  if (!response.ok) throw new Error('Database RPC unavailable');
  return response.json() as Promise<{ success?: boolean; error?: string; duplicate?: boolean; idempotent?: boolean; id?: string }>;
}

export async function GET(req: NextRequest) {
  if (!await admin(req)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/video_quality_flags?select=id,job_id,provider_task_id,asset_id,code,category,issue,start_seconds,end_seconds,transcript_evidence,created_at,reviewed_at,reviewed_by,review_note&order=created_at.desc&limit=100`, {
      headers: serviceHeaders(), cache: 'no-store',
    });
    if (!response.ok) throw new Error('Flags unavailable');
    return NextResponse.json({ flags: await response.json() });
  } catch { return NextResponse.json({ error: 'Flag semakan tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await admin(req);
  if (!auth) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origin tidak sah.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const code = body.code;
  const issue = typeof body.issue === 'string' ? body.issue.trim() : '';
  const transcript = typeof body.transcriptEvidence === 'string' ? body.transcriptEvidence.trim() : '';
  const start = body.startSeconds === null || body.startSeconds === undefined || body.startSeconds === '' ? null : Number(body.startSeconds);
  const end = body.endSeconds === null || body.endSeconds === undefined || body.endSeconds === '' ? null : Number(body.endSeconds);
  if (typeof body.jobId !== 'string' || !uuid.test(body.jobId) || !codes.includes(code) || issue.length < 3 || issue.length > 400 || transcript.length < 1 || transcript.length > 1000 ||
      (start === null) !== (end === null) || (start !== null && (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end! < start || end! > 60))) {
    return NextResponse.json({ error: 'Bukti semakan tidak sah.' }, { status: 400 });
  }
  try {
    const result = await rpc('record_video_quality_flag_atomic', {
      p_job_id: body.jobId, p_code: code, p_issue: issue, p_start_seconds: start,
      p_end_seconds: end, p_transcript_evidence: transcript, p_actor: auth.userId,
    });
    if (!result.success) return NextResponse.json({ error: result.error || 'Flag gagal disimpan.' }, { status: 409 });
    return NextResponse.json({ success: true, id: result.id, duplicate: result.duplicate || false });
  } catch { return NextResponse.json({ error: 'Flag gagal disimpan.' }, { status: 503 }); }
}

export async function PATCH(req: NextRequest) {
  const auth = await admin(req);
  if (!auth) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origin tidak sah.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (typeof body.flagId !== 'string' || !uuid.test(body.flagId) || note.length > 500) return NextResponse.json({ error: 'Semakan tidak sah.' }, { status: 400 });
  try {
    const result = await rpc('review_video_quality_flag_atomic', { p_flag_id: body.flagId, p_actor: auth.userId, p_note: note });
    if (!result.success) return NextResponse.json({ error: result.error || 'Semakan gagal.' }, { status: 404 });
    return NextResponse.json({ success: true, idempotent: result.idempotent || false });
  } catch { return NextResponse.json({ error: 'Semakan gagal disimpan.' }, { status: 503 }); }
}
