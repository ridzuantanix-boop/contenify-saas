import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 255) : '';
  const referralCode = typeof body.referralCode === 'string' ? body.referralCode.trim().toUpperCase() : (req.cookies.get('affimatik_ref')?.value || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || password.length < 8 || password.length > 128 || whatsapp.replace(/\D/g, '').length < 8 || !/^[A-Z0-9_-]{0,50}$/.test(referralCode)) {
    return NextResponse.json({ error: 'Semak alamat emel, kata laluan (8–128 aksara), WhatsApp dan kod rujukan.' }, { status: 400 });
  }

  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV === 'production' && (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SESSION_SECRET)) {
      return NextResponse.json({ error: 'Pendaftaran sedang diselenggara.' }, { status: 503 });
    }
    try {
      const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password, data: { full_name: fullName || email.split('@')[0], whatsapp, referral_code: referralCode || null } }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return NextResponse.json({ error: result.msg || result.error_description || result.message || 'Pendaftaran gagal.' }, { status: response.status });
      if (!result.user?.id) return NextResponse.json({ error: 'Respons pendaftaran tidak lengkap.' }, { status: 502 });
      // A confirmed Supabase identity is provisioned atomically at first login.
      // No workspace or welcome credit is created for an unverified mailbox.
      if (result.session) {
        return NextResponse.json({ error: 'Pengesahan emel mesti diaktifkan pada Supabase Auth sebelum pendaftaran boleh digunakan.' }, { status: 503 });
      }
      return NextResponse.json({ success: true, requiresEmailConfirmation: true, email,
        message: 'Pendaftaran diterima. Sila sahkan alamat emel anda sebelum log masuk.' });
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
