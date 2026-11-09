import { NextRequest, NextResponse } from 'next/server';
import { authCallbackUrl } from '@/lib/auth/public-origin';

/**
 * POST /api/auth/password-reset
 * Handles password reset request via Supabase Auth.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Sila masukkan alamat emel yang sah.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const redirectTo = authCallbackUrl(req);
      const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Number.parseInt(res.headers.get('retry-after') || '', 10);
          return NextResponse.json({
            error: 'Had penghantaran emel telah dicapai. Sila tunggu sebelum meminta pautan baharu.',
            code: 'AUTH_EMAIL_RATE_LIMIT',
            ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
          }, { status: 429, headers: Number.isFinite(retryAfter) && retryAfter > 0 ? { 'Retry-After': String(retryAfter) } : undefined });
        }
        return NextResponse.json(
          { error: 'Permintaan pemulihan tidak dapat diproses buat masa ini.' },
          { status: res.status }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sekiranya emel tersebut berdaftar, pautan tetapan semula kata laluan telah dihantar ke peti masuk anda.',
    });
  } catch {
    return NextResponse.json({ error: 'Perkhidmatan pemulihan kata laluan tidak dapat diakses.' }, { status: 503 });
  }
}
