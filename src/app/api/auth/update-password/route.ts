import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!accessToken || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: 'Pautan pemulihan atau kata laluan tidak sah.' }, { status: 400 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Perkhidmatan pemulihan kata laluan tidak tersedia.' }, { status: 503 });
  }
  const headers = { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` };
  try {
    const verify = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers });
    if (!verify.ok) return NextResponse.json({ error: 'Pautan pemulihan tidak sah atau telah tamat tempoh.' }, { status: 401 });
    const update = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { method: 'PUT', headers, body: JSON.stringify({ password }) });
    if (!update.ok) {
      const result = await update.json().catch(() => ({})) as Record<string, unknown>;
      const message = typeof result.msg === 'string' ? result.msg : typeof result.message === 'string' ? result.message : '';
      return NextResponse.json({ error: message || 'Kata laluan tidak dapat dikemas kini.' }, { status: update.status });
    }
    return NextResponse.json({ success: true, message: 'Kata laluan berjaya dikemas kini. Sila log masuk menggunakan kata laluan baharu.' });
  } catch {
    return NextResponse.json({ error: 'Perkhidmatan pemulihan kata laluan tidak dapat diakses.' }, { status: 503 });
  }
}
