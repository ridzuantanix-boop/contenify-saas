import { NextRequest, NextResponse } from 'next/server';
import { authCallbackUrl } from '@/lib/auth/public-origin';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const purchaseIntent = body.purchaseIntent === 'launch_pack' ? 'launch_pack' : undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return NextResponse.json({ error: 'Alamat emel tidak sah.' }, { status: 400 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return NextResponse.json({ error: 'Perkhidmatan emel tidak tersedia.' }, { status: 503 });
  try {
    const redirectTo = authCallbackUrl(req, purchaseIntent);
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/resend?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY },
      body: JSON.stringify({ type: 'signup', email }),
    });
    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
      return NextResponse.json({
        error: 'Had penghantaran emel telah dicapai. Tiada emel baharu dihantar. Sila tunggu sebelum mencuba lagi.',
        code: 'AUTH_EMAIL_RATE_LIMIT',
        ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
      }, { status: 429, headers: Number.isFinite(retryAfter) && retryAfter > 0 ? { 'Retry-After': String(retryAfter) } : undefined });
    }
    if (!response.ok) throw new Error('Auth email failed');
    return NextResponse.json({ success: true, message: 'Jika akaun belum disahkan, permintaan emel baharu telah diterima. Semak Inbox dan Spam.' });
  } catch { return NextResponse.json({ error: 'Permintaan emel tidak dapat dihantar kepada penyedia.' }, { status: 503 }); }
}
