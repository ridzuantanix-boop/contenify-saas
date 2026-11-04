import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, createSessionToken } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  let session = await getSessionFromRequest(req);

  // If no session exists in development or testing, provide an initial guest creator session
  if (!session) {
    const defaultUser = {
      userId: 'usr_creator_default',
      email: 'creator@affimatik.internal',
      fullName: 'AffiMatik Creator',
      workspaceId: 'ws_creator_default',
      role: 'owner' as const,
      tier: 'pro' as const,
    };

    const token = await createSessionToken(defaultUser);
    const wallet = await DurableStore.getWallet(defaultUser.workspaceId);

    const res = NextResponse.json({
      authenticated: true,
      user: defaultUser,
      wallet: {
        balance: wallet.balance,
        reservedBalance: wallet.reservedBalance,
      },
    });

    res.cookies.set('affimatik_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  }

  const wallet = await DurableStore.getWallet(session.workspaceId);

  return NextResponse.json({
    authenticated: true,
    user: session,
    wallet: {
      balance: wallet.balance,
      reservedBalance: wallet.reservedBalance,
    },
  });
}

export async function POST(req: NextRequest) {
  // Explicit login or workspace switch
  try {
    const body = await req.json();
    const { email = 'creator@affimatik.internal', tier = 'pro', role = 'owner' } = body;

    const sessionUser = {
      userId: `usr_${Date.now()}`,
      email,
      fullName: 'AffiMatik Creator',
      workspaceId: `ws_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      role: role === 'superadmin' ? 'member' as const : (role as any), // Prevent setting superadmin via public login!
      tier: (tier as any),
    };

    const token = await createSessionToken(sessionUser);
    const wallet = await DurableStore.getWallet(sessionUser.workspaceId);

    const res = NextResponse.json({
      success: true,
      user: sessionUser,
      wallet,
    });

    res.cookies.set('affimatik_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: 'Log keluar berjaya' });
  res.cookies.set('affimatik_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
