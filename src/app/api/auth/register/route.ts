import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { authCallbackUrl } from '@/lib/auth/public-origin';

function authEmailFailure(response: Response, result: Record<string, unknown>) {
  const code = typeof result.error_code === 'string' ? result.error_code
    : typeof result.code === 'string' ? result.code : '';
  const providerMessage = [result.msg, result.error_description, result.message]
    .find((value): value is string => typeof value === 'string') || '';
  const rateLimited = response.status === 429
    || code === 'over_email_send_rate_limit'
    || /email rate limit exceeded/i.test(providerMessage);
  if (rateLimited) {
    const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
    return NextResponse.json({
      error: 'Had penghantaran emel pengesahan telah dicapai. Pendaftaran belum selesai. Sila cuba semula kemudian; jangan tekan daftar berulang kali.',
      code: 'AUTH_EMAIL_RATE_LIMIT',
      ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
    }, { status: 429, headers: Number.isFinite(retryAfter) && retryAfter > 0 ? { 'Retry-After': String(retryAfter) } : undefined });
  }
  if (code === 'email_address_not_authorized' || /email address not authorized/i.test(providerMessage)) {
    return NextResponse.json({
      error: 'Penghantaran emel pendaftaran belum dikonfigurasi untuk alamat awam. Sila hubungi sokongan AffiMatik.',
      code: 'AUTH_EMAIL_NOT_CONFIGURED',
    }, { status: 503 });
  }
  return NextResponse.json({ error: providerMessage || 'Pendaftaran gagal.' }, { status: response.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 255) : '';
  const purchaseIntent = body.purchaseIntent === 'launch_pack' ? 'launch_pack' : undefined;
  const acceptedTerms = body.acceptedTerms === true;
  const referralCode = typeof body.referralCode === 'string' ? body.referralCode.trim().toUpperCase() : (req.cookies.get('affimatik_ref')?.value || '');
  if (!acceptedTerms) return NextResponse.json({ error: 'Persetujuan Terma, Notis Privasi dan kelayakan umur diperlukan.' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || password.length < 8 || password.length > 128 || whatsapp.replace(/\D/g, '').length < 8 || !/^[A-Z0-9_-]{0,50}$/.test(referralCode)) {
    return NextResponse.json({ error: 'Semak alamat emel, kata laluan (8–128 aksara), WhatsApp dan kod rujukan.' }, { status: 400 });
  }

  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV === 'production' && (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SESSION_SECRET)) {
      return NextResponse.json({ error: 'Pendaftaran sedang diselenggara.' }, { status: 503 });
    }
    try {
      const redirectTo = authCallbackUrl(req, purchaseIntent);
      const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password, data: { full_name: fullName || email.split('@')[0], whatsapp, referral_code: referralCode || null } }),
      });
      const result = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) return authEmailFailure(response, result);
      // GoTrue's raw /signup endpoint returns a flat user object. SDK wrappers
      // may instead return { user, session }. Accept both documented shapes.
      const user = result.user && typeof result.user === 'object'
        ? result.user as Record<string, unknown> : result;
      if (typeof user.id !== 'string' || !user.id) return NextResponse.json({ error: 'Respons pendaftaran tidak lengkap.' }, { status: 502 });
      // A confirmed Supabase identity is provisioned atomically at first login.
      // No workspace or welcome credit is created for an unverified mailbox.
      if (result.session) {
        return NextResponse.json({ error: 'Pengesahan emel mesti diaktifkan pada Supabase Auth sebelum pendaftaran boleh digunakan.' }, { status: 503 });
      }
      return NextResponse.json({ success: true, requiresEmailConfirmation: true, email,
        message: 'Jika ini akaun baharu, semak emel pengesahan. Jika pernah mendaftar, sila log masuk.' });
    } catch { return NextResponse.json({ error: 'Perkhidmatan pendaftaran tidak dapat diakses.' }, { status: 503 }); }
  }

  if (process.env.NODE_ENV === 'production' && !process.env.VITEST) return NextResponse.json({ error: 'Pangkalan data pendaftaran belum dikonfigurasi.' }, { status: 503 });
  // Local-only test mode. Production never issues a session without Supabase Auth.
  const userId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  DurableStore.saveCustomerProfile({ userId, email, fullName: fullName || email.split('@')[0], whatsapp, workspaceId, tier: 'free' });
  const wallet = await DurableStore.getWallet(workspaceId);
  const user = { userId, email, fullName: fullName || email.split('@')[0], whatsapp, workspaceId, tier: 'free' as const, role: 'owner' as const };
  const token = await createSessionToken(user);
  const response = NextResponse.json({ success: true, requiresEmailConfirmation: false, email, user, wallet });
  response.cookies.set('affimatik_session', token, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });
  return response;
}
