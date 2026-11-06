import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.SUPABASE_URL) throw new Error('Database unavailable');
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function isSuperAdmin(req: NextRequest) {
  const auth = await verifyAdminAccess(req);
  return auth.isAuthorized && auth.role === 'superadmin' ? auth : null;
}

export async function GET(req: NextRequest) {
  if (!await isSuperAdmin(req)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?status=eq.QA_PENDING&select=id,workspace_id,preset_id,provider,duration_seconds,actual_duration_seconds,output_has_audio,qa_started_at,created_at&order=qa_started_at.asc&limit=50`;
    const response = await fetch(url, { headers: serviceHeaders(), cache: 'no-store' });
    if (!response.ok) throw new Error('QA list unavailable');
    const jobs = await response.json();
    return NextResponse.json({ jobs });
  } catch { return NextResponse.json({ error: 'Senarai semakan video tidak tersedia.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await isSuperAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  if (!auth.userId || !uuid.test(auth.userId)) return NextResponse.json({ error: 'Sesi superadmin diperlukan untuk keputusan QA.' }, { status: 403 });
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ error: 'Origin tidak sah.' }, { status: 403 });
    } catch { return NextResponse.json({ error: 'Origin tidak sah.' }, { status: 403 }); }
  }
  const body = await req.json().catch(() => ({}));
  const decision = body.decision;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (typeof body.jobId !== 'string' || !uuid.test(body.jobId) || !['APPROVE', 'REJECT'].includes(decision) || (decision === 'REJECT' && !reason)) {
    return NextResponse.json({ error: 'Keputusan atau sebab semakan tidak sah.' }, { status: 400 });
  }
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/review_video_job_atomic`, {
      method: 'POST',
      headers: { ...serviceHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_job_id: body.jobId, p_decision: decision, p_reason: reason, p_reviewer: auth.userId }),
    });
    if (!response.ok) throw new Error('QA transaction unavailable');
    const result = await response.json() as { success?: boolean; status?: string; error?: string; idempotent?: boolean };
    if (!result.success) return NextResponse.json({ error: result.error || 'Semakan video gagal.' }, { status: 409 });
    return NextResponse.json({ success: true, status: result.status, idempotent: result.idempotent || false });
  } catch { return NextResponse.json({ error: 'Keputusan semakan tidak dapat disimpan.' }, { status: 503 }); }
}
