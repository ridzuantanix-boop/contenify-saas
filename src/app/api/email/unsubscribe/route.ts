import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return NextResponse.json({ error: 'Pautan berhenti langgan tidak sah.' }, { status: 400 });
  }
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return NextResponse.json({ error: 'Perkhidmatan tidak tersedia.' }, { status: 503 });
  const response = await fetch(`${base}/rest/v1/rpc/unsubscribe_marketing_email_v1`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_token: token }), cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) return NextResponse.json({ error: 'Pautan tidak ditemui atau sudah tidak sah.' }, { status: 404 });
  return NextResponse.json({ success: true, message: 'Anda tidak akan menerima e-mel pemasaran AffiMatik yang seterusnya.' });
}
