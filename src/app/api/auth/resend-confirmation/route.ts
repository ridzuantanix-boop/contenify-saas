import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return NextResponse.json({ error: 'Alamat emel tidak sah.' }, { status: 400 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return NextResponse.json({ error: 'Perkhidmatan emel tidak tersedia.' }, { status: 503 });
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/resend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY },
      body: JSON.stringify({ type: 'signup', email }),
    });
    if (!response.ok && response.status !== 429) throw new Error('Auth email failed');
    return NextResponse.json({ success: true, message: 'Jika akaun belum disahkan, permintaan emel baharu telah diterima. Semak Inbox dan Spam.' });
  } catch { return NextResponse.json({ error: 'Permintaan emel tidak dapat dihantar kepada penyedia.' }, { status: 503 }); }
}
