import { NextRequest, NextResponse } from 'next/server';


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
      const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: errData.msg || errData.message || 'Gagal menghantar pautan tetapan semula kata laluan.' },
          { status: res.status }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sekiranya emel tersebut berdaftar, pautan tetapan semula kata laluan telah dihantar ke peti masuk anda.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
